/**
 * gen-money-icon.mjs
 * Genera un icono de dinero estilo sprite para el HUD.
 *
 * Uso:
 *   node scripts/gen-money-icon.mjs
 *
 * Output:
 *   src/assets/sprites/money_icon.png
 */

import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const outDir = resolve(ROOT, 'src/assets/sprites')
const outPath = resolve(outDir, 'money_icon.png')

const ICON_SIZE = 96

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
  <defs>
    <linearGradient id="coinMain" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffe690"/>
      <stop offset="100%" stop-color="#d88f0e"/>
    </linearGradient>
    <linearGradient id="coinInner" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff4bb"/>
      <stop offset="100%" stop-color="#f3bb34"/>
    </linearGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="5" stdDeviation="3" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${ICON_SIZE}" height="${ICON_SIZE}" fill="transparent"/>

  <g filter="url(#softShadow)">
    <ellipse cx="45" cy="62" rx="28" ry="10" fill="#aa6b00"/>
    <ellipse cx="45" cy="57" rx="28" ry="10" fill="url(#coinMain)" stroke="#7f4a00" stroke-width="2"/>
    <ellipse cx="45" cy="56" rx="19" ry="6.2" fill="url(#coinInner)" opacity="0.95"/>

    <ellipse cx="58" cy="45" rx="28" ry="10" fill="#aa6b00"/>
    <ellipse cx="58" cy="40" rx="28" ry="10" fill="url(#coinMain)" stroke="#7f4a00" stroke-width="2"/>
    <ellipse cx="58" cy="39" rx="19" ry="6.2" fill="url(#coinInner)" opacity="0.95"/>
  </g>

  <g transform="translate(49,39)">
    <circle r="9" fill="#ffe390" opacity="0.7"/>
    <path d="M -2 -5 L 2 -5 L 2 -2 L 5 -2 L 5 2 L 2 2 L 2 5 L -2 5 L -2 2 L -5 2 L -5 -2 L -2 -2 Z" fill="#915700"/>
  </g>
</svg>
`

await mkdir(outDir, { recursive: true })
await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(outPath)

console.log(`Icono generado: ${outPath}`)
