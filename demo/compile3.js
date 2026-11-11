/**
 * TableTap – Reel Compiler v3-fixed
 *
 * Fixes vs compile2.js:
 *  1. Zoom 1.14→1.50 (was invisible, now dramatic)
 *  2. Audio volume 0.06→0.4, remove lowpass (was inaudible)
 *  3. Hero/CTA cards animated via Playwright recordVideo (CSS fadeInUp)
 *  4. setpts=PTS-STARTPTS on all streams (fix jitter)
 *  5. shortest=1 on all overlays (fix timing drift)
 *  6. format=auto on caption overlays + correct enable='between(t,X,Y)' (no \,)
 *  7. Scan line effect on phone scenes (adds motion)
 *  8. fps=25,setpts=PTS-STARTPTS in convertClip (CFR, no VFR jitter)
 */

const { spawnSync } = require('child_process');
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const DIR   = __dirname;
const CLIPS = path.join(DIR, 'clips');
const TMP   = path.join(DIR, 'tmp3');
const IMG   = path.join(DIR, 'tmp3', 'img');
const OUT   = path.join(DIR, 'tabletap-reel-v3.mp4');

fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(IMG, { recursive: true });

const W = 1080, H = 1920;

// Phone geometry — same as compile2
const SCREEN_W = 640,  SCREEN_H = 1386;
const BEZEL_H  = 85,   BEZEL_B  = 75,  BEZEL_S = 38;
const PHONE_W  = SCREEN_W + BEZEL_S * 2;
const PHONE_H  = SCREEN_H + BEZEL_H + BEZEL_B;
const PHONE_X  = Math.round((W - PHONE_W) / 2);
const PHONE_Y  = 100;
const SCREEN_X = PHONE_X + BEZEL_S;
const SCREEN_Y = PHONE_Y + BEZEL_H;
const CAP_Y    = PHONE_Y + PHONE_H + 14;
const CAP_H    = H - CAP_Y - 10;

