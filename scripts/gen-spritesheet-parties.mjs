/**
 * gen-spritesheet-parties.mjs
 * Genera un spritesheet de luchador por partido político,
 * usando la paleta de colores del partido (traje, corbata, cinturón, etc.)
 *
 * Uso:
 *   node scripts/gen-spritesheet-parties.mjs
 *
 * Output por partido:
 *   src/assets/sprites/parties/{party-id}.png
 *   src/assets/sprites/parties/{party-id}.json
 */

import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createReadStream } from 'fs'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')

// ── Dimensiones ───────────────────────────────────────────────────────────────
const FRAME_W = 128
const FRAME_H = 192
const FRAMES  = 8
const SHEET_W = FRAME_W * FRAMES
const SHEET_H = FRAME_H
const FACE    = { x: 28, y: 6, w: 72, h: 80 }
const neckTop = FACE.y + FACE.h

// ── Colores base fijos (no cambian por partido) ───────────────────────────────
const BASE = {
  skin:   '#e8b89a',
  white:  '#f0f0f0',
  boots:  '#1a1a2a',
  shadow: 'rgba(0,0,0,0.18)',
}

// ── Mapa de colores por partido ───────────────────────────────────────────────
// suit / suitDark / suitLight: traje y variantes
// tie: corbata
// belt: cinturón
// accent: detalle extra (botones, pañuelo, etc.)
const PARTY_COLORS = {
  'ahora-nacion': {
    suit:      '#003366', suitDark: '#001f44', suitLight: '#1a4d8a',
    tie:       '#CC0000', belt: '#8b6914', accent: '#CC0000',
  },
  'alianza-electoral-venceremos': {
    suit:      '#CC0000', suitDark: '#880000', suitLight: '#DD3333',
    tie:       '#003366', belt: '#5a3000', accent: '#003366',
  },
  'alianza-para-el-progreso': {
    suit:      '#003399', suitDark: '#001f66', suitLight: '#1a4dcc',
    tie:       '#CC0000', belt: '#8b6914', accent: '#ffcc00',
  },
  'avanza-pais': {
    suit:      '#E8A000', suitDark: '#b07800', suitLight: '#f0b820',
    tie:       '#003366', belt: '#5a3000', accent: '#003366',
  },
  'fe-en-el-peru': {
    suit:      '#1a5276', suitDark: '#0d2b3e', suitLight: '#2e86c1',
    tie:       '#C0392B', belt: '#6e3b00', accent: '#f0c000',
  },
  'frente-popular-agricola-del-peru': {
    suit:      '#27AE60', suitDark: '#1a7040', suitLight: '#3dc472',
    tie:       '#f0c000', belt: '#5a3000', accent: '#f0c000',
  },
  'fuerza-popular': {
    suit:      '#FF6600', suitDark: '#cc4400', suitLight: '#ff8833',
    tie:       '#1a1a1a', belt: '#8b6914', accent: '#ffffff',
  },
  'fuerza-y-libertad': {
    suit:      '#8B0000', suitDark: '#5a0000', suitLight: '#aa2222',
    tie:       '#f0c000', belt: '#5a3000', accent: '#f0c000',
  },
  'juntos-por-el-peru': {
    suit:      '#CC0000', suitDark: '#880000', suitLight: '#DD2222',
    tie:       '#003366', belt: '#5a3000', accent: '#003366',
  },
  'libertad-popular': {
    suit:      '#003366', suitDark: '#001f44', suitLight: '#1a4d8a',
    tie:       '#CC0000', belt: '#8b6914', accent: '#f0c000',
  },
  'partido-aprista-peruano': {
    suit:      '#CC0000', suitDark: '#880000', suitLight: '#DD2222',
    tie:       '#ffffff', belt: '#5a3000', accent: '#000000',
  },
  'partido-civico-obras': {
    suit:      '#0055A4', suitDark: '#003370', suitLight: '#2277cc',
    tie:       '#f0c000', belt: '#8b6914', accent: '#f0c000',
  },
  'partido-de-los-trabajadores-y-emprendedores': {
    suit:      '#CC0000', suitDark: '#880000', suitLight: '#ee3333',
    tie:       '#f0c000', belt: '#5a3000', accent: '#f0c000',
  },
  'partido-del-buen-gobierno': {
    suit:      '#005500', suitDark: '#003300', suitLight: '#1a7a1a',
    tie:       '#f0c000', belt: '#5a3000', accent: '#f0c000',
  },
  'partido-democrata-unido-peru': {
    suit:      '#003366', suitDark: '#001f44', suitLight: '#1a4d8a',
    tie:       '#CC0000', belt: '#8b6914', accent: '#CC0000',
  },
  'partido-democrata-verde': {
    suit:      '#2E7D32', suitDark: '#1b5e20', suitLight: '#43a047',
    tie:       '#f0c000', belt: '#5a3000', accent: '#f0c000',
  },
  'partido-democratico-federal': {
    suit:      '#1565C0', suitDark: '#0d3e7a', suitLight: '#2980d4',
    tie:       '#CC0000', belt: '#8b6914', accent: '#CC0000',
  },
  'partido-democratico-somos-peru': {
    suit:      '#009900', suitDark: '#006600', suitLight: '#22bb22',
    tie:       '#CC0000', belt: '#5a3000', accent: '#CC0000',
  },
  'partido-frente-de-la-esperanza-2021': {
    suit:      '#1a237e', suitDark: '#0d1457', suitLight: '#303f9f',
    tie:       '#f0c000', belt: '#8b6914', accent: '#f0c000',
  },
  'partido-morado': {
    suit:      '#6A1B9A', suitDark: '#4a0e72', suitLight: '#8E24AA',
    tie:       '#f0c000', belt: '#5a3000', accent: '#f0c000',
  },
  'partido-pais-para-todos': {
    suit:      '#E53935', suitDark: '#b71c1c', suitLight: '#EF5350',
    tie:       '#003366', belt: '#5a3000', accent: '#003366',
  },
  'partido-patriotico-del-peru': {
    suit:      '#CC0000', suitDark: '#880000', suitLight: '#DD2222',
    tie:       '#f0c000', belt: '#5a3000', accent: '#f0c000',
  },
  'partido-politico-cooperacion-popular': {
    suit:      '#8B0000', suitDark: '#5a0000', suitLight: '#AA1111',
    tie:       '#f0c000', belt: '#5a3000', accent: '#f0c000',
  },
  'partido-politico-integridad-democratica': {
    suit:      '#1565C0', suitDark: '#0d3e7a', suitLight: '#2980d4',
    tie:       '#f0c000', belt: '#8b6914', accent: '#f0c000',
  },
  'partido-politico-nacional-peru-libre': {
    suit:      '#CC0000', suitDark: '#880000', suitLight: '#EE3333',
    tie:       '#f0c000', belt: '#5a3000', accent: '#f0c000',
  },
  'partido-politico-peru-accion': {
    suit:      '#FF6600', suitDark: '#cc4400', suitLight: '#ff8833',
    tie:       '#003366', belt: '#8b6914', accent: '#003366',
  },
  'partido-politico-peru-primero': {
    suit:      '#003366', suitDark: '#001f44', suitLight: '#1a4d8a',
    tie:       '#CC0000', belt: '#8b6914', accent: '#CC0000',
  },
  'partido-politico-prin': {
    suit:      '#006400', suitDark: '#004000', suitLight: '#1a7a1a',
    tie:       '#CC0000', belt: '#5a3000', accent: '#CC0000',
  },
  'partido-sicreo': {
    suit:      '#1a237e', suitDark: '#0d1457', suitLight: '#303f9f',
    tie:       '#CC0000', belt: '#8b6914', accent: '#CC0000',
  },
  'peru-moderno': {
    suit:      '#0077B6', suitDark: '#004e7a', suitLight: '#0096d4',
    tie:       '#f0c000', belt: '#8b6914', accent: '#f0c000',
  },
  'podemos-peru': {
    suit:      '#E53935', suitDark: '#b71c1c', suitLight: '#EF5350',
    tie:       '#f0c000', belt: '#5a3000', accent: '#f0c000',
  },
  'primero-la-gente': {
    suit:      '#2E7D32', suitDark: '#1b5e20', suitLight: '#43a047',
    tie:       '#CC0000', belt: '#5a3000', accent: '#CC0000',
  },
  'progresemos': {
    suit:      '#E65100', suitDark: '#BF360C', suitLight: '#F4511E',
    tie:       '#003366', belt: '#8b6914', accent: '#003366',
  },
  'renovacion-popular': {
    suit:      '#003366', suitDark: '#001f44', suitLight: '#1a4d8a',
    tie:       '#CC0000', belt: '#8b6914', accent: '#CC0000',
  },
  'salvemos-al-peru': {
    suit:      '#CC0000', suitDark: '#880000', suitLight: '#DD2222',
    tie:       '#003366', belt: '#5a3000', accent: '#003366',
  },
  'un-camino-diferente': {
    suit:      '#00897B', suitDark: '#00574f', suitLight: '#26A69A',
    tie:       '#f0c000', belt: '#5a3000', accent: '#f0c000',
  },
  'unidad-nacional': {
    suit:      '#1565C0', suitDark: '#0d3e7a', suitLight: '#2980d4',
    tie:       '#CC0000', belt: '#8b6914', accent: '#CC0000',
  },
}

