// Resuelve retratos de candidatos a una ruta publica estable.
// La fuente de verdad vive en src/assets/images/candidates, pero durante dev/build
// esa carpeta se expone como /images/candidates para no depender de assets hasheados
// ni meter miles de imagenes dentro del bundle JS.

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
  return `/${key}`
}
