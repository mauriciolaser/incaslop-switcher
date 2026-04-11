function normalizePartyImageKey(partyImagePath) {
  if (!partyImagePath) return null

  let value = String(partyImagePath).trim()
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

  return `images/partidos/${filename}`
}

export function resolvePartyImageUrl(partyImagePath) {
  const key = normalizePartyImageKey(partyImagePath)
  if (!key) return null
  return `/${key}`
}
