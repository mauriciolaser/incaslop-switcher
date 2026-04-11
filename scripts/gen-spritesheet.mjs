/**
 * gen-spritesheet.mjs
 * Genera el spritesheet BASE del luchador — sin cara.
 * La zona de la cara queda completamente transparente (alpha=0).
 * En runtime se pega la imagen del candidato encima en esa región.
 *
 * Uso:
 *   node scripts/gen-spritesheet.mjs
 *
 * Output:
 *   src/assets/sprites/fighter_base.png   ← spritesheet sin cara
 *   src/assets/sprites/fighter_base.json  ← metadata de frames + faceRegion
 */

import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')

// ── Configuración ─────────────────────────────────────────────────────────────

const FRAME_W = 128
const FRAME_H = 192
const FRAMES = 8
const SHEET_W = FRAME_W * FRAMES
const SHEET_H = FRAME_H

// Región de la cara dentro de cada frame — aquí el spritesheet es transparente.
// En runtime se composita la imagen del candidato en estas coordenadas.
const FACE = { x: 28, y: 6, w: 72, h: 80 }

// ── Paleta ────────────────────────────────────────────────────────────────────

const C = {
  suit:      '#2a3f6f',
  suitDark:  '#1a2a4a',
  suitLight: '#3a5090',
  belt:      '#8b6914',
  boots:     '#1a1a2a',
  skin:      '#e8b89a',
  white:     '#f0f0f0',
  tie:       '#b22222',
  shadow:    'rgba(0,0,0,0.18)',
}

// ── SVG por frame ─────────────────────────────────────────────────────────────
// La zona FACE se dibuja con fill="none" — quedará transparente tras rasterizar.
// El cuello arranca desde FACE.y + FACE.h para conectar con el cuerpo.

const neckTop = FACE.y + FACE.h  // y donde termina el hueco de la cara

function neck(oy = 0) {
  return `<rect x="56" y="${neckTop + oy}" width="16" height="14" rx="2" fill="${C.skin}"/>`
}

function torso(oy = 0) {
  const ty = neckTop + 14 + oy
  return `
    <!-- sombra suelo -->
    <ellipse cx="64" cy="${184 + oy}" rx="30" ry="5" fill="${C.shadow}"/>
    <!-- botas -->
    <rect x="36" y="${156 + oy}" width="20" height="26" rx="3" fill="${C.boots}"/>
    <rect x="72" y="${156 + oy}" width="20" height="26" rx="3" fill="${C.boots}"/>
    <!-- piernas -->
    <rect x="38" y="${124 + oy}" width="22" height="36" rx="2" fill="${C.suitDark}"/>
    <rect x="68" y="${124 + oy}" width="22" height="36" rx="2" fill="${C.suitDark}"/>
    <!-- torso -->
    <rect x="28" y="${ty}" width="72" height="50" rx="4" fill="${C.suit}"/>
    <!-- solapas -->
    <polygon points="56,${ty} 72,${ty} 64,${ty + 22}" fill="${C.white}"/>
    <polygon points="56,${ty} 64,${ty + 4} 50,${ty + 22}" fill="${C.suitDark}"/>
    <polygon points="72,${ty} 64,${ty + 4} 78,${ty + 22}" fill="${C.suitDark}"/>
    <!-- corbata -->
    <rect x="61" y="${ty + 8}" width="6" height="30" rx="2" fill="${C.tie}"/>
    <!-- cinturón -->
    <rect x="28" y="${ty + 44}" width="72" height="7" rx="2" fill="${C.belt}"/>
    <!-- hombros -->
    <ellipse cx="28" cy="${ty + 6}" rx="13" ry="11" fill="${C.suitLight}"/>
    <ellipse cx="100" cy="${ty + 6}" rx="13" ry="11" fill="${C.suitLight}"/>
    ${neck(oy)}
  `
}

