const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'resources', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

function squircleFrame({ bgTop, bgBottom, border, innerGlow }) {
  return `
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgTop}"/>
      <stop offset="100%" stop-color="${bgBottom}"/>
    </linearGradient>
    <linearGradient id="topSheen" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${innerGlow}" stop-opacity="0.22"/>
      <stop offset="45%" stop-color="${innerGlow}" stop-opacity="0"/>
    </linearGradient>
    <filter id="softShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000000" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect x="56" y="56" width="912" height="912" rx="206" ry="206" fill="url(#bgGrad)" stroke="${border}" stroke-width="14"/>
  <rect x="63" y="63" width="898" height="898" rx="199" ry="199" fill="url(#topSheen)" pointer-events="none"/>`;
}

function buildClassicSvg(mode) {
  const dark = mode === 'dark';
  const frame = squircleFrame(
    dark
      ? { bgTop: '#1e2636', bgBottom: '#0e131c', border: '#31405a', innerGlow: '#93c5fd' }
      : { bgTop: '#ffffff', bgBottom: '#eaf1fb', border: '#cbd6e6', innerGlow: '#ffffff' }
  );
  const cBlue = dark ? '#58a6ff' : '#2563eb';
  const cPink = dark ? '#f778ba' : '#db2777';
  const cGreen = dark ? '#3fb950' : '#16a34a';
  const cMuted = dark ? '#8b949e' : '#94a3b8';
  const nodeFill = dark ? '#111827' : '#ffffff';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${frame}
  <g filter="url(#softShadow)">
    <line x1="304" y1="196" x2="304" y2="828" stroke="${cMuted}" stroke-width="58" stroke-linecap="round"/>
    <line x1="304" y1="500" x2="304" y2="828" stroke="${cBlue}" stroke-width="58" stroke-linecap="round"/>
    <line x1="512" y1="260" x2="512" y2="828" stroke="${cPink}" stroke-width="58" stroke-linecap="round"/>
    <path d="M 304 500 C 304 640, 720 572, 720 732" fill="none" stroke="${cGreen}" stroke-width="58" stroke-linecap="round"/>
    <circle cx="304" cy="500" r="78" fill="${nodeFill}" stroke="${cBlue}" stroke-width="44"/>
    <circle cx="512" cy="268" r="78" fill="${nodeFill}" stroke="${cPink}" stroke-width="44"/>
    <circle cx="720" cy="732" r="78" fill="${nodeFill}" stroke="${cGreen}" stroke-width="44"/>
  </g>
</svg>`;
}

function buildMetroSvg(mode) {
  const dark = mode === 'dark';
  const frame = squircleFrame(
    dark
      ? { bgTop: '#1b1c22', bgBottom: '#0d0e12', border: '#2e313d', innerGlow: '#e2e8f0' }
      : { bgTop: '#fffefb', bgBottom: '#f2ece1', border: '#dcd3c2', innerGlow: '#ffffff' }
  );
  const grid = dark ? '#262934' : '#e4ddd0';
  const lineBlue = dark ? '#38bdf8' : '#0284c7';
  const lineCoral = dark ? '#fb7185' : '#e11d48';
  const lineAmber = dark ? '#fbbf24' : '#d97706';
  const stationFill = dark ? '#14151a' : '#ffffff';
  const hubStroke = dark ? '#f8fafc' : '#1e293b';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${frame}
  <g stroke="${grid}" stroke-width="8" opacity="0.85">
    <line x1="160" y1="336" x2="864" y2="336"/>
    <line x1="160" y1="512" x2="864" y2="512"/>
    <line x1="160" y1="688" x2="864" y2="688"/>
    <line x1="336" y1="160" x2="336" y2="864"/>
    <line x1="512" y1="160" x2="512" y2="864"/>
    <line x1="688" y1="160" x2="688" y2="864"/>
  </g>
  <g filter="url(#softShadow)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 316 216 L 316 808" stroke="${lineBlue}" stroke-width="54"/>
    <path d="M 216 512 L 512 512 L 708 708 L 708 808" stroke="${lineAmber}" stroke-width="54"/>
    <path d="M 316 708 L 512 512 L 708 316 L 708 216" stroke="${lineCoral}" stroke-width="54"/>
  </g>
  <g filter="url(#softShadow)">
    <circle cx="316" cy="316" r="40" fill="${stationFill}" stroke="${lineBlue}" stroke-width="26"/>
    <circle cx="316" cy="708" r="40" fill="${stationFill}" stroke="${lineCoral}" stroke-width="26"/>
    <circle cx="708" cy="316" r="40" fill="${stationFill}" stroke="${lineCoral}" stroke-width="26"/>
    <circle cx="708" cy="708" r="40" fill="${stationFill}" stroke="${lineAmber}" stroke-width="26"/>
    <circle cx="512" cy="512" r="68" fill="${stationFill}" stroke="${hubStroke}" stroke-width="34"/>
    <circle cx="512" cy="512" r="24" fill="${hubStroke}"/>
  </g>
</svg>`;
}