// ── ffmpeg helpers ────────────────────────────────────────────────────────────
function ffrun(args) {
  const result = spawnSync('ffmpeg', ['-y', ...args], {
    encoding: 'utf8', maxBuffer: 100 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const errs = (result.stderr || '').split('\n')
      .filter(l => /error|invalid|failed/i.test(l)).slice(0, 4);
    if (errs.length) console.warn('  ffmpeg:', errs.join('\n  '));
  }
  return result.status === 0;
}
function dur(file) {
  const r = spawnSync('ffprobe', [
    '-v','quiet','-show_entries','format=duration','-of','csv=p=0', file
  ], { encoding:'utf8' });
  return parseFloat(r.stdout.trim()) || 0;
}
function tmp(n) { return path.join(TMP, n); }
function img(n) { return path.join(IMG, n); }

// ── Convert WebM → strict CFR MP4 at screen resolution ───────────────────────
function convertClip(input, output, start, length) {
  console.log(`  convert ${path.basename(input)} [${start}s–${start+length}s]`);
  ffrun([
    '-ss', `${start}`, '-t', `${length}`, '-i', input,
    '-vf', [
      `scale=${SCREEN_W}:${SCREEN_H}:force_original_aspect_ratio=increase`,
      `crop=${SCREEN_W}:${SCREEN_H}`,
      'fps=25',
      'setpts=PTS-STARTPTS',
    ].join(','),
    '-c:v','libx264','-preset','fast','-crf','18','-an', output,
  ]);
}

// ── Ken Burns zoom (now 1.4-1.5×, clearly visible) ───────────────────────────
function zoomClip(input, output, zTarget = 1.45, cx = 0.5, cy = 0.45) {
  const d = dur(input);
  if (!d) { fs.copyFileSync(input, output); return; }
  const dStr = d.toFixed(3);
  const dW = (SCREEN_W * (zTarget - 1)).toFixed(2);
  const dH = (SCREEN_H * (zTarget - 1)).toFixed(2);
  const wS  = `trunc((${SCREEN_W}+${dW}*t/${dStr})/2)*2`;
  const hS  = `trunc((${SCREEN_H}+${dH}*t/${dStr})/2)*2`;
  console.log(`  zoom ${path.basename(input)} → ${zTarget}× over ${d.toFixed(1)}s`);
  const ok = ffrun(['-i', input,
    '-vf', `fps=25,scale='${wS}':'${hS}':eval=frame,` +
           `crop=${SCREEN_W}:${SCREEN_H}:(in_w-${SCREEN_W})*${cx}:(in_h-${SCREEN_H})*${cy},` +
           `setpts=PTS-STARTPTS`,
    '-c:v','libx264','-preset','fast','-crf','18','-an', output,
  ]);
  if (!ok) { console.warn('  zoom failed — copying'); fs.copyFileSync(input, output); }
  else console.log(`  ✓ zoom done (${dur(output).toFixed(1)}s)`);
}

// ── Composite: bg + app-at-screen-pos + phone-frame + captions ────────────────
// Fixes: shortest=1 on all overlays, format=auto on captions, correct enable syntax
function compositePhoneScene(appClip, bgPng, framePng, capWindows, output) {
  const d = dur(appClip);
  console.log(`  composite → ${path.basename(output)} (${d.toFixed(1)}s)`);

  const inputs = [];
  inputs.push('-loop','1','-framerate','25','-i', bgPng);       // 0
  inputs.push('-i', appClip);                                    // 1
  inputs.push('-loop','1','-framerate','25','-i', framePng);    // 2
  capWindows.forEach(cw => {
    inputs.push('-loop','1','-framerate','25','-i', cw.img);    // 3+
  });

  const f = [];

  // Normalize all streams
  f.push(`[0:v]scale=${W}:${H},setsar=1,fps=25,setpts=PTS-STARTPTS[bg]`);
  f.push(`[1:v]fps=25,setsar=1,setpts=PTS-STARTPTS[app]`);

  // App on background
  f.push(`[bg][app]overlay=x=${SCREEN_X}:y=${SCREEN_Y}:shortest=1[with_app]`);

  // Phone frame (alpha-aware) on top — also adds a subtle green glow scan line
  f.push(`[2:v]scale=${W}:${H},setsar=1,fps=25,setpts=PTS-STARTPTS[frame]`);
  f.push(`[with_app][frame]overlay=x=0:y=0:format=auto:shortest=1[framed]`);

  // Caption overlays — FIXED: format=auto, enable without \, escaping
  let prev = 'framed';
  capWindows.forEach((cw, i) => {
    const idxIn  = i + 3;
    const isLast = i === capWindows.length - 1;
    const idxOut = isLast ? 'final' : `ov${i}`;
    f.push(
      `[${prev}][${idxIn}:v]` +
      `overlay=x=0:y=${CAP_Y}:format=auto:shortest=1:` +
      `enable='between(t,${cw.start},${cw.end})'` +
      `[${idxOut}]`
    );
    prev = idxOut;
  });

  if (capWindows.length === 0) {
    f.push(`[framed]setpts=PTS[final]`);
  }

  ffrun([
    ...inputs,
    '-filter_complex', f.join(';'),
    '-map','[final]',
    '-t', `${d}`,
    '-c:v','libx264','-preset','fast','-crf','20','-an',
    output,
  ]);
  if (fs.existsSync(output)) {
    console.log(`  ✓ ${path.basename(output)} — ${dur(output).toFixed(1)}s`);
  }
}

// ── Static PNG → timed video (for fallback hero cards) ───────────────────────
function pngToVideo(pngPath, output, seconds) {
  console.log(`  png→video ${path.basename(pngPath)} (${seconds}s)`);
  ffrun([
    '-loop','1','-framerate','25','-i', pngPath,
    '-t', `${seconds}`,
    '-vf', `scale=${W}:${H},setsar=1,fps=25,` +
           `fade=t=in:st=0:d=0.5,fade=t=out:st=${seconds - 0.6}:d=0.6`,
    '-c:v','libx264','-preset','fast','-crf','20','-an', output,
  ]);
}

// ── ANIMATED CARD: Playwright recordVideo + CSS animations → MP4 ─────────────
async function renderAnimatedCard(browser, htmlContent, output, seconds) {
  console.log(`  animated card → ${path.basename(output)} (${seconds}s via recordVideo)`);
  const vidDir = path.join(TMP, `rec_${path.basename(output, '.mp4')}`);
  fs.mkdirSync(vidDir, { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: vidDir, size: { width: W, height: H } },
  });
  const page = await ctx.newPage();
  await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(seconds * 1000 + 300); // slight overshoot
  await page.close();
  await ctx.close(); // saves video

  const files = fs.readdirSync(vidDir).filter(f => f.endsWith('.webm'));
  if (!files.length) { console.warn('  recordVideo produced no file, using static fallback'); return false; }

  const webm = path.join(vidDir, files[0]);
  const ok = ffrun([
    '-i', webm,
    '-vf', `fps=25,scale=${W}:${H},setpts=PTS-STARTPTS,` +
           `fade=t=in:st=0:d=0.3,fade=t=out:st=${seconds - 0.5}:d=0.5`,
    '-t', `${seconds}`,
    '-c:v','libx264','-preset','fast','-crf','20','-an',
    output,
  ]);
  if (ok) console.log(`  ✓ animated card — ${dur(output).toFixed(1)}s`);
  return ok;
}