// idle_a: brazos abajo
function idle_a(oy = 0) { return `
  ${torso(oy)}
  <rect x="8"  y="${neckTop + 18 + oy}" width="22" height="14" rx="4" fill="${C.suitLight}"/>
  <rect x="98" y="${neckTop + 18 + oy}" width="22" height="14" rx="4" fill="${C.suitLight}"/>
  <ellipse cx="18"  cy="${neckTop + 44 + oy}" rx="11" ry="11" fill="${C.skin}"/>
  <ellipse cx="110" cy="${neckTop + 44 + oy}" rx="11" ry="11" fill="${C.skin}"/>
` }

// idle_b: igual pero 4px arriba (bounce)
function idle_b() { return idle_a(-4) }

// attack_a: brazo derecho extendido
function attack_a(oy = 0) { return `
  ${torso(oy)}
  <!-- brazo izq retraído -->
  <rect x="8" y="${neckTop + 22 + oy}" width="20" height="12" rx="4" fill="${C.suitLight}"/>
  <ellipse cx="14" cy="${neckTop + 44 + oy}" rx="10" ry="10" fill="${C.skin}"/>
  <!-- brazo der extendido (puñetazo) -->
  <rect x="98" y="${neckTop + 14 + oy}" width="30" height="13" rx="4" fill="${C.suitLight}"/>
  <ellipse cx="130" cy="${neckTop + 20 + oy}" rx="13" ry="12" fill="${C.skin}"/>
` }

function attack_b() { return attack_a(-3) }

// hit: cuerpo inclinado + estrellas
function hit(oy = 0) { return `
  ${torso(oy)}
  <rect x="6"  y="${neckTop + 16 + oy}" width="20" height="12" rx="4" fill="${C.suitLight}"/>
  <rect x="90" y="${neckTop + 16 + oy}" width="20" height="12" rx="4" fill="${C.suitLight}"/>
  <ellipse cx="12"  cy="${neckTop + 38 + oy}" rx="10" ry="10" fill="${C.skin}"/>
  <ellipse cx="104" cy="${neckTop + 38 + oy}" rx="10" ry="10" fill="${C.skin}"/>
  <!-- impacto -->
  <text x="88" y="${FACE.y + 20 + oy}" font-size="24" fill="#FFD700">★</text>
  <text x="68" y="${FACE.y + 6 + oy}"  font-size="14" fill="#FF6600">✦</text>
` }

function ko_start() { return `
  ${torso(-2)}
  <rect x="10" y="${neckTop + 8}" width="30" height="12" rx="4" fill="${C.suitLight}" transform="rotate(-24 25 ${neckTop + 14})"/>
  <rect x="84" y="${neckTop + 6}" width="34" height="13" rx="4" fill="${C.suitLight}" transform="rotate(28 101 ${neckTop + 12})"/>
  <ellipse cx="18" cy="${neckTop + 34}" rx="11" ry="11" fill="${C.skin}"/>
  <ellipse cx="112" cy="${neckTop + 28}" rx="11" ry="11" fill="${C.skin}"/>
  <text x="90" y="${FACE.y + 12}" font-size="20" fill="#FFD700">✹</text>
  <text x="48" y="${FACE.y - 2}" font-size="18" fill="#ff8844">!</text>
` }

function ko_spin() { return `
  <ellipse cx="64" cy="178" rx="44" ry="8" fill="${C.shadow}"/>
  <g transform="translate(64 116) rotate(78)">
    <rect x="-38" y="-24" width="76" height="48" rx="5" fill="${C.suit}"/>
    <rect x="-38" y="10" width="76" height="7" rx="2" fill="${C.belt}"/>
    <rect x="-12" y="-32" width="24" height="18" rx="2" fill="${C.skin}"/>
    <rect x="-54" y="-10" width="24" height="12" rx="4" fill="${C.suitLight}"/>
    <rect x="30" y="-2" width="28" height="12" rx="4" fill="${C.suitLight}"/>
    <ellipse cx="-56" cy="-4" rx="10" ry="10" fill="${C.skin}"/>
    <ellipse cx="60" cy="4" rx="10" ry="10" fill="${C.skin}"/>
    <rect x="-28" y="24" width="18" height="26" rx="3" fill="${C.boots}"/>
    <rect x="10" y="24" width="18" height="26" rx="3" fill="${C.boots}"/>
  </g>
  <text x="10" y="48" font-size="18" fill="#FFD700">✦</text>
  <text x="98" y="38" font-size="18" fill="#FF6600">✦</text>
` }

