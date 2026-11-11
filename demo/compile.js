/**
 * TableTap – Reel compiler  v2
 * Since this ffmpeg build lacks libfreetype/drawtext, we:
 *   1. Use Playwright to render caption HTML → PNG images
 *   2. Use ffmpeg overlay filter to composite them onto clips
 *   3. Use ffmpeg loop-image for title cards
 *
 * Usage: node compile.js
 * Output: ./tabletap-reel.mp4
 */

const { execSync, spawnSync } = require('child_process');
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const DIR   = __dirname;
const CLIPS = path.join(DIR, 'clips');
const TMP   = path.join(DIR, 'tmp');
const IMG   = path.join(DIR, 'tmp', 'img');
const OUT   = path.join(DIR, 'tabletap-reel.mp4');

fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(IMG, { recursive: true });

const W = 1080, H = 1920;
const CAP_H = 260;   // caption bar height (px at bottom)
const CAP_Y = H - CAP_H;

// ─────────────────────────────────────────────────────────────────────────────
// ffmpeg helpers
// ─────────────────────────────────────────────────────────────────────────────
function ffrun(args) {
  const result = spawnSync('ffmpeg', ['-y', ...args], { encoding: 'utf8' });
  if (result.status !== 0 && result.stderr) {
    // Print first error line for debugging
    const err = (result.stderr || '').split('\n').filter(l => l.includes('Error') || l.includes('Invalid')).slice(0, 2).join('\n');
    if (err) console.warn('  ffmpeg:', err);
  }
  return result.status === 0;
}

function dur(file) {
  const r = spawnSync('ffprobe', ['-v','quiet','-show_entries','format=duration','-of','csv=p=0', file], { encoding:'utf8' });
  return parseFloat(r.stdout.trim()) || 0;
}

function tmp(name) { return path.join(TMP, name); }
function img(name) { return path.join(IMG, name); }