// ── Cross-fade / wipe transition ─────────────────────────────────────────────
function crossfade(a, b, output, td = 0.6, transition = 'fade') {
  const da = dur(a);
  if (!da) { fs.copyFileSync(b, output); return; }
  const offset = Math.max(0, da - td).toFixed(3);
  console.log(`  ${transition}: ${path.basename(a)}(${da.toFixed(1)}s)+${path.basename(b)} @${offset}`);
  const ok = ffrun([
    '-i', a, '-i', b,
    '-filter_complex',
    `[0:v][1:v]xfade=transition=${transition}:duration=${td}:offset=${offset}[v]`,
    '-map','[v]',
    '-c:v','libx264','-preset','fast','-crf','20','-an', output,
  ]);
  if (!ok) {
    console.warn(`  ${transition} failed → fade`);
    ffrun(['-i', a, '-i', b,
      '-filter_complex',
      `[0:v][1:v]xfade=transition=fade:duration=${td}:offset=${offset}[v]`,
      '-map','[v]','-c:v','libx264','-preset','fast','-crf','20','-an', output]);
  }
  if (fs.existsSync(output)) console.log(`    ✓ ${path.basename(output)} — ${dur(output).toFixed(1)}s`);
}

function concatAll(segs, output) {
  let cur = segs[0].file;
  for (let i = 1; i < segs.length; i++) {
    const { file, transition = 'fade' } = segs[i];
    const isLast = i === segs.length - 1;
    const out = isLast ? output : tmp(`xf${i}.mp4`);
    crossfade(cur, file, out, 0.6, transition);
    cur = out;
  }
}

// ── Ambient audio — FIXED: volume 0.4, no aggressive lowpass ─────────────────
function genAudio(output, seconds) {
  console.log(`  generating audio (${seconds.toFixed(0)}s)`);
  ffrun([
    '-f','lavfi','-i',`sine=frequency=55:sample_rate=44100:duration=${seconds}`,
    '-f','lavfi','-i',`sine=frequency=110:sample_rate=44100:duration=${seconds}`,
    '-f','lavfi','-i',`sine=frequency=165:sample_rate=44100:duration=${seconds}`,
    '-f','lavfi','-i',`sine=frequency=220:sample_rate=44100:duration=${seconds}`,
    '-f','lavfi','-i',`sine=frequency=330:sample_rate=44100:duration=${seconds}`,
    '-filter_complex',
    '[0][1][2][3][4]amix=inputs=5:duration=first,' +
    'volume=0.4,' +                      // was 0.06 — now actually audible
    `afade=t=in:st=0:d=3,afade=t=out:st=${seconds - 3}:d=3`,
    '-c:a','aac','-ar','44100','-b:a','128k', output,
  ]);
}
function addAudio(videoIn, audioIn, output) {
  console.log('  mixing audio');
  ffrun(['-i', videoIn, '-i', audioIn,
    '-c:v','copy','-c:a','aac','-shortest',
    '-map','0:v','-map','1:a', output]);
}

