import ataques from '../data/ataques.json'

const DEFAULT_FLASH = {
  color: '#9ac0ff',
  label: 'Impacto especial',
}

export function getEffectVisual(effectId) {
  const effect = ataques.efectos?.[effectId]
  if (!effect) return null

  return {
    color: effect.color || DEFAULT_FLASH.color,
    label: effect.nombre || DEFAULT_FLASH.label,
  }
}

export function getLogEntryVisual(entry) {
  if (!entry) return null

  if (entry.ataque?.efecto) {
    const effectVisual = getEffectVisual(entry.ataque.efecto)
    if (effectVisual) return effectVisual
  }

  if (entry.ataque?.color) {
    return {
      color: entry.ataque.color,
      label: entry.ataque.nombre || DEFAULT_FLASH.label,
    }
  }

  return null
}
