export const KO_IMPACT_HOLD_MS = 450
export const KO_SPIN_DURATION_MS = 1800
export const KO_RECOVERY_BUFFER_MS = 350
export const KO_TOTAL_DURATION_MS = KO_IMPACT_HOLD_MS + KO_SPIN_DURATION_MS + KO_RECOVERY_BUFFER_MS

export function createKoState({ winnerSide, loserSide, startedAt = Date.now() }) {
  return {
    winnerSide,
    loserSide,
    startedAt,
    impactHoldMs: KO_IMPACT_HOLD_MS,
    spinDurationMs: KO_SPIN_DURATION_MS,
    totalDurationMs: KO_TOTAL_DURATION_MS,
  }
}

export function getKoProgress(koState, now = Date.now()) {
  if (!koState) return 0
  const startedAtMs = typeof koState.startedAt === 'number'
    ? koState.startedAt
    : new Date(koState.startedAt).getTime()
  const durationMs = koState.totalDurationMs ?? KO_TOTAL_DURATION_MS
  if (!Number.isFinite(startedAtMs) || durationMs <= 0) return 0
  return Math.max(0, Math.min(1, (now - startedAtMs) / durationMs))
}