// ── Generadores de frames con paleta dinámica ─────────────────────────────────

function neck(C, oy = 0) {
  return `<rect x="56" y="${neckTop + oy}" width="16" height="14" rx="2" fill="${C.skin}"/>`
}

function torso(C, oy = 0) {
  const ty = neckTop + 14 + oy
  return `
    <ellipse cx="64" cy="${184 + oy}" rx="30" ry="5" fill="${C.shadow}"/>
    <rect x="36" y="${156 + oy}" width="20" height="26" rx="3" fill="${C.boots}"/>
    <rect x="72" y="${156 + oy}" width="20" height="26" rx="3" fill="${C.boots}"/>
    <rect x="38" y="${124 + oy}" width="22" height="36" rx="2" fill="${C.suitDark}"/>
    <rect x="68" y="${124 + oy}" width="22" height="36" rx="2" fill="${C.suitDark}"/>
    <rect x="28" y="${ty}" width="72" height="50" rx="4" fill="${C.suit}"/>
    <polygon points="56,${ty} 72,${ty} 64,${ty + 22}" fill="${C.white}"/>
    <polygon points="56,${ty} 64,${ty + 4} 50,${ty + 22}" fill="${C.suitDark}"/>
    <polygon points="72,${ty} 64,${ty + 4} 78,${ty + 22}" fill="${C.suitDark}"/>
    <rect x="61" y="${ty + 8}" width="6" height="30" rx="2" fill="${C.tie}"/>
    <rect x="28" y="${ty + 44}" width="72" height="7" rx="2" fill="${C.belt}"/>
    <ellipse cx="28" cy="${ty + 6}" rx="13" ry="11" fill="${C.suitLight}"/>
    <ellipse cx="100" cy="${ty + 6}" rx="13" ry="11" fill="${C.suitLight}"/>
    ${neck(C, oy)}
  `
}

