/**
 * TableTap – Reel Compiler v3  (Phone Mockup Edition)
 *
 * What's new vs v2:
 *   • App recordings rendered inside an iPhone-style device frame
 *   • Dark green-glow gradient environment (not plain black)
 *   • ALLCAPS kinetic captions positioned BELOW the phone (not overlaid on app)
 *   • Feature "pill" callouts for key USPs
 *   • Variety of xfade transitions per segment
 *   • Redesigned hero/CTA cards with grid + glow aesthetic
 *   • Ken Burns zoom operates at screen resolution (faster)
 *   • Better ambient audio (5-voice chord stack)
 *
 * Usage:  node compile2.js
 * Output: ./tabletap-reel-v3.mp4
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

// ── Output canvas ────────────────────────────────────────────────────────────
const W = 1080, H = 1920;

// ── Phone frame geometry ─────────────────────────────────────────────────────
// App clip native: 390 × 844  (aspect 2.1641)
// Scale to screen: 640 × 1386 (640/390*844 = 1385.3 ≈ 1386)
const SCREEN_W = 640,  SCREEN_H = 1386;
const BEZEL_H  = 85,   BEZEL_B  = 75,  BEZEL_S = 38;
const PHONE_W  = SCREEN_W + BEZEL_S * 2;        // 716
const PHONE_H  = SCREEN_H + BEZEL_H + BEZEL_B;  // 1546
const PHONE_X  = Math.round((W - PHONE_W) / 2); // 182
const PHONE_Y  = 100;
const SCREEN_X = PHONE_X + BEZEL_S;             // 220
const SCREEN_Y = PHONE_Y + BEZEL_H;             // 185

// ── Caption zone (below phone) ───────────────────────────────────────────────
const CAP_Y = PHONE_Y + PHONE_H + 14;           // 1660
const CAP_H = H - CAP_Y - 10;                   // 250

// ── Branding zone (above phone) ──────────────────────────────────────────────
const BRAND_H = PHONE_Y;                         // 100

// ─────────────────────────────────────────────────────────────────────────────
// ffmpeg helpers
// ─────────────────────────────────────────────────────────────────────────────
function ffrun(args) {
  const result = spawnSync('ffmpeg', ['-y', ...args], {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const errs = (result.stderr || '')
      .split('\n')
      .filter(l => /error|invalid|failed/i.test(l))
      .slice(0, 3);
    if (errs.length) console.warn('  ffmpeg:', errs.join('\n  '));
  }
  return result.status === 0;
}

function dur(file) {
  const r = spawnSync('ffprobe', [
    '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ], { encoding: 'utf8' });
  return parseFloat(r.stdout.trim()) || 0;
}

function tmp(n) { return path.join(TMP, n); }
function img(n) { return path.join(IMG, n); }

// ─────────────────────────────────────────────────────────────────────────────
// Convert WebM → screen-resolution MP4 (640 × 1386, trimmed)
// ─────────────────────────────────────────────────────────────────────────────
function convertClip(input, output, start, length) {
  console.log(`  convert ${path.basename(input)} [${start}s–${start + length}s]`);
  ffrun([
    '-ss', `${start}`, '-t', `${length}`, '-i', input,
    '-vf', `scale=${SCREEN_W}:${SCREEN_H}:force_original_aspect_ratio=increase,` +
           `crop=${SCREEN_W}:${SCREEN_H}`,
    '-r', '25',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-an', output,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ken Burns zoom (scale+eval+crop, no VFR issues) on screen-res clip
// ─────────────────────────────────────────────────────────────────────────────
function zoomClip(input, output, zTarget = 1.15, cx = 0.5, cy = 0.45) {
  const d = dur(input);
  if (!d) { fs.copyFileSync(input, output); return; }
  const dStr = d.toFixed(3);
  const dW = (SCREEN_W * (zTarget - 1)).toFixed(2);
  const dH = (SCREEN_H * (zTarget - 1)).toFixed(2);
  const wS  = `trunc((${SCREEN_W}+${dW}*t/${dStr})/2)*2`;
  const hS  = `trunc((${SCREEN_H}+${dH}*t/${dStr})/2)*2`;
  console.log(`  zoom ${path.basename(input)} → ${zTarget}×`);
  const ok = ffrun([
    '-i', input,
    '-vf', `fps=25,scale='${wS}':'${hS}':eval=frame,` +
           `crop=${SCREEN_W}:${SCREEN_H}:(in_w-${SCREEN_W})*${cx}:(in_h-${SCREEN_H})*${cy}`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-an', output,
  ]);
  if (!ok) { console.warn('  zoom failed — copying'); fs.copyFileSync(input, output); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite: bg.png + app clip (at screen position) + phone_frame.png + captions
// Output: full 1080 × 1920 at 25fps
// ─────────────────────────────────────────────────────────────────────────────
function compositePhoneScene(appClip, bgPng, framePng, capWindows, output) {
  const d = dur(appClip);
  console.log(`  composite phone scene → ${path.basename(output)} (${d.toFixed(1)}s)`);

  const inputs = [];
  // 0: background (looped still)
  inputs.push('-loop', '1', '-framerate', '25', '-i', bgPng);
  // 1: app clip (already SCREEN_W × SCREEN_H)
  inputs.push('-i', appClip);
  // 2: phone frame (looped, with alpha for transparent screen hole)
  inputs.push('-loop', '1', '-framerate', '25', '-i', framePng);
  // 3+: captions (looped stills)
  capWindows.forEach(cw => {
    inputs.push('-loop', '1', '-framerate', '25', '-i', cw.img);
  });

  const f = [];

  // Scale + fps-lock background
  f.push(`[0:v]scale=${W}:${H},setsar=1,fps=25[bg]`);
  // Lock app clip fps
  f.push(`[1:v]fps=25,setsar=1[app]`);
  // Overlay app onto background at screen coordinates
  f.push(`[bg][app]overlay=x=${SCREEN_X}:y=${SCREEN_Y}[with_app]`);
  // Scale phone frame and overlay (alpha-aware) on top
  f.push(`[2:v]scale=${W}:${H},setsar=1,fps=25[frame]`);
  f.push(`[with_app][frame]overlay=x=0:y=0:format=auto[framed]`);

  // Chain caption overlays (positioned in CAP zone below phone)
  let prev = 'framed';
  capWindows.forEach((cw, i) => {
    const idxIn  = i + 3;
    const idxOut = i < capWindows.length - 1 ? `ov${i}` : 'final';
    // Scale caption PNG to full width, position at CAP_Y
    f.push(
      `[${prev}][${idxIn}:v]` +
      `overlay=x=0:y=${CAP_Y}:enable='between(t\\,${cw.start}\\,${cw.end})'` +
      `[${idxOut}]`
    );
    prev = idxOut;
  });

  if (capWindows.length === 0) {
    // Rename framed → final by using setpts passthrough
    f.push(`[framed]setpts=PTS[final]`);
  }

  ffrun([
    ...inputs,
    '-filter_complex', f.join(';'),
    '-map', '[final]',
    '-t', `${d}`,
    '-r', '25',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-an',
    output,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Loop a full-frame PNG into a video clip
// ─────────────────────────────────────────────────────────────────────────────
function pngToVideo(pngPath, output, seconds) {
  console.log(`  png→video ${path.basename(pngPath)} (${seconds}s)`);
  ffrun([
    '-loop', '1', '-framerate', '25', '-i', pngPath,
    '-t', `${seconds}`,
    '-vf', `scale=${W}:${H},setsar=1,` +
           `fade=t=in:st=0:d=0.5,fade=t=out:st=${seconds - 0.6}:d=0.6`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-an', output,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-fade / wipe transition between two clips
// ─────────────────────────────────────────────────────────────────────────────
function crossfade(a, b, output, td = 0.5, transition = 'fade') {
  const da = dur(a);
  if (!da) { fs.copyFileSync(b, output); return; }
  const offset = Math.max(0, da - td).toFixed(3);
  console.log(`  ${transition}: ${path.basename(a)}(${da.toFixed(1)}s)+${path.basename(b)} @${offset}`);
  const ok = ffrun([
    '-i', a, '-i', b,
    '-filter_complex',
    `[0:v][1:v]xfade=transition=${transition}:duration=${td}:offset=${offset}[v]`,
    '-map', '[v]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-an', output,
  ]);
  if (!ok) {
    // fallback to plain concat if xfade transition unsupported
    console.warn(`  xfade ${transition} failed, using fade`);
    ffrun(['-i', a, '-i', b,
      '-filter_complex',
      `[0:v][1:v]xfade=transition=fade:duration=${td}:offset=${offset}[v]`,
      '-map', '[v]',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-an', output]);
  }
  console.log(`    ✓ ${path.basename(output)} — ${dur(output).toFixed(1)}s`);
}

function concatAll(segs, output) {
  // segs: [{file, transition}]
  let cur = segs[0].file;
  for (let i = 1; i < segs.length; i++) {
    const { file, transition = 'fade' } = segs[i];
    const isLast = i === segs.length - 1;
    const out = isLast ? output : tmp(`xf${i}.mp4`);
    crossfade(cur, file, out, 0.5, transition);
    cur = out;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate ambient audio (5-voice chord for atmosphere)
// For production, replace with real music — see note at bottom.
// ─────────────────────────────────────────────────────────────────────────────
function genAudio(output, seconds) {
  console.log(`  generating audio (${seconds.toFixed(0)}s)`);
  ffrun([
    '-f', 'lavfi', '-i', `sine=frequency=55:sample_rate=44100:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=110:sample_rate=44100:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=165:sample_rate=44100:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=220:sample_rate=44100:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=330:sample_rate=44100:duration=${seconds}`,
    '-filter_complex',
    '[0][1][2][3][4]amix=inputs=5:duration=first,' +
    'volume=0.06,' +
    'lowpass=f=700,' +
    `afade=t=in:st=0:d=3,afade=t=out:st=${seconds - 3}:d=3`,
    '-c:a', 'aac', '-ar', '44100', '-b:a', '128k', output,
  ]);
}

function addAudio(videoIn, audioIn, output) {
  console.log('  mixing audio');
  ffrun(['-i', videoIn, '-i', audioIn,
    '-c:v', 'copy', '-c:a', 'aac', '-shortest',
    '-map', '0:v', '-map', '1:a', output]);
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYWRIGHT: Render phone device frame (SVG with transparent screen hole) → PNG
// The transparent screen lets the app clip show through when composited below.
// ─────────────────────────────────────────────────────────────────────────────
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
      <!-- Mask: everything visible EXCEPT the screen rectangle (which becomes transparent) -->
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
    </defs>

    <!-- Drop shadow layer (separate rect so shadow doesn't cut out) -->
    <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="68" ry="68"
          fill="#000" opacity="0" filter="url(#shadow)"/>

    <!-- Phone body (bezels) — screen hole is cut out via mask -->
    <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="68" ry="68"
          fill="url(#body-grad)" mask="url(#cutout)"/>

    <!-- Outer rim highlight -->
    <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="68" ry="68"
          fill="none" stroke="url(#rim-grad)" stroke-width="2.5"/>

    <!-- Screen inner edge (subtle glow on bezel lip) -->
    <rect x="${sx - 1}" y="${sy - 1}" width="${sw + 2}" height="${sh + 2}" rx="37" ry="37"
          fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="2"/>

    <!-- Dynamic Island -->
    <rect x="${Math.round(px + pw/2 - 55)}" y="${py + 24}" width="110" height="32" rx="16" ry="16"
          fill="#0a0a0a"/>
    <!-- Camera dot -->
    <circle cx="${Math.round(px + pw/2 + 30)}" cy="${py + 40}" r="5.5" fill="#181818"/>
    <!-- Sensor dot -->
    <circle cx="${Math.round(px + pw/2 + 30)}" cy="${py + 40}" r="2.5" fill="#111"/>

    <!-- Home bar indicator -->
    <rect x="${Math.round(px + pw/2 - 100)}" y="${py + ph - 48}"
          width="200" height="5" rx="2.5" ry="2.5"
          fill="rgba(255,255,255,0.22)"/>

    <!-- Left side: silent switch -->
    <rect x="${px - 5}" y="${py + 240}" width="7" height="40" rx="3" fill="#252525"/>
    <!-- Left side: volume up -->
    <rect x="${px - 5}" y="${py + 320}" width="7" height="80" rx="3" fill="#252525"/>
    <!-- Left side: volume down -->
    <rect x="${px - 5}" y="${py + 440}" width="7" height="80" rx="3" fill="#252525"/>
    <!-- Right side: power -->
    <rect x="${px + pw - 2}" y="${py + 380}" width="7" height="130" rx="3" fill="#252525"/>

    <!-- Left edge highlight (subtle) -->
    <line x1="${px + 1}" y1="${py + 100}" x2="${px + 1}" y2="${py + ph - 100}"
          stroke="rgba(255,255,255,0.05)" stroke-width="2"/>
  </svg>
  </body></html>`);

  await page.screenshot({ path: outputPath, type: 'png', omitBackground: true });
  await ctx.close();
  console.log(`  ✓ phone_frame.png`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYWRIGHT: Render environment background → PNG
// Dark green-glow gradient with dot grid
// ─────────────────────────────────────────────────────────────────────────────
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
      /* Dot grid */
      .grid {
        position:absolute; inset:0;
        background-image: radial-gradient(circle, rgba(52,211,153,0.07) 1px, transparent 1px);
        background-size: 54px 54px;
      }
      /* Top glow orb */
      .glow {
        position:absolute; top:-120px; left:50%; transform:translateX(-50%);
        width:700px; height:700px; border-radius:50%;
        background: radial-gradient(circle, rgba(52,211,153,0.14) 0%, transparent 68%);
      }
      /* Bottom vignette */
      .vignette {
        position:absolute; inset:0;
        background: radial-gradient(ellipse 100% 60% at 50% 100%,
          rgba(0,0,0,0.5) 0%, transparent 70%);
      }
      /* Branding zone — "TableTap" wordmark above phone */
      .brand {
        position:absolute; top:0; left:0; width:100%; height:${BRAND_H}px;
        display:flex; align-items:center; justify-content:center;
        gap:10px;
      }
      .brand-dot {
        width:9px; height:9px; border-radius:50%; background:#34d399;
      }
      .brand-name {
        font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
        font-size:26px; font-weight:700; color:rgba(255,255,255,0.65);
        letter-spacing:1px;
      }
      /* Green accent line bottom of brand zone */
      .accent-line {
        position:absolute; top:${BRAND_H - 1}px; left:50%;
        transform:translateX(-50%);
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

// ─────────────────────────────────────────────────────────────────────────────
// PLAYWRIGHT: Caption bar in the zone below the phone frame
// ALLCAPS headline (green) + subtitle (white/faded)
// ─────────────────────────────────────────────────────────────────────────────
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
        gap:10px; padding:0 70px;
        background:transparent;
      }
      .hl {
        font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
        font-size:50px; font-weight:800; color:#34d399;
        text-align:center; line-height:1.08;
        letter-spacing:-0.5px;
        text-shadow: 0 0 32px rgba(52,211,153,0.45);
      }
      .sub {
        font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
        font-size:28px; font-weight:400; color:rgba(255,255,255,0.68);
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

// ─────────────────────────────────────────────────────────────────────────────
// PLAYWRIGHT: Full-screen hero / title card
// Dark background, grid, glow, centered content
// ─────────────────────────────────────────────────────────────────────────────
async function renderHeroCard(browser, lines, outputPath) {
  const ctx  = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();

  const lineHtml = lines.map(l => {
    const { text = '', size = 72, color = '#fff', weight = 700, opacity = 1, tag = false } = l;
    if (!text) return `<div style="height:${size}px"></div>`;
    if (tag) return `
      <div style="
        font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
        font-size:${size}px;font-weight:700;color:#34d399;
        letter-spacing:5px;text-transform:uppercase;
        border:1.5px solid rgba(52,211,153,0.35);
        padding:10px 32px;border-radius:100px;
        margin-bottom:8px;
      ">${text}</div>`;
    return `<div style="
      font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
      font-size:${size}px;font-weight:${weight};color:${color};
      text-align:center;line-height:1.12;letter-spacing:-1px;
      padding:0 80px;opacity:${opacity};
      ${color === '#34d399' ? 'text-shadow:0 0 50px rgba(52,211,153,0.4);' : ''}
    ">${text}</div>`;
  }).join('');

  await page.setContent(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <style>
      * { margin:0;padding:0;box-sizing:border-box }
      body {
        width:${W}px; height:${H}px; overflow:hidden; position:relative;
        background: radial-gradient(ellipse 60% 50% at 50% 42%,
          rgba(52,211,153,0.11) 0%, rgba(10,25,12,0.8) 50%, #030603 100%);
        background-color: #040804;
        display:flex; align-items:center; justify-content:center;
      }
      /* Grid */
      body::before {
        content:''; position:absolute; inset:0;
        background-image:
          linear-gradient(rgba(52,211,153,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(52,211,153,0.04) 1px, transparent 1px);
        background-size:80px 80px;
      }
      /* Top accent bar */
      .topbar {
        position:absolute; top:0; left:50%; transform:translateX(-50%);
        width:180px; height:2px;
        background:linear-gradient(90deg, transparent, #34d399, transparent);
      }
      .content {
        position:relative; z-index:1;
        display:flex; flex-direction:column; align-items:center; gap:24px;
      }
      .dots { display:flex;gap:9px;margin-top:14px }
      .dot { width:7px;height:7px;border-radius:50%;background:#34d399;opacity:0.45 }
    </style>
  </head><body>
    <div class="topbar"></div>
    <div class="content">
      ${lineHtml}
      <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
    </div>
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
  console.log('  TableTap Reel Compiler  v3  (Phone Mockup Edition)');
  console.log(`  Screen zone:  ${SCREEN_X},${SCREEN_Y}  ${SCREEN_W}×${SCREEN_H}`);
  console.log(`  Caption zone: y=${CAP_Y}  h=${CAP_H}`);
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

  // ── Seg 0: Hook title card  (5s) ───────────────────────────────────────
  console.log('\n── Seg 0: Hook');
  await renderHeroCard(browser, [
    { text: 'TableTap',                  size: 36,  color: '#34d399', tag: true  },
    { text: 'Your café is losing orders', size: 90,  color: '#ffffff', weight: 900 },
    { text: 'every single day.',          size: 90,  color: '#34d399', weight: 900 },
    { text: '',                           size: 16                                  },
    { text: 'There\'s a smarter way.',   size: 46,  color: '#fff',    weight: 400, opacity: 0.7 },
  ], img('card_hook.png'));
  pngToVideo(img('card_hook.png'), tmp('seg0.mp4'), 5);

  // ── Seg 1: QR → Menu landing  (13s) ────────────────────────────────────
  console.log('\n── Seg 1: QR landing');
  convertClip(SRC.qr, tmp('seg1_app.mp4'), 0, 13);
  zoomClip(tmp('seg1_app.mp4'), tmp('seg1_z.mp4'), 1.14, 0.5, 0.42);

  const cap1 = [
    { text: 'SCAN. MENU. INSTANT.',           sub: 'No app download. No login. Zero friction.',  start: 0.5, end: 6.0  },
    { text: '60+ DISHES AT THEIR FINGERTIPS', sub: 'Live-updated from your dashboard.',           start: 6.3, end: 13.0 },
  ];
  for (let i = 0; i < cap1.length; i++) {
    await renderCaption(browser, cap1[i].text, cap1[i].sub, img(`c1_${i}.png`));
  }
  compositePhoneScene(tmp('seg1_z.mp4'), img('bg.png'), img('phone_frame.png'),
    cap1.map((c, i) => ({ img: img(`c1_${i}.png`), start: c.start, end: c.end })),
    tmp('seg1.mp4'));

  // ── Seg 2: Customer ordering  (17s) ────────────────────────────────────
  console.log('\n── Seg 2: Customer ordering');
  convertClip(SRC.customer, tmp('seg2_app.mp4'), 0, 17);

  const cap2 = [
    { text: 'TAP. ADD. ORDER.',      sub: 'Cart updates live with every tap.',          start: 0.5,  end: 5.5  },
    { text: 'CASH OR UPI',           sub: 'Guest\'s choice. No extra hardware needed.', start: 5.8,  end: 11.5 },
    { text: 'ORDER PLACED ✓',        sub: 'Kitchen gets notified instantly.',            start: 11.8, end: 17.0 },
  ];
  for (let i = 0; i < cap2.length; i++) {
    await renderCaption(browser, cap2[i].text, cap2[i].sub, img(`c2_${i}.png`));
  }
  compositePhoneScene(tmp('seg2_app.mp4'), img('bg.png'), img('phone_frame.png'),
    cap2.map((c, i) => ({ img: img(`c2_${i}.png`), start: c.start, end: c.end })),
    tmp('seg2.mp4'));

  // ── Seg 3: Dashboard  (15s) ────────────────────────────────────────────
  console.log('\n── Seg 3: Dashboard');
  convertClip(SRC.dashboard, tmp('seg3_app.mp4'), 2, 15);
  zoomClip(tmp('seg3_app.mp4'), tmp('seg3_z.mp4'), 1.12, 0.5, 0.38);

  const cap3 = [
    { text: 'LIVE ORDERS. ZERO CHAOS.',  sub: 'Every table, every order — one screen.', start: 0.5, end: 7.0  },
    { text: 'REAL-TIME. ALWAYS.',         sub: 'Auto-refreshes every 8 seconds.',        start: 7.3, end: 15.0 },
  ];
  for (let i = 0; i < cap3.length; i++) {
    await renderCaption(browser, cap3[i].text, cap3[i].sub, img(`c3_${i}.png`));
  }
  compositePhoneScene(tmp('seg3_z.mp4'), img('bg.png'), img('phone_frame.png'),
    cap3.map((c, i) => ({ img: img(`c3_${i}.png`), start: c.start, end: c.end })),
    tmp('seg3.mp4'));

  // ── Seg 4: AI Insights — the main USP  (21s) ───────────────────────────
  console.log('\n── Seg 4: AI Insights (USP)');
  convertClip(SRC.insights, tmp('seg4_app.mp4'), 1, 21);
  zoomClip(tmp('seg4_app.mp4'), tmp('seg4_z.mp4'), 1.20, 0.5, 0.40);

  const cap4 = [
    { text: 'AI INSIGHTS',                sub: 'Your café data — understood automatically.',   start: 0.5,  end: 5.5  },
    { text: '₹1,24,500 IN 28 DAYS',      sub: 'Revenue tracked. Zero spreadsheets.',           start: 5.8,  end: 11.0 },
    { text: 'PEAK HOURS. BESTSELLERS.',   sub: 'Know exactly what\'s working and when.',        start: 11.3, end: 16.5 },
    { text: '#1 CARBONARA RAMYUN: 87 SOLD', sub: 'AI-detected. No guessing. Ever.',             start: 16.8, end: 21.0 },
  ];
  for (let i = 0; i < cap4.length; i++) {
    await renderCaption(browser, cap4[i].text, cap4[i].sub, img(`c4_${i}.png`));
  }
  compositePhoneScene(tmp('seg4_z.mp4'), img('bg.png'), img('phone_frame.png'),
    cap4.map((c, i) => ({ img: img(`c4_${i}.png`), start: c.start, end: c.end })),
    tmp('seg4.mp4'));

  // ── Seg 5: CTA  (7s) ───────────────────────────────────────────────────
  console.log('\n── Seg 5: CTA');
  await renderHeroCard(browser, [
    { text: 'TableTap',                            size: 108, color: '#ffffff', weight: 900 },
    { text: 'One QR. Full control.',               size: 56,  color: '#34d399', weight: 700 },
    { text: 'Orders  ·  Insights  ·  Payments',   size: 32,  color: '#fff',    weight: 400, opacity: 0.5 },
    { text: '',                                    size: 14 },
    { text: 'tabletap.dev',                        size: 54,  color: '#34d399', weight: 700 },
    { text: 'Start for free today',                size: 32,  color: '#fff',    weight: 400, opacity: 0.55 },
  ], img('card_cta.png'));
  pngToVideo(img('card_cta.png'), tmp('seg5.mp4'), 7);

  // ── Durations ───────────────────────────────────────────────────────────
  const segs = ['seg0','seg1','seg2','seg3','seg4','seg5'];
  console.log('\n── Segment durations:');
  segs.forEach(s => console.log(`    ${s}: ${dur(tmp(s + '.mp4')).toFixed(1)}s`));

  // ── Concatenate with varied transitions ─────────────────────────────────
  console.log('\n── Concatenating');
  concatAll([
    { file: tmp('seg0.mp4'), transition: 'fade'       },
    { file: tmp('seg1.mp4'), transition: 'wipeup'     },
    { file: tmp('seg2.mp4'), transition: 'slideleft'  },
    { file: tmp('seg3.mp4'), transition: 'wipeleft'   },
    { file: tmp('seg4.mp4'), transition: 'smoothup'   },
    { file: tmp('seg5.mp4'), transition: 'fade'       },
  ], tmp('video_silent.mp4'));

  // ── Audio ───────────────────────────────────────────────────────────────
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
