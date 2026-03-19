import { createTournamentRoster, instantiateRosterFighter } from './fighterFactory'

export function instantiateFighter(personaje) {
  return instantiateRosterFighter(personaje)
}

export function createTournamentFighters(count = 16) {
  return createTournamentRoster(count)
}

export function generateBracket(fighters) {
  const bracket = []
  let matchesInRound = Math.floor(fighters.length / 2)
  let round = 0

  while (matchesInRound >= 1) {
    for (let i = 0; i < matchesInRound; i++) {
      bracket.push({
        round,
        matchIndex: i,
        fighter1Idx: round === 0 ? i * 2 : null,
        fighter2Idx: round === 0 ? i * 2 + 1 : null,
        winnerIdx: null,
        status: 'pending',
      })
    }

    matchesInRound = Math.floor(matchesInRound / 2)
    round++
  }

  return bracket
}

export function getTotalRounds(bracket) {
  return bracket.length ? bracket[bracket.length - 1].round + 1 : 0
}

export function getMatchesInRound(bracket, roundIndex) {
  return bracket.filter(match => match.round === roundIndex).length
}

export function getRoundStartIndex(bracket, roundIndex) {
  const index = bracket.findIndex(match => match.round === roundIndex)
  return index === -1 ? 0 : index
}

export function getRoundName(bracket, roundIndex) {
  const matches = getMatchesInRound(bracket, roundIndex)
  const namesByMatches = {
    8: 'Octavos de Final',
    4: 'Cuartos de Final',
    2: 'Semifinales',
    1: 'Final',
  }

  return namesByMatches[matches] ?? `Ronda ${roundIndex + 1}`
}

export function advanceWinner(bracket, globalMatchIdx, winnerIdx) {
  const updated = bracket.map((match, idx) => {
    if (idx === globalMatchIdx) {
      return { ...match, winnerIdx, status: 'done' }
    }
    return match
  })

  const match = updated[globalMatchIdx]
  const nextRoundCount = getMatchesInRound(updated, match.round + 1)

  if (nextRoundCount > 0) {
    const nextRoundStart = getRoundStartIndex(updated, match.round + 1)
    const nextMatchOffset = Math.floor(match.matchIndex / 2)
    const nextGlobalIdx = nextRoundStart + nextMatchOffset
    const isFirstSlot = match.matchIndex % 2 === 0

    updated[nextGlobalIdx] = {
      ...updated[nextGlobalIdx],
      [isFirstSlot ? 'fighter1Idx' : 'fighter2Idx']: winnerIdx,
    }
  }

  return updated
}

export function getNextPendingMatch(bracket, currentRound) {
  const totalRounds = getTotalRounds(bracket)
  const roundStart = getRoundStartIndex(bracket, currentRound)
  const roundCount = getMatchesInRound(bracket, currentRound)

  for (let i = roundStart; i < roundStart + roundCount; i++) {
    if (bracket[i].status === 'pending' && bracket[i].fighter1Idx != null && bracket[i].fighter2Idx != null) {
      return i
    }
  }

  for (let round = currentRound + 1; round < totalRounds; round++) {
    const start = getRoundStartIndex(bracket, round)
    const count = getMatchesInRound(bracket, round)

    for (let i = start; i < start + count; i++) {
      if (bracket[i].status === 'pending' && bracket[i].fighter1Idx != null && bracket[i].fighter2Idx != null) {
        return i
      }
    }
  }

  return null
}

export function getCurrentRoundFromMatch(bracket, globalMatchIdx) {
  return bracket[globalMatchIdx]?.round ?? 0
}