function idle_a(C, oy = 0) { return `
  ${torso(C, oy)}
  <rect x="8"  y="${neckTop + 18 + oy}" width="22" height="14" rx="4" fill="${C.suitLight}"/>
  <rect x="98" y="${neckTop + 18 + oy}" width="22" height="14" rx="4" fill="${C.suitLight}"/>
  <ellipse cx="18"  cy="${neckTop + 44 + oy}" rx="11" ry="11" fill="${C.skin}"/>
  <ellipse cx="110" cy="${neckTop + 44 + oy}" rx="11" ry="11" fill="${C.skin}"/>
` }

function idle_b(C) { return idle_a(C, -4) }

function attack_a(C, oy = 0) { return `
  ${torso(C, oy)}
  <rect x="8" y="${neckTop + 22 + oy}" width="20" height="12" rx="4" fill="${C.suitLight}"/>
  <ellipse cx="14" cy="${neckTop + 44 + oy}" rx="10" ry="10" fill="${C.skin}"/>
  <rect x="98" y="${neckTop + 14 + oy}" width="30" height="13" rx="4" fill="${C.suitLight}"/>
  <ellipse cx="130" cy="${neckTop + 20 + oy}" rx="13" ry="12" fill="${C.skin}"/>
` }

function attack_b(C) { return attack_a(C, -3) }

function hit(C, oy = 0) { return `
  ${torso(C, oy)}
  <rect x="6"  y="${neckTop + 16 + oy}" width="20" height="12" rx="4" fill="${C.suitLight}"/>
  <rect x="90" y="${neckTop + 16 + oy}" width="20" height="12" rx="4" fill="${C.suitLight}"/>
  <ellipse cx="12"  cy="${neckTop + 38 + oy}" rx="10" ry="10" fill="${C.skin}"/>
  <ellipse cx="104" cy="${neckTop + 38 + oy}" rx="10" ry="10" fill="${C.skin}"/>
  <text x="88" y="${FACE.y + 20 + oy}" font-size="24" fill="#FFD700">★</text>
  <text x="68" y="${FACE.y + 6 + oy}"  font-size="14" fill="#FF6600">✦</text>
` }