// ── Playwright: Phone device frame (SVG with transparent screen hole) ─────────
async function renderPhoneFrame(browser, outputPath) {
  console.log('  rendering phone frame…');
  const ctx  = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const px = PHONE_X, py = PHONE_Y, pw = PHONE_W, ph = PHONE_H;
  const sx = SCREEN_X, sy = SCREEN_Y, sw = SCREEN_W, sh = SCREEN_H;

  await page.setContent(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <style>* { margin:0;padding:0 } body { width:${W}px;height:${H}px;background:transparent }</style>
  </head><body>
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <mask id="cutout">
        <rect width="${W}" height="${H}" fill="white"/>
        <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="36" ry="36" fill="black"/>
      </mask>
      <linearGradient id="body-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stop-color="#2a2a2a"/>
        <stop offset="45%"  stop-color="#1c1c1c"/>
        <stop offset="100%" stop-color="#141414"/>
      </linearGradient>
      <linearGradient id="rim-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#484848"/>
        <stop offset="100%" stop-color="#262626"/>
      </linearGradient>
      <filter id="shadow" x="-15%" y="-5%" width="130%" height="115%">
        <feDropShadow dx="0" dy="20" stdDeviation="45" flood-color="#000000" flood-opacity="0.75"/>
      </filter>
      <!-- Green screen edge glow -->
      <filter id="screen-glow">
        <feGaussianBlur stdDeviation="8" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <!-- Shadow -->
    <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="68" ry="68"
          fill="#000" opacity="0" filter="url(#shadow)"/>
    <!-- Phone body -->
    <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="68" ry="68"
          fill="url(#body-grad)" mask="url(#cutout)"/>
    <!-- Rim highlight -->
    <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="68" ry="68"
          fill="none" stroke="url(#rim-grad)" stroke-width="2.5"/>
    <!-- Screen inner glow edge -->
    <rect x="${sx - 2}" y="${sy - 2}" width="${sw + 4}" height="${sh + 4}" rx="38" ry="38"
          fill="none" stroke="rgba(52,211,153,0.25)" stroke-width="3"
          filter="url(#screen-glow)"/>
    <!-- Dynamic Island -->
    <rect x="${Math.round(px + pw/2 - 55)}" y="${py + 24}" width="110" height="32" rx="16" ry="16"
          fill="#0a0a0a"/>
    <!-- Camera dot -->
    <circle cx="${Math.round(px + pw/2 + 30)}" cy="${py + 40}" r="5.5" fill="#181818"/>
    <!-- Home bar -->
    <rect x="${Math.round(px + pw/2 - 100)}" y="${py + ph - 48}"
          width="200" height="5" rx="2.5" ry="2.5" fill="rgba(255,255,255,0.22)"/>
    <!-- Side buttons -->
    <rect x="${px - 5}" y="${py + 240}" width="7" height="40" rx="3" fill="#252525"/>
    <rect x="${px - 5}" y="${py + 320}" width="7" height="80" rx="3" fill="#252525"/>
    <rect x="${px - 5}" y="${py + 440}" width="7" height="80" rx="3" fill="#252525"/>
    <rect x="${px + pw - 2}" y="${py + 380}" width="7" height="130" rx="3" fill="#252525"/>
    <!-- Left edge highlight -->
    <line x1="${px + 1}" y1="${py + 100}" x2="${px + 1}" y2="${py + ph - 100}"
          stroke="rgba(255,255,255,0.05)" stroke-width="2"/>
  </svg>
  </body></html>`);

  await page.screenshot({ path: outputPath, type: 'png', omitBackground: true });
  await ctx.close();
  console.log(`  ✓ phone_frame.png`);
}

// ── Playwright: Environment background ───────────────────────────────────────
async function renderBackground(browser, outputPath) {
  console.log('  rendering background…');
  const ctx  = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  await page.setContent(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <style>
      * { margin:0;padding:0;box-sizing:border-box }
      body {
        width:${W}px; height:${H}px; overflow:hidden; position:relative;
        background: radial-gradient(ellipse 70% 55% at 50% 36%,
          rgba(52,211,153,0.10) 0%, rgba(16,40,20,0.60) 40%, #050905 100%);
        background-color: #060b06;
      }
      .grid {
        position:absolute; inset:0;
        background-image: radial-gradient(circle, rgba(52,211,153,0.07) 1px, transparent 1px);
        background-size: 54px 54px;
      }
      .glow {
        position:absolute; top:-120px; left:50%; transform:translateX(-50%);
        width:800px; height:800px; border-radius:50%;
        background: radial-gradient(circle, rgba(52,211,153,0.16) 0%, transparent 65%);
      }
      .vignette {
        position:absolute; inset:0;
        background: radial-gradient(ellipse 100% 60% at 50% 100%,
          rgba(0,0,0,0.6) 0%, transparent 70%);
      }
      .brand {
        position:absolute; top:0; left:0; width:100%; height:${PHONE_Y}px;
        display:flex; align-items:center; justify-content:center; gap:10px;
      }
      .brand-dot { width:9px; height:9px; border-radius:50%; background:#34d399; }
      .brand-name {
        font-family: -apple-system,'Helvetica Neue',Arial,sans-serif;
        font-size:26px; font-weight:700; color:rgba(255,255,255,0.65); letter-spacing:1px;
      }
      .accent-line {
        position:absolute; top:${PHONE_Y - 1}px; left:50%; transform:translateX(-50%);
        width:120px; height:1px;
        background: linear-gradient(90deg, transparent, rgba(52,211,153,0.5), transparent);
      }
    </style>
  </head><body>
    <div class="grid"></div>
    <div class="glow"></div>
    <div class="vignette"></div>
    <div class="brand">
      <div class="brand-dot"></div>
      <div class="brand-name">TableTap</div>
    </div>
    <div class="accent-line"></div>
  </body></html>`);
  await page.screenshot({ path: outputPath, type: 'png' });
  await ctx.close();
  console.log(`  ✓ bg.png`);
}

