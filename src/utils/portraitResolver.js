// Resuelve rutas de retratos de candidatos al asset procesado por Vite.
// Puede recibir rutas relativas ("images/candidates/..."), rutas con slash inicial,
// rutas de uploads del backend o URLs absolutas a la API de candidatos.

const candidateAssets = import.meta.glob(
  '../assets/images/candidates/*.webp',
  { eager: true, import: 'default' },
)

// Construye un mapa: "images/candidates/cand_xxx.webp" → URL del asset
const portraitMap = {}
for (const [modulePath, url] of Object.entries(candidateAssets)) {
  // modulePath: "../assets/images/candidates/cand_xxx.webp"
  const filename = modulePath.split('/').pop()
  portraitMap[`images/candidates/${filename}`] = url
}

function normalizePortraitKey(portraitPath) {
  if (!portraitPath) return null

  let value = String(portraitPath).trim()
  if (!value) return null

  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname
    } catch {
      return null
    }
  }

  value = value.replace(/\\/g, '/')
  const filename = value.split('/').pop()

  if (!filename) return null

  return `images/candidates/${filename}`
}

export function resolvePortraitUrl(portraitPath) {
  const key = normalizePortraitKey(portraitPath)
  if (!key) return null
  return portraitMap[key] ?? null
}