function ko_start(C) { return `
  ${torso(C, -2)}
  <rect x="10" y="${neckTop + 8}" width="30" height="12" rx="4" fill="${C.suitLight}" transform="rotate(-24 25 ${neckTop + 14})"/>
  <rect x="84" y="${neckTop + 6}" width="34" height="13" rx="4" fill="${C.suitLight}" transform="rotate(28 101 ${neckTop + 12})"/>
  <ellipse cx="18" cy="${neckTop + 34}" rx="11" ry="11" fill="${C.skin}"/>
  <ellipse cx="112" cy="${neckTop + 28}" rx="11" ry="11" fill="${C.skin}"/>
  <text x="90" y="${FACE.y + 12}" font-size="20" fill="#FFD700">✹</text>
  <text x="48" y="${FACE.y - 2}" font-size="18" fill="#ff8844">!</text>
` }

function ko_spin(C) { return `
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

function death(C) { return `
  <ellipse cx="64" cy="178" rx="54" ry="10" fill="${C.shadow}"/>
  <rect x="6"   y="150" width="116" height="28" rx="8" fill="${C.suit}"/>
  <rect x="6"   y="156" width="116" height="7"  rx="2" fill="${C.suitDark}"/>
  <rect x="96"  y="140" width="22" height="16" rx="3" fill="${C.boots}"/>
  <rect x="104" y="140" width="18" height="16" rx="3" fill="${C.boots}"/>
  <rect x="8"   y="138" width="44" height="14" rx="4" fill="${C.suitLight}"/>
  <ellipse cx="10" cy="144" rx="10" ry="10" fill="${C.skin}"/>
  <text x="50" y="142" font-size="20" fill="#FFD700">@</text>
` }

function makeFramesDef(C) {
  return [
    { name: 'idle_a',   body: idle_a(C)   },
    { name: 'idle_b',   body: idle_b(C)   },
    { name: 'attack_a', body: attack_a(C) },
    { name: 'attack_b', body: attack_b(C) },
    { name: 'hit',      body: hit(C)      },
    { name: 'ko_start', body: ko_start(C) },
    { name: 'ko_spin',  body: ko_spin(C)  },
    { name: 'death',    body: death(C)    },
  ]
}

function frameSVG(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W}" height="${FRAME_H}">${body}</svg>`
}

// ── Render de un partido ──────────────────────────────────────────────────────

async function renderParty(partyId, palette) {
  const C = { ...BASE, ...palette }
  const framesDef = makeFramesDef(C)

  const frameBuffers = await Promise.all(
    framesDef.map(({ body }) =>
      sharp(Buffer.from(frameSVG(body)))
        .resize(FRAME_W, FRAME_H)
        .png()
        .toBuffer()
    )
  )

  const sheetBuf = await sharp({
    create: { width: SHEET_W, height: SHEET_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(frameBuffers.map((buf, i) => ({ input: buf, left: i * FRAME_W, top: 0 })))
    .png()
    .toBuffer()

  return sheetBuf
}

// ── Main ──────────────────────────────────────────────────────────────────────

const outDir = resolve(ROOT, 'src/assets/sprites/parties')
mkdirSync(outDir, { recursive: true })

const partyIds = Object.keys(PARTY_COLORS)
console.log(`Generando spritesheets para ${partyIds.length} partidos...\n`)

let ok = 0
let fail = 0

for (const partyId of partyIds) {
  try {
    process.stdout.write(`  ${partyId}... `)
    const palette = PARTY_COLORS[partyId]
    const sheetBuf = await renderParty(partyId, palette)

    const pngPath  = resolve(outDir, `${partyId}.png`)
    const jsonPath = resolve(outDir, `${partyId}.json`)

    writeFileSync(pngPath, sheetBuf)

    const frameNames = ['idle_a','idle_b','attack_a','attack_b','hit','ko_start','ko_spin','death']
    const meta = {
      partyId,
      palette,
      frameWidth:  FRAME_W,
      frameHeight: FRAME_H,
      frameCount:  FRAMES,
      sheetWidth:  SHEET_W,
      sheetHeight: SHEET_H,
      faceRegion:  FACE,
      frames: frameNames.map((name, i) => ({
        name, index: i,
        x: i * FRAME_W, y: 0, w: FRAME_W, h: FRAME_H,
      })),
    }
    writeFileSync(jsonPath, JSON.stringify(meta, null, 2))

    console.log('✓')
    ok++
  } catch (err) {
    console.log(`✗ ${err.message}`)
    fail++
  }
}

// Guardar también un índice global
const indexPath = resolve(outDir, 'index.json')
writeFileSync(indexPath, JSON.stringify(
  partyIds.map(id => ({
    id,
    png:  `parties/${id}.png`,
    json: `parties/${id}.json`,
    palette: PARTY_COLORS[id],
  })),
  null, 2
))

console.log(`\nListo: ${ok} OK, ${fail} errores`)
console.log(`Output: ${outDir}`)
console.log(`Índice: ${indexPath}`)