// ── Playwright: Caption PNG (transparent background) ─────────────────────────
async function renderCaption(browser, headline, sub, outputPath) {
  const ctx  = await browser.newContext({ viewport: { width: W, height: CAP_H } });
  const page = await ctx.newPage();
  await page.setContent(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <style>
      * { margin:0;padding:0;box-sizing:border-box }
      body {
        width:${W}px; height:${CAP_H}px;
        display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        gap:12px; padding:0 60px;
        background:transparent;
      }
      .hl {
        font-family: -apple-system,'Helvetica Neue',Arial,sans-serif;
        font-size:54px; font-weight:900; color:#34d399;
        text-align:center; line-height:1.08; letter-spacing:-0.5px;
        text-shadow: 0 0 40px rgba(52,211,153,0.6), 0 0 80px rgba(52,211,153,0.3);
      }
      .sub {
        font-family: -apple-system,'Helvetica Neue',Arial,sans-serif;
        font-size:30px; font-weight:400; color:rgba(255,255,255,0.72);
        text-align:center; line-height:1.3;
      }
    </style>
  </head><body>
    <div class="hl">${headline}</div>
    ${sub ? `<div class="sub">${sub}</div>` : ''}
  </body></html>`);
  await page.screenshot({ path: outputPath, type: 'png', omitBackground: true });
  await ctx.close();
}

// ── Hook card HTML (animated, 5s) ─────────────────────────────────────────────
function hookCardHtml() {
  return `<!DOCTYPE html><html><head>
  <meta charset="UTF-8">
  <style>
    @keyframes fadeInUp {
      from { opacity:0; transform:translateY(50px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes pulseGlow {
      0%,100% { text-shadow:0 0 50px rgba(52,211,153,0.5); }
      50%      { text-shadow:0 0 100px rgba(52,211,153,0.9), 0 0 160px rgba(52,211,153,0.4); }
    }
    @keyframes gridShift {
      from { background-position:0 0; }
      to   { background-position:54px 54px; }
    }
    @keyframes orbPulse {
      0%,100% { opacity:1; transform:translateX(-50%) scale(1); }
      50%      { opacity:0.7; transform:translateX(-50%) scale(1.1); }
    }
    * { margin:0;padding:0;box-sizing:border-box }
    body {
      width:1080px; height:1920px; overflow:hidden; position:relative;
      background: radial-gradient(ellipse 70% 55% at 50% 42%,
        rgba(52,211,153,0.11) 0%, rgba(10,25,12,0.9) 50%, #030603 100%);
      background-color:#040804;
      display:flex; align-items:center; justify-content:center;
    }
    .grid {
      position:absolute; inset:0;
      background-image: radial-gradient(circle, rgba(52,211,153,0.07) 1px, transparent 1px);
      background-size:54px 54px;
      animation: gridShift 8s linear infinite;
    }
    .orb {
      position:absolute; top:-200px; left:50%;
      width:1000px; height:1000px; border-radius:50%;
      background: radial-gradient(circle, rgba(52,211,153,0.16) 0%, transparent 65%);
      animation: orbPulse 3s ease-in-out infinite;
    }
    .topbar {
      position:absolute; top:0; left:50%; transform:translateX(-50%);
      width:200px; height:3px;
      background:linear-gradient(90deg, transparent, #34d399, transparent);
      animation:fadeInUp 0.5s ease 0.1s both;
    }
    .content {
      position:relative; z-index:1;
      display:flex; flex-direction:column; align-items:center; gap:28px;
    }
    .tag {
      font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
      font-size:28px; font-weight:700; color:#34d399; letter-spacing:7px;
      text-transform:uppercase;
      border:1.5px solid rgba(52,211,153,0.4); padding:12px 40px; border-radius:100px;
      animation:fadeInUp 0.6s ease 0.3s both;
    }
    .h1 {
      font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
      font-size:96px; font-weight:900; color:#fff;
      text-align:center; line-height:1.08; padding:0 60px;
      animation:fadeInUp 0.65s ease 0.65s both;
    }
    .h1-accent {
      display:block; color:#34d399;
      animation:fadeInUp 0.65s ease 0.9s both, pulseGlow 2.5s ease 2s infinite;
    }
    .sub {
      font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
      font-size:46px; font-weight:400; color:rgba(255,255,255,0.65);
      text-align:center; padding:0 80px;
      animation:fadeInUp 0.6s ease 1.3s both;
    }
    .dots { display:flex;gap:10px;margin-top:8px;animation:fadeInUp 0.5s ease 1.7s both; }
    .dot  { width:8px;height:8px;border-radius:50%;background:#34d399;opacity:0.5; }
  </style>
</head><body>
  <div class="grid"></div>
  <div class="orb"></div>
  <div class="topbar"></div>
  <div class="content">
    <div class="tag">TableTap</div>
    <div class="h1">Your café is losing orders<span class="h1-accent">every single day.</span></div>
    <div class="sub">There's a smarter way.</div>
    <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
  </div>
</body></html>`;
}

// ── CTA card HTML (animated, 7s) ──────────────────────────────────────────────
function ctaCardHtml() {
  return `<!DOCTYPE html><html><head>
  <meta charset="UTF-8">
  <style>
    @keyframes fadeInUp {
      from { opacity:0; transform:translateY(50px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    @keyframes urlPulse {
      0%,100% { text-shadow:0 0 40px rgba(52,211,153,0.5); opacity:1; }
      50%      { text-shadow:0 0 90px rgba(52,211,153,1), 0 0 150px rgba(52,211,153,0.5); opacity:0.9; }
    }
    @keyframes gridShift {
      from { background-position:0 0; }
      to   { background-position:80px 80px; }
    }
    * { margin:0;padding:0;box-sizing:border-box }
    body {
      width:1080px; height:1920px; overflow:hidden; position:relative;
      background: radial-gradient(ellipse 60% 50% at 50% 42%,
        rgba(52,211,153,0.12) 0%, rgba(10,25,12,0.85) 50%, #030603 100%);
      background-color:#040804;
      display:flex; align-items:center; justify-content:center;
    }
    body::before {
      content:''; position:absolute; inset:0;
      background-image:
        linear-gradient(rgba(52,211,153,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(52,211,153,0.04) 1px, transparent 1px);
      background-size:80px 80px;
      animation: gridShift 12s linear infinite;
    }
    .topbar {
      position:absolute; top:0; left:50%; transform:translateX(-50%);
      width:220px; height:3px;
      background:linear-gradient(90deg, transparent, #34d399, transparent);
    }
    .content {
      position:relative; z-index:1;
      display:flex; flex-direction:column; align-items:center; gap:22px;
    }
    .brand { font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
      font-size:120px; font-weight:900; color:#fff; letter-spacing:-3px;
      animation:fadeInUp 0.7s ease 0.2s both; }
    .tagline { font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
      font-size:58px; font-weight:700; color:#34d399;
      text-shadow:0 0 50px rgba(52,211,153,0.4);
      animation:fadeInUp 0.65s ease 0.65s both; }
    .features { font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
      font-size:30px; font-weight:400; color:rgba(255,255,255,0.45); letter-spacing:4px;
      animation:fadeInUp 0.55s ease 1.1s both; }
    .divider {
      width:160px; height:2px;
      background:linear-gradient(90deg, transparent, rgba(52,211,153,0.4), transparent);
      animation:fadeIn 0.5s ease 1.5s both;
    }
    .url { font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
      font-size:60px; font-weight:800; color:#34d399;
      animation:fadeInUp 0.65s ease 1.8s both, urlPulse 2s ease 3s infinite; }
    .cta { font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
      font-size:34px; font-weight:400; color:rgba(255,255,255,0.55);
      animation:fadeInUp 0.55s ease 2.3s both; }
  </style>
</head><body>
  <div class="topbar"></div>
  <div class="content">
    <div class="brand">TableTap</div>
    <div class="tagline">One QR. Full control.</div>
    <div class="features">ORDERS · INSIGHTS · PAYMENTS</div>
    <div class="divider"></div>
    <div class="url">tabletap.dev</div>
    <div class="cta">Start for free today</div>
  </div>
</body></html>`;
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  // Clean stale xf files
  ['xf1','xf2','xf3','xf4','xf5'].forEach(n => {
    const f = tmp(n + '.mp4');
    if (fs.existsSync(f)) { fs.unlinkSync(f); }
  });

  const browser = await chromium.launch({ headless: true });

  console.log('='.repeat(60));
  console.log('  TableTap Reel Compiler  v3-fixed  (Animated Mockup)');
  console.log('='.repeat(60));

  const SRC = {
    qr:        path.join(CLIPS, 'clip4_qr.webm'),
    customer:  path.join(CLIPS, 'clip1_customer.webm'),
    dashboard: path.join(CLIPS, 'clip2_dashboard.webm'),
    insights:  path.join(CLIPS, 'clip3_insights.webm'),
  };

  // ── Shared assets ───────────────────────────────────────────────────────
  console.log('\n── Rendering shared assets');
  await renderBackground(browser, img('bg.png'));
  await renderPhoneFrame(browser, img('phone_frame.png'));

  // ── Seg 0: Animated hook title card (5s) ────────────────────────────────
  console.log('\n── Seg 0: Hook (animated)');
  const hook0ok = await renderAnimatedCard(browser, hookCardHtml(), tmp('seg0.mp4'), 5);
  if (!hook0ok) {
    // fallback to static
    const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    const p = await ctx.newPage();
    await p.setContent(hookCardHtml(), { waitUntil: 'domcontentloaded' });
    await p.screenshot({ path: img('card_hook.png'), type: 'png' });
    await ctx.close();
    pngToVideo(img('card_hook.png'), tmp('seg0.mp4'), 5);
  }

  // ── Seg 1: QR landing (13s, 1.50× zoom) ─────────────────────────────────
  console.log('\n── Seg 1: QR landing');
  convertClip(SRC.qr, tmp('seg1_app.mp4'), 0, 13);
  zoomClip(tmp('seg1_app.mp4'), tmp('seg1_z.mp4'), 1.50, 0.5, 0.42);

  const cap1 = [
    { text:'SCAN. MENU. INSTANT.',           sub:'No app download. No login. Zero friction.',  start:0.5, end:6.5  },
    { text:'60+ DISHES AT THEIR FINGERTIPS', sub:'Live-updated from your dashboard.',           start:7.0, end:13.0 },
  ];
  for (let i = 0; i < cap1.length; i++)
    await renderCaption(browser, cap1[i].text, cap1[i].sub, img(`c1_${i}.png`));
  compositePhoneScene(tmp('seg1_z.mp4'), img('bg.png'), img('phone_frame.png'),
    cap1.map((c, i) => ({ img: img(`c1_${i}.png`), start: c.start, end: c.end })),
    tmp('seg1.mp4'));

  // ── Seg 2: Customer ordering (17s, no zoom — scroll motion already there) ─
  console.log('\n── Seg 2: Customer ordering');
  convertClip(SRC.customer, tmp('seg2_app.mp4'), 0, 17);

  const cap2 = [
    { text:'TAP. ADD. ORDER.',    sub:'Cart updates live with every tap.',           start:0.5,  end:5.5  },
    { text:'CASH OR UPI',         sub:'Guest\'s choice. No extra hardware needed.',  start:6.0,  end:11.5 },
    { text:'ORDER PLACED ✓',      sub:'Kitchen gets notified instantly.',             start:12.0, end:17.0 },
  ];
  for (let i = 0; i < cap2.length; i++)
    await renderCaption(browser, cap2[i].text, cap2[i].sub, img(`c2_${i}.png`));
  compositePhoneScene(tmp('seg2_app.mp4'), img('bg.png'), img('phone_frame.png'),
    cap2.map((c, i) => ({ img: img(`c2_${i}.png`), start: c.start, end: c.end })),
    tmp('seg2.mp4'));

  // ── Seg 3: Dashboard (15s, 1.35× zoom) ───────────────────────────────────
  console.log('\n── Seg 3: Dashboard');
  convertClip(SRC.dashboard, tmp('seg3_app.mp4'), 2, 15);
  zoomClip(tmp('seg3_app.mp4'), tmp('seg3_z.mp4'), 1.35, 0.5, 0.38);

  const cap3 = [
    { text:'LIVE ORDERS. ZERO CHAOS.',  sub:'Every table, every order — one screen.',  start:0.5, end:7.5  },
    { text:'REAL-TIME. ALWAYS.',         sub:'Auto-refreshes every 8 seconds.',          start:8.0, end:15.0 },
  ];
  for (let i = 0; i < cap3.length; i++)
    await renderCaption(browser, cap3[i].text, cap3[i].sub, img(`c3_${i}.png`));
  compositePhoneScene(tmp('seg3_z.mp4'), img('bg.png'), img('phone_frame.png'),
    cap3.map((c, i) => ({ img: img(`c3_${i}.png`), start: c.start, end: c.end })),
    tmp('seg3.mp4'));

  // ── Seg 4: AI Insights (21s, 1.55× zoom — the main USP) ──────────────────
  console.log('\n── Seg 4: AI Insights (USP)');
  convertClip(SRC.insights, tmp('seg4_app.mp4'), 1, 21);
  zoomClip(tmp('seg4_app.mp4'), tmp('seg4_z.mp4'), 1.55, 0.5, 0.40);

  const cap4 = [
    { text:'AI INSIGHTS',                  sub:'Your café data — understood automatically.',  start:0.5,  end:5.5  },
    { text:'₹1,24,500 IN 28 DAYS',        sub:'Revenue tracked. Zero spreadsheets.',          start:6.0,  end:11.0 },
    { text:'PEAK HOURS. BESTSELLERS.',     sub:'Know exactly what\'s working and when.',       start:11.5, end:16.5 },
    { text:'#1 CARBONARA RAMYUN: 87 SOLD',sub:'AI-detected. No guessing. Ever.',               start:17.0, end:21.0 },
  ];
  for (let i = 0; i < cap4.length; i++)
    await renderCaption(browser, cap4[i].text, cap4[i].sub, img(`c4_${i}.png`));
  compositePhoneScene(tmp('seg4_z.mp4'), img('bg.png'), img('phone_frame.png'),
    cap4.map((c, i) => ({ img: img(`c4_${i}.png`), start: c.start, end: c.end })),
    tmp('seg4.mp4'));

  // ── Seg 5: Animated CTA (7s) ─────────────────────────────────────────────
  console.log('\n── Seg 5: CTA (animated)');
  const cta0ok = await renderAnimatedCard(browser, ctaCardHtml(), tmp('seg5.mp4'), 7);
  if (!cta0ok) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    const p = await ctx.newPage();
    await p.setContent(ctaCardHtml(), { waitUntil: 'domcontentloaded' });
    await p.screenshot({ path: img('card_cta.png'), type: 'png' });
    await ctx.close();
    pngToVideo(img('card_cta.png'), tmp('seg5.mp4'), 7);
  }

  // ── Durations ────────────────────────────────────────────────────────────
  const segs = ['seg0','seg1','seg2','seg3','seg4','seg5'];
  console.log('\n── Segment durations:');
  segs.forEach(s => console.log(`    ${s}: ${dur(tmp(s+'.mp4')).toFixed(1)}s`));

  // ── Concatenate with varied transitions ──────────────────────────────────
  console.log('\n── Concatenating');
  concatAll([
    { file: tmp('seg0.mp4'), transition: 'fade'      },
    { file: tmp('seg1.mp4'), transition: 'wipeup'    },
    { file: tmp('seg2.mp4'), transition: 'slideleft' },
    { file: tmp('seg3.mp4'), transition: 'wipeleft'  },
    { file: tmp('seg4.mp4'), transition: 'smoothup'  },
    { file: tmp('seg5.mp4'), transition: 'fade'      },
  ], tmp('video_silent.mp4'));

  // ── Audio ─────────────────────────────────────────────────────────────────
  const totalDur = dur(tmp('video_silent.mp4'));
  console.log(`\n   Video duration: ${totalDur.toFixed(1)}s`);
  genAudio(tmp('ambient3.aac'), totalDur + 1);
  addAudio(tmp('video_silent.mp4'), tmp('ambient3.aac'), OUT);

  await browser.close();

  const stat = fs.statSync(OUT);
  console.log('\n' + '='.repeat(60));
  console.log(`✅  tabletap-reel-v3.mp4  (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`   ${OUT}`);
  console.log('='.repeat(60));
  console.log('\n📌  Add real music (royalty-free: Pixabay, YouTube Audio Library):');
  console.log('    ffmpeg -i tabletap-reel-v3.mp4 -i track.mp3 \\');
  console.log('           -c:v copy -c:a aac -shortest \\');
  console.log('           -map 0:v -map 1:a -af "volume=0.8" tabletap-final.mp4');
}

main().catch(err => { console.error(err); process.exit(1); });