// death: tumbado, sin cabeza visible (cara se oculta fuera del frame)
function death() { return `
  <ellipse cx="64" cy="178" rx="54" ry="10" fill="${C.shadow}"/>
  <rect x="6"   y="150" width="116" height="28" rx="8" fill="${C.suit}"/>
  <rect x="6"   y="156" width="116" height="7"  rx="2" fill="${C.suitDark}"/>
  <rect x="96"  y="140" width="22" height="16" rx="3" fill="${C.boots}"/>
  <rect x="104" y="140" width="18" height="16" rx="3" fill="${C.boots}"/>
  <rect x="8"   y="138" width="44" height="14" rx="4" fill="${C.suitLight}"/>
  <ellipse cx="10" cy="144" rx="10" ry="10" fill="${C.skin}"/>
  <!-- mareo -->
  <text x="50" y="142" font-size="20" fill="#FFD700">@</text>
` }

// ── Frames ────────────────────────────────────────────────────────────────────

const framesDef = [
  { name: 'idle_a',   body: idle_a()   },
  { name: 'idle_b',   body: idle_b()   },
  { name: 'attack_a', body: attack_a() },
  { name: 'attack_b', body: attack_b() },
  { name: 'hit',      body: hit()      },
  { name: 'ko_start', body: ko_start() },
  { name: 'ko_spin',  body: ko_spin()  },
  { name: 'death',    body: death()    },
]

// Cada frame SVG: el hueco de la cara se deja sin dibujar (transparente)
function frameSVG(body, i) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W}" height="${FRAME_H}">
  ${body}
</svg>`
}

// ── Render ────────────────────────────────────────────────────────────────────

console.log('Renderizando frames...')

const frameBuffers = await Promise.all(
  framesDef.map(async ({ name, body }, i) => {
    const buf = await sharp(Buffer.from(frameSVG(body, i)))
      .resize(FRAME_W, FRAME_H)
      .png()
      .toBuffer()
    console.log(`  ${i}: ${name} ✓`)
    return buf
  })
)

// ── Componer spritesheet ───────────────────────────────────────────────────────

console.log('Componiendo spritesheet...')

const sheetBuf = await sharp({
  create: { width: SHEET_W, height: SHEET_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(frameBuffers.map((buf, i) => ({ input: buf, left: i * FRAME_W, top: 0 })))
  .png()
  .toBuffer()

// ── Guardar ───────────────────────────────────────────────────────────────────

const outDir = resolve(ROOT, 'src/assets/sprites')
mkdirSync(outDir, { recursive: true })

const pngPath = resolve(outDir, 'fighter_base.png')
writeFileSync(pngPath, sheetBuf)
console.log(`\nSpritesheet: ${pngPath}  (${SHEET_W}×${SHEET_H}px)`)

const meta = {
  frameWidth:  FRAME_W,
  frameHeight: FRAME_H,
  frameCount:  FRAMES,
  sheetWidth:  SHEET_W,
  sheetHeight: SHEET_H,
  // faceRegion: coordenadas dentro de CADA frame donde se pega la cara en runtime
  faceRegion: FACE,
  frames: framesDef.map(({ name }, i) => ({
    name, index: i,
    x: i * FRAME_W, y: 0, w: FRAME_W, h: FRAME_H,
  })),
}

const jsonPath = resolve(outDir, 'fighter_base.json')
writeFileSync(jsonPath, JSON.stringify(meta, null, 2))
console.log(`Metadata:    ${jsonPath}`)
console.log(`\nfaceRegion: x=${FACE.x} y=${FACE.y} w=${FACE.w} h=${FACE.h}`)
console.log('En runtime: compositar la imagen del candidato en esa región sobre cada frame.')