// ─────────────────────────────────────────────────────────────────────────────
// Convert & scale a webm clip to 1080×1920 H.264
// ─────────────────────────────────────────────────────────────────────────────
function convertClip(input, output, start, length) {
  console.log(`  convert ${path.basename(input)} [${start}s–${start+length}s]`);
  ffrun(['-ss', `${start}`, '-t', `${length}`, '-i', input,
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`,
    '-c:v','libx264','-preset','fast','-crf','20','-an', output]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Zoom: Ken Burns (1.0 → zTarget) via crop+scale.
// Avoids zoompan which produces wrong duration on VFR WebM inputs.
// At t=0 shows full frame; at t=d shows W/zTarget × H/zTarget centred at (cx,cy).
// ─────────────────────────────────────────────────────────────────────────────
function zoomClip(input, output, zTarget = 1.25, cx = 0.5, cy = 0.45) {
  console.log(`  zoom → ${zTarget}×`);
  const d = dur(input);
  if (!d) { fs.copyFileSync(input, output); return; }
  const dStr = d.toFixed(3);
  const dW = (W * (1 - 1 / zTarget)).toFixed(2);
  const dH = (H * (1 - 1 / zTarget)).toFixed(2);
  const wExpr = `${W}-${dW}*t/${dStr}`;
  const hExpr = `${H}-${dH}*t/${dStr}`;
  const xExpr = `${dW}*${cx}*t/${dStr}`;
  const yExpr = `${dH}*${cy}*t/${dStr}`;
  ffrun(['-i', input,
    '-vf', `fps=25,crop=${wExpr}:${hExpr}:${xExpr}:${yExpr},scale=${W}:${H}`,
    '-c:v','libx264','-preset','fast','-crf','20','-an', output]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Loop a PNG into a video of `dur` seconds
// ─────────────────────────────────────────────────────────────────────────────
function pngToVideo(pngPath, output, seconds) {
  console.log(`  png→video ${path.basename(pngPath)} (${seconds}s)`);
  ffrun(['-loop','1','-framerate','25','-i', pngPath,
    '-t', `${seconds}`,
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0d0d0d,` +
           `fade=t=in:st=0:d=0.4,fade=t=out:st=${seconds-0.5}:d=0.5`,
    '-c:v','libx264','-preset','fast','-crf','20','-an', output]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay a caption image onto a video between [start, end] seconds
// Chains multiple overlays together.
// ─────────────────────────────────────────────────────────────────────────────
function overlayCaptions(videoIn, capWindows, output) {
  // capWindows: [{img, start, end}]
  if (capWindows.length === 0) {
    fs.copyFileSync(videoIn, output);
    return;
  }
  console.log(`  overlay ${capWindows.length} caption(s)`);

  const inputs = ['-i', videoIn];
  capWindows.forEach(cw => inputs.push('-i', cw.img));

  // Build filter_complex
  let filterParts = [];
  let prev = '0:v';
  capWindows.forEach((cw, i) => {
    const idxIn  = i + 1;
    const idxOut = i < capWindows.length - 1 ? `ov${i}` : 'final';
    filterParts.push(
      `[${prev}][${idxIn}:v]overlay=x=0:y=${CAP_Y}:enable='between(t\\,${cw.start}\\,${cw.end})'[${idxOut}]`
    );
    prev = idxOut;
  });

  ffrun([...inputs,
    '-filter_complex', filterParts.join(';'),
    '-map', '[final]',
    '-c:v','libx264','-preset','fast','-crf','20','-an', output]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-dissolve two clips
// ─────────────────────────────────────────────────────────────────────────────
function crossfade(a, b, output, td = 0.5) {
  const da = dur(a);
  if (!da) { fs.copyFileSync(b, output); return; }
  const offset = Math.max(0, da - td).toFixed(3);
  ffrun(['-i', a, '-i', b,
    '-filter_complex', `[0:v][1:v]xfade=transition=fade:duration=${td}:offset=${offset}[v]`,
    '-map', '[v]',
    '-c:v','libx264','-preset','fast','-crf','20','-an', output]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Concatenate an array of clips with crossfades
// ─────────────────────────────────────────────────────────────────────────────
function concatAll(clips, output) {
  console.log(`  concat ${clips.length} clips`);
  let current = clips[0];
  for (let i = 1; i < clips.length; i++) {
    const isLast = i === clips.length - 1;
    const out = isLast ? output : tmp(`xf${i}.mp4`);
    crossfade(current, clips[i], out);
    current = out;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate ambient audio
// ─────────────────────────────────────────────────────────────────────────────
function genAudio(output, seconds) {
  console.log(`  generating audio (${seconds.toFixed(0)}s)`);
  ffrun([
    '-f','lavfi','-i',`sine=frequency=110:sample_rate=44100:duration=${seconds}`,
    '-f','lavfi','-i',`sine=frequency=165:sample_rate=44100:duration=${seconds}`,
    '-f','lavfi','-i',`sine=frequency=220:sample_rate=44100:duration=${seconds}`,
    '-filter_complex',
      '[0][1][2]amix=inputs=3:duration=first,' +
      'volume=0.07,' +
      'lowpass=f=600,' +
      `afade=t=in:st=0:d=2,afade=t=out:st=${seconds-2}:d=2`,
    '-c:a','aac','-ar','44100','-b:a','128k', output
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mix audio into final video
// ─────────────────────────────────────────────────────────────────────────────
function addAudio(videoIn, audioIn, output) {
  console.log(`  mixing audio`);
  ffrun(['-i', videoIn, '-i', audioIn,
    '-c:v','copy','-c:a','aac','-shortest','-map','0:v','-map','1:a', output]);
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYWRIGHT: Render an HTML caption bar to PNG (1080 × CAP_H)
// ─────────────────────────────────────────────────────────────────────────────
async function renderCaption(browser, text, sub, outputPath) {
  const ctx  = await browser.newContext({ viewport: { width: W, height: CAP_H } });
  const page = await ctx.newPage();
  await page.setContent(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <style>
      * { margin:0;padding:0;box-sizing:border-box }
      body {
        width:${W}px;height:${CAP_H}px;
        background:linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.78) 100%);
        border-top:5px solid #34d399;
        display:flex;flex-direction:column;
        align-items:center;justify-content:center;
        gap:10px;padding:0 60px;
        font-family:Impact,'Arial Black',sans-serif;
      }
      .main {
        font-size:68px;font-weight:400;color:#fff;
        text-align:center;line-height:1.1;
        text-shadow:2px 3px 10px rgba(0,0,0,0.9);
        letter-spacing:-1px;
      }
      .sub {
        font-family:'Arial',sans-serif;
        font-size:36px;font-weight:400;color:#34d399;
        text-align:center;line-height:1.3;
        text-shadow:1px 1px 6px rgba(0,0,0,0.9);
      }
    </style>
  </head><body>
    <div class="main">${text}</div>
    ${sub ? `<div class="sub">${sub}</div>` : ''}
  </body></html>`);
  await page.screenshot({ path: outputPath, type: 'png' });
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYWRIGHT: Render a full-screen title card to PNG (1080 × 1920)
// ─────────────────────────────────────────────────────────────────────────────
async function renderTitleCard(browser, lines, outputPath) {
  const ctx  = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();

  const lineHtml = lines.map(l => {
    const size  = l.size  ?? 72;
    const color = l.color ?? '#ffffff';
    const font  = l.font  ?? 'Impact,"Arial Black",sans-serif';
    return `<div style="font-family:${font};font-size:${size}px;color:${color};text-align:center;line-height:1.15;text-shadow:2px 3px 12px rgba(0,0,0,0.9);letter-spacing:-1px;padding:0 60px">${l.text}</div>`;
  }).join('');

  await page.setContent(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <style>
      * { margin:0;padding:0;box-sizing:border-box }
      body {
        width:${W}px;height:${H}px;
        background:linear-gradient(160deg,#060b06 0%,#0d1a0d 40%,#060b06 100%);
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:24px;
      }
      .dot { width:8px;height:8px;border-radius:50%;background:#34d399;opacity:0.6 }
      .dots { display:flex;gap:12px;margin-top:16px }
    </style>
  </head><body>
    ${lineHtml}
    <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
  </body></html>`);
  await page.screenshot({ path: outputPath, type: 'png' });
  await ctx.close();
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  const browser = await chromium.launch({ headless: true });

  console.log('='.repeat(60));
  console.log('  TableTap Reel Compiler  v2');
  console.log('='.repeat(60));

  // ── Source clips ─────────────────────────────────────────────────────────
  const SRC = {
    qr:        path.join(CLIPS, 'clip4_qr.webm'),
    customer:  path.join(CLIPS, 'clip1_customer.webm'),
    dashboard: path.join(CLIPS, 'clip2_dashboard.webm'),
    insights:  path.join(CLIPS, 'clip3_insights.webm'),
  };

  // ── Segment 0: Hook title card  (5s) ─────────────────────────────────────
  console.log('\n── Seg 0: Hook');
  await renderTitleCard(browser, [
    { text: 'Your cafe is losing orders',       size: 86,  color: '#ffffff' },
    { text: 'every single day.',                size: 86,  color: '#34d399' },
    { text: '',                                 size: 10 },
    { text: 'TableTap changes that.',           size: 48,  color: 'rgba(255,255,255,0.75)', font: 'Arial,sans-serif' },
  ], img('card_hook.png'));
  pngToVideo(img('card_hook.png'), tmp('seg0.mp4'), 5);

  // ── Segment 1: QR → Menu landing  (13s) ──────────────────────────────────
  console.log('\n── Seg 1: QR landing');
  convertClip(SRC.qr, tmp('seg1_base.mp4'), 0, 13);

  const cap1 = [
    { text: 'Scan QR &rarr; Menu opens instantly', sub: 'No app. No login. Zero friction.', start: 0.5, end: 5.0 },
    { text: '12 categories &bull; 60+ items',      sub: 'Updated live from your dashboard.',  start: 5.3, end: 9.5 },
    { text: 'Veg &bull; Non-veg &bull; Bestsellers', sub: 'Everything your guests need.',     start: 9.8, end: 13.0 },
  ];
  for (let i = 0; i < cap1.length; i++) {
    await renderCaption(browser, cap1[i].text, cap1[i].sub, img(`c1_${i}.png`));
  }
  overlayCaptions(tmp('seg1_base.mp4'), cap1.map((c, i) => ({ img: img(`c1_${i}.png`), start: c.start, end: c.end })), tmp('seg1_cap.mp4'));
  zoomClip(tmp('seg1_cap.mp4'), tmp('seg1.mp4'), 1.22, 0.5, 0.42);

  // ── Segment 2: Customer ordering  (17s) ──────────────────────────────────
  console.log('\n── Seg 2: Customer ordering');
  convertClip(SRC.customer, tmp('seg2_base.mp4'), 0, 17);

  const cap2 = [
    { text: 'Tap. Add. Done.',              sub: 'Cart updates live with every tap.',           start: 0.5,  end: 6.0  },
    { text: 'Pay online or at the counter', sub: 'UPI, card, or cash &mdash; guest\'s choice.', start: 6.3,  end: 12.0 },
    { text: 'Order placed &#10003;',        sub: 'Kitchen gets notified instantly.',             start: 12.3, end: 17.0 },
  ];
  for (let i = 0; i < cap2.length; i++) {
    await renderCaption(browser, cap2[i].text, cap2[i].sub, img(`c2_${i}.png`));
  }
  overlayCaptions(tmp('seg2_base.mp4'), cap2.map((c, i) => ({ img: img(`c2_${i}.png`), start: c.start, end: c.end })), tmp('seg2.mp4'));

  // ── Segment 3: Dashboard  (15s) ──────────────────────────────────────────
  console.log('\n── Seg 3: Dashboard');
  convertClip(SRC.dashboard, tmp('seg3_base.mp4'), 2, 15);

  const cap3 = [
    { text: 'Your dashboard. Live.',  sub: 'Every order, every table &mdash; one screen.', start: 0.5, end: 5.5  },
    { text: 'No missed tables.',      sub: 'Wait timers &bull; Notes &bull; One-tap serve.', start: 5.8, end: 10.5 },
    { text: 'Real-time. Always.',     sub: 'Board refreshes every 8 seconds.',               start: 10.8, end: 15.0 },
  ];
  for (let i = 0; i < cap3.length; i++) {
    await renderCaption(browser, cap3[i].text, cap3[i].sub, img(`c3_${i}.png`));
  }
  overlayCaptions(tmp('seg3_base.mp4'), cap3.map((c, i) => ({ img: img(`c3_${i}.png`), start: c.start, end: c.end })), tmp('seg3_cap.mp4'));
  zoomClip(tmp('seg3_cap.mp4'), tmp('seg3.mp4'), 1.2, 0.5, 0.38);

  // ── Segment 4: AI Insights — the main USP  (21s) ─────────────────────────
  console.log('\n── Seg 4: AI Insights (USP)');
  convertClip(SRC.insights, tmp('seg4_base.mp4'), 1, 21);

  const cap4 = [
    { text: 'Know your cafe better.',      sub: 'AI-powered analytics &mdash; updated every hour.',  start: 0.5,  end: 5.5  },
    { text: 'Rs.1,24,500 in 28 days',      sub: 'Revenue tracked automatically. No spreadsheets.',   start: 5.8,  end: 11.0 },
    { text: 'Peak hours heatmap',          sub: 'See exactly when your cafe is at its busiest.',      start: 11.3, end: 16.0 },
    { text: '#1 Carbonara Ramyun: 87 sold', sub: 'Bestsellers auto-detected. No guessing ever.',      start: 16.3, end: 21.0 },
  ];
  for (let i = 0; i < cap4.length; i++) {
    await renderCaption(browser, cap4[i].text, cap4[i].sub, img(`c4_${i}.png`));
  }
  overlayCaptions(tmp('seg4_base.mp4'), cap4.map((c, i) => ({ img: img(`c4_${i}.png`), start: c.start, end: c.end })), tmp('seg4_cap.mp4'));
  zoomClip(tmp('seg4_cap.mp4'), tmp('seg4.mp4'), 1.3, 0.5, 0.40);

  // ── Segment 5: CTA title card  (6s) ──────────────────────────────────────
  console.log('\n── Seg 5: CTA');
  await renderTitleCard(browser, [
    { text: 'TableTap',                               size: 110, color: '#ffffff' },
    { text: 'One QR. Full control.',                  size:  58, color: '#34d399' },
    { text: 'Orders &bull; Insights &bull; Payments', size:  36, color: 'rgba(255,255,255,0.65)', font: 'Arial,sans-serif' },
    { text: '',                                       size:  10 },
    { text: 'tabletap.dev',                           size:  52, color: '#34d399' },
    { text: 'Start for free',                         size:  36, color: 'rgba(255,255,255,0.6)', font: 'Arial,sans-serif' },
  ], img('card_cta.png'));
  pngToVideo(img('card_cta.png'), tmp('seg5.mp4'), 6);

  // ── Concatenate all segments ──────────────────────────────────────────────
  console.log('\n── Concatenating');
  concatAll([
    tmp('seg0.mp4'),
    tmp('seg1.mp4'),
    tmp('seg2.mp4'),
    tmp('seg3.mp4'),
    tmp('seg4.mp4'),
    tmp('seg5.mp4'),
  ], tmp('video_silent.mp4'));

  // ── Audio ─────────────────────────────────────────────────────────────────
  const totalDur = dur(tmp('video_silent.mp4'));
  console.log(`\n   Total duration: ${totalDur.toFixed(1)}s`);
  genAudio(tmp('ambient.aac'), totalDur + 1);
  addAudio(tmp('video_silent.mp4'), tmp('ambient.aac'), OUT);

  await browser.close();

  const stat = fs.statSync(OUT);
  console.log('\n' + '='.repeat(60));
  console.log(`✅  tabletap-reel.mp4  (${(stat.size/1024/1024).toFixed(1)} MB)`);
  console.log(`   ${OUT}`);
  console.log('='.repeat(60));
  console.log('\nTip: import into CapCut, DaVinci Resolve, or Instagram to add music.');
}

main().catch(err => { console.error(err); process.exit(1); });
