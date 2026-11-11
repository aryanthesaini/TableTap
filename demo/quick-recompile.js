/**
 * quick-recompile.js
 * Rebuilds only: zoom segs → concat → audio → final MP4
 * Reuses existing seg0, seg1_cap, seg2, seg3_cap, seg4_cap, seg5
 *
 * Fixed: replaced broken zoompan (which stretched 13s clips to 70min due to VFR WebM input)
 * with a crop+scale Ken Burns that is fast and correctly time-limited.
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const DIR = __dirname;
const TMP = path.join(DIR, 'tmp');
const OUT = path.join(DIR, 'tabletap-reel.mp4');
const W   = 1080, H = 1920;

function ffrun(args) {
  const result = spawnSync('ffmpeg', ['-y', ...args], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (result.status !== 0) {
    const lines = (result.stderr || '').split('\n');
    const errs  = lines.filter(l => /error|invalid|failed/i.test(l)).slice(0, 3);
    if (errs.length) console.warn('  ffmpeg warn:', errs.join('\n  '));
  }
  return result.status === 0;
}

function dur(file) {
  const r = spawnSync('ffprobe', ['-v','quiet','-show_entries','format=duration','-of','csv=p=0', file], { encoding:'utf8' });
  return parseFloat(r.stdout.trim()) || 0;
}

function tmp(name) { return path.join(TMP, name); }

// ─────────────────────────────────────────────────────────────────────────────
// Ken Burns zoom via scale(eval=frame) + crop.
// Scales frame UP from W×H to W*zTarget×H*zTarget over d seconds,
// then crops W×H anchored at (cx,cy) of the scaled frame.
// Avoids zoompan (VFR duration bug) and crop-w/h-with-t (unsupported).
// ─────────────────────────────────────────────────────────────────────────────
function zoomClip(input, output, zTarget = 1.25, cx = 0.5, cy = 0.45) {
  console.log(`  zoom → ${zTarget}×`);
  const d = dur(input);
  if (!d) { fs.copyFileSync(input, output); return; }
  const dStr = d.toFixed(3);

  // Scale grows: W+dW*t/d  × H+dH*t/d  (rounded to even)
  const dW = (W * (zTarget - 1)).toFixed(2);
  const dH = (H * (zTarget - 1)).toFixed(2);
  const wScale = `trunc((${W}+${dW}*t/${dStr})/2)*2`;
  const hScale = `trunc((${H}+${dH}*t/${dStr})/2)*2`;

  // Crop W×H from scaled frame, focus at (cx,cy)
  const xCrop = `(in_w-${W})*${cx}`;
  const yCrop = `(in_h-${H})*${cy}`;

  console.log(`    ${d.toFixed(1)}s, 1.0×→${zTarget}× at (${cx},${cy})`);
  const ok = ffrun([
    '-i', input,
    '-vf', `fps=25,scale='${wScale}':'${hScale}':eval=frame,crop=${W}:${H}:${xCrop}:${yCrop}`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-an', output,
  ]);
  if (ok) {
    const d2 = dur(output);
    console.log(`    ✓ ${output.split('/').pop()} — ${d2.toFixed(1)}s`);
  } else {
    // Static fallback: crop zoomed center and scale up
    console.warn(`    dynamic zoom failed, using static center zoom`);
    const cropW = Math.round(W / zTarget / 2) * 2;
    const cropH = Math.round(H / zTarget / 2) * 2;
    const cropX = Math.round((W - cropW) * cx);
    const cropY = Math.round((H - cropH) * cy);
    ffrun(['-i', input,
      '-vf', `fps=25,crop=${cropW}:${cropH}:${cropX}:${cropY},scale=${W}:${H}`,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-an', output]);
    if (fs.existsSync(output)) {
      console.log(`    ✓ static zoom — ${dur(output).toFixed(1)}s`);
    } else {
      fs.copyFileSync(input, output);
    }
  }
}

function crossfade(a, b, output, td = 0.5) {
  const da = dur(a);
  if (!da) { fs.copyFileSync(b, output); return; }
  const offset = Math.max(0, da - td).toFixed(3);
  console.log(`  xfade ${path.basename(a)} (${da.toFixed(1)}s) + ${path.basename(b)} @ offset=${offset}`);
  ffrun(['-i', a, '-i', b,
    '-filter_complex', `[0:v][1:v]xfade=transition=fade:duration=${td}:offset=${offset}[v]`,
    '-map', '[v]',
    '-c:v','libx264','-preset','fast','-crf','20','-an', output]);
  const dOut = dur(output);
  console.log(`    ✓ ${path.basename(output)} — ${dOut.toFixed(1)}s`);
}

function concatAll(clips, output) {
  console.log(`\n── Concat ${clips.length} segments with crossfade`);
  let current = clips[0];
  for (let i = 1; i < clips.length; i++) {
    const isLast = (i === clips.length - 1);
    const out = isLast ? output : tmp(`xf${i}.mp4`);
    crossfade(current, clips[i], out);
    current = out;
  }
}

function genAudio(output, seconds) {
  console.log(`\n── Generating ambient audio (${seconds.toFixed(0)}s)`);
  ffrun([
    '-f','lavfi','-i',`sine=frequency=110:sample_rate=44100:duration=${seconds}`,
    '-f','lavfi','-i',`sine=frequency=165:sample_rate=44100:duration=${seconds}`,
    '-f','lavfi','-i',`sine=frequency=220:sample_rate=44100:duration=${seconds}`,
    '-filter_complex',
      '[0][1][2]amix=inputs=3:duration=first,' +
      'volume=0.07,' +
      'lowpass=f=600,' +
      `afade=t=in:st=0:d=2,afade=t=out:st=${seconds - 2}:d=2`,
    '-c:a','aac','-ar','44100','-b:a','128k', output,
  ]);
}

function addAudio(videoIn, audioIn, output) {
  console.log('\n── Mixing audio into final MP4');
  ffrun(['-i', videoIn, '-i', audioIn,
    '-c:v','copy','-c:a','aac','-shortest','-map','0:v','-map','1:a', output]);
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  console.log('  TableTap — Quick Recompile');
  console.log('  Segments: seg0 ✓  seg1_cap ✓  seg2 ✓  seg3_cap ✓  seg4_cap ✓  seg5 ✓');
  console.log('  Rebuilding: zoom segs → concat → audio → tabletap-reel.mp4');
  console.log('='.repeat(60));

  // 1. Zoom segs
  console.log('\n── Zooming seg1 (QR landing, 1.22×)');
  zoomClip(tmp('seg1_cap.mp4'), tmp('seg1.mp4'), 1.22, 0.5, 0.42);

  console.log('\n── Zooming seg3 (Dashboard, 1.2×)');
  zoomClip(tmp('seg3_cap.mp4'), tmp('seg3.mp4'), 1.20, 0.5, 0.38);

  console.log('\n── Zooming seg4 (AI Insights, 1.3×)');
  zoomClip(tmp('seg4_cap.mp4'), tmp('seg4.mp4'), 1.30, 0.5, 0.40);

  // Log durations before concat
  const segs = ['seg0','seg1','seg2','seg3','seg4','seg5'];
  console.log('\n── Segment durations:');
  segs.forEach(s => {
    const d = dur(tmp(s + '.mp4'));
    console.log(`    ${s}: ${d.toFixed(1)}s`);
  });

  // 2. Concatenate
  concatAll(segs.map(s => tmp(s + '.mp4')), tmp('video_silent.mp4'));

  // 3. Audio + final
  const totalDur = dur(tmp('video_silent.mp4'));
  console.log(`\n   Video duration: ${totalDur.toFixed(1)}s`);
  genAudio(tmp('ambient.aac'), totalDur + 1);
  addAudio(tmp('video_silent.mp4'), tmp('ambient.aac'), OUT);

  const stat = fs.statSync(OUT);
  console.log('\n' + '='.repeat(60));
  console.log(`✅  tabletap-reel.mp4  (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`   ${OUT}`);
  console.log('='.repeat(60));
}

main().catch(err => { console.error(err); process.exit(1); });