function buildNeonSvg(mode) {
  const dark = mode === 'dark';
  const frame = squircleFrame(
    dark
      ? { bgTop: '#171332', bgBottom: '#090716', border: '#332d63', innerGlow: '#c4b5fd' }
      : { bgTop: '#fcfcff', bgBottom: '#ede9fe', border: '#c7d2fe', innerGlow: '#ffffff' }
  );
  const c1 = dark ? '#22d3ee' : '#0891b2';
  const c2 = dark ? '#818cf8' : '#4f46e5';
  const c3 = dark ? '#f472b6' : '#db2777';
  const centerFill = dark ? '#0f0c24' : '#ffffff';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${frame}
  <defs>
    <linearGradient id="auroraTrunk" gradientUnits="userSpaceOnUse" x1="348" y1="796" x2="348" y2="228">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <linearGradient id="auroraArc" gradientUnits="userSpaceOnUse" x1="348" y1="708" x2="692" y2="296">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="52%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <radialGradient id="auroraGlow" cx="50%" cy="50%" r="46%">
      <stop offset="0%" stop-color="${c2}" stop-opacity="${dark ? '0.32' : '0.16'}"/>
      <stop offset="85%" stop-color="${c2}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${c2}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="512" cy="512" r="380" fill="url(#auroraGlow)"/>
  <g filter="url(#softShadow)">
    <line x1="348" y1="216" x2="348" y2="808" stroke="url(#auroraTrunk)" stroke-width="58" stroke-linecap="round"/>
    <path d="M 348 708 C 348 560, 692 652, 692 504 C 692 356, 348 440, 348 296" fill="none" stroke="url(#auroraArc)" stroke-width="58" stroke-linecap="round"/>
    <circle cx="348" cy="708" r="64" fill="${centerFill}" stroke="${c1}" stroke-width="38"/>
    <circle cx="692" cy="504" r="68" fill="${centerFill}" stroke="${c3}" stroke-width="38"/>
    <circle cx="348" cy="296" r="72" fill="${centerFill}" stroke="${c2}" stroke-width="40"/>
    <circle cx="348" cy="296" r="24" fill="${c3}"/>
  </g>
</svg>`;
}

function buildCompassSvg(mode) {
  const dark = mode === 'dark';
  const frame = squircleFrame(
    dark
      ? { bgTop: '#102733', bgBottom: '#07131a', border: '#21485a', innerGlow: '#7dd3fc' }
      : { bgTop: '#f8fdff', bgBottom: '#dff1fc', border: '#b6dcf2', innerGlow: '#ffffff' }
  );
  const ring = dark ? '#2a5a70' : '#93c5fd';
  const tick = dark ? '#64748b' : '#64748b';
  const mainTeal = dark ? '#2dd4bf' : '#0d9488';
  const mainSky = dark ? '#38bdf8' : '#0284c7';
  const accent = dark ? '#fb923c' : '#ea580c';
  const hubBg = dark ? '#0b1c24' : '#ffffff';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${frame}
  <circle cx="512" cy="512" r="334" fill="none" stroke="${ring}" stroke-width="18"/>
  <circle cx="512" cy="512" r="256" fill="none" stroke="${ring}" stroke-width="8" stroke-dasharray="18 22" opacity="0.75"/>
  <g stroke="${tick}" stroke-width="14" stroke-linecap="round">
    <line x1="512" y1="146" x2="512" y2="188" stroke="${accent}" stroke-width="20"/>
    <line x1="512" y1="836" x2="512" y2="878"/>
    <line x1="146" y1="512" x2="188" y2="512"/>
    <line x1="836" y1="512" x2="878" y2="512"/>
  </g>
  <g filter="url(#softShadow)">
    <path d="M 484 540 C 536 616, 588 646, 656 646" fill="none" stroke="${mainTeal}" stroke-width="48" stroke-linecap="round"/>
    <line x1="348" y1="676" x2="628" y2="396" stroke="${mainSky}" stroke-width="54" stroke-linecap="round"/>
    <polygon points="712,312 586,360 664,438" fill="${accent}"/>
    <circle cx="348" cy="676" r="54" fill="${hubBg}" stroke="${mainSky}" stroke-width="32"/>
    <circle cx="484" cy="540" r="58" fill="${hubBg}" stroke="${mainSky}" stroke-width="34"/>
    <circle cx="656" cy="646" r="50" fill="${hubBg}" stroke="${mainTeal}" stroke-width="30"/>
  </g>
</svg>`;
}

function buildIsometricSvg(mode) {
  const dark = mode === 'dark';
  const frame = squircleFrame(
    dark
      ? { bgTop: '#1c192b', bgBottom: '#0d0b15', border: '#342e4f', innerGlow: '#c4b5fd' }
      : { bgTop: '#ffffff', bgBottom: '#eef2ff', border: '#cbd5e1', innerGlow: '#ffffff' }
  );
  const topFace = dark ? '#3730a3' : '#e0e7ff';
  const leftFace = dark ? '#272262' : '#c7d2fe';
  const rightFace = dark ? '#1b1744' : '#a5b4fc';
  const edgeStroke = dark ? '#4f46e5' : '#818cf8';
  const traceA = dark ? '#34d399' : '#059669';
  const traceB = dark ? '#38bdf8' : '#0284c7';
  const traceHead = dark ? '#f472b6' : '#db2777';
  const nodeBg = dark ? '#131022' : '#ffffff';

  // Hex cube centered at (512, 520), R = 296 -> dx = 256, dy = 148
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${frame}
  <g filter="url(#softShadow)" stroke-linejoin="round">
    <polygon points="512,224 768,372 512,520 256,372" fill="${topFace}" stroke="${edgeStroke}" stroke-width="10"/>
    <polygon points="256,372 512,520 512,816 256,668" fill="${leftFace}" stroke="${edgeStroke}" stroke-width="10"/>
    <polygon points="768,372 512,520 512,816 768,668" fill="${rightFace}" stroke="${edgeStroke}" stroke-width="10"/>
  </g>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 512 816 L 512 520 L 256 372 L 512 224" stroke="${traceB}" stroke-width="40"/>
    <path d="M 512 520 L 768 372 L 512 224" stroke="${traceA}" stroke-width="40"/>
  </g>
  <g>
    <circle cx="512" cy="816" r="46" fill="${nodeBg}" stroke="${traceB}" stroke-width="28"/>
    <circle cx="512" cy="520" r="54" fill="${nodeBg}" stroke="${traceB}" stroke-width="30"/>
    <circle cx="256" cy="372" r="46" fill="${nodeBg}" stroke="${traceB}" stroke-width="28"/>
    <circle cx="768" cy="372" r="46" fill="${nodeBg}" stroke="${traceA}" stroke-width="28"/>
    <circle cx="512" cy="224" r="58" fill="${nodeBg}" stroke="${traceHead}" stroke-width="32"/>
  </g>
</svg>`;
}

function buildMinimalSvg(mode) {
  const dark = mode === 'dark';
  const frame = squircleFrame(
    dark
      ? { bgTop: '#24262b', bgBottom: '#121316', border: '#3a3d45', innerGlow: '#ffffff' }
      : { bgTop: '#ffffff', bgBottom: '#ecedf0', border: '#d1d5db', innerGlow: '#ffffff' }
  );
  const ink = dark ? '#f8fafc' : '#18181b';
  const bgCenter = dark ? '#18191d' : '#ffffff';
  const subtleAccent = dark ? '#a1a1aa' : '#52525b';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${frame}
  <g filter="url(#softShadow)">
    <path d="M 364 648 C 364 496, 660 524, 660 368" fill="none" stroke="${subtleAccent}" stroke-width="60" stroke-linecap="round"/>
    <line x1="364" y1="264" x2="364" y2="760" stroke="${ink}" stroke-width="64" stroke-linecap="round"/>
    <circle cx="364" cy="264" r="74" fill="${ink}"/>
    <circle cx="364" cy="760" r="68" fill="${bgCenter}" stroke="${ink}" stroke-width="42"/>
    <circle cx="660" cy="368" r="68" fill="${bgCenter}" stroke="${ink}" stroke-width="42"/>
  </g>
</svg>`;
}

const BUILDERS = {
  classic: buildClassicSvg,
  metro: buildMetroSvg,
  neon: buildNeonSvg,
  compass: buildCompassSvg,
  isometric: buildIsometricSvg,
  minimal: buildMinimalSvg
};

for (const [style, fn] of Object.entries(BUILDERS)) {
  for (const mode of ['dark', 'light']) {
    const svgPath = path.join(OUT_DIR, `${style}-${mode}.svg`);
    const pngPath = path.join(OUT_DIR, `${style}-${mode}.png`);
    const svg = fn(mode);
    fs.writeFileSync(svgPath, svg, 'utf8');
    cp.execFileSync('rsvg-convert', ['-w', '512', '-h', '512', svgPath, '-o', pngPath]);
  }
}

// Keep top-level resources/icon.svg & 1024x1024 resources/icon.png updated for electron-builder bundle icon
const defaultSvg = buildClassicSvg('dark');
const mainSvgPath = path.join(ROOT, 'resources', 'icon.svg');
const mainPngPath = path.join(ROOT, 'resources', 'icon.png');
fs.writeFileSync(mainSvgPath, defaultSvg, 'utf8');
cp.execFileSync('rsvg-convert', ['-w', '1024', '-h', '1024', mainSvgPath, '-o', mainPngPath]);

console.log('Generated 12 icon variants (6 styles x dark/light) in resources/icons/ + resources/icon.png');
