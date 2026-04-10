// Resuelve rutas de retratos de candidatos al asset procesado por Vite.
// El backend envía portraitUrl como ruta relativa: "images/candidates/cand_xxx.webp"
// import.meta.glob genera un mapa de esas rutas a las URLs reales del bundle.

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

export function resolvePortraitUrl(portraitPath) {
  if (!portraitPath) return null
  return portraitMap[portraitPath] ?? null
}
