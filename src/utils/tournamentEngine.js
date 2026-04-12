import { healSurvivor } from './battleEngine'
import { createTournamentRoster, prepareFighterForMatch } from './fighterFactory'
import { simulateFight } from './fightSimulator'

export function createTournamentFighters(selectedCandidate, count = 16) {
  return createTournamentRoster(selectedCandidate, count)
}

export function generateBracket(fighters) {
  const bracket = []
  let matchesInRound = Math.floor(fighters.length / 2)
  let round = 0

  while (matchesInRound >= 1) {
    for (let i = 0; i < matchesInRound; i += 1) {
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
    round += 1
  }

  return bracket
}

export function getTotalRounds(bracket) {
  return bracket.length ? bracket[bracket.length - 1].round + 1 : 0
}

export function getMatchesInRound(bracket, roundIndex) {
  return bracket.filter((match) => match.round === roundIndex).length
}

export function getRoundStartIndex(bracket, roundIndex) {
  const index = bracket.findIndex((match) => match.round === roundIndex)
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

export function getCurrentMatch(bracket, currentGlobalMatchIdx) {
  if (currentGlobalMatchIdx == null) return null
  return bracket[currentGlobalMatchIdx] ?? null
}

export function isReadyMatch(match) {
  return Boolean(match && match.status === 'pending' && match.fighter1Idx != null && match.fighter2Idx != null)
}

export function isPlayerMatch(match, playerFighterIdx) {
  if (!match || playerFighterIdx == null) return false
  return match.fighter1Idx === playerFighterIdx || match.fighter2Idx === playerFighterIdx
}

export function getMatchFighters(fighters, match) {
  if (!match) return { fighter1: null, fighter2: null }
  return {
    fighter1: match.fighter1Idx != null ? fighters[match.fighter1Idx] : null,
    fighter2: match.fighter2Idx != null ? fighters[match.fighter2Idx] : null,
  }
}

export function listMatchIndicesForRound(bracket, roundIndex) {
  const start = getRoundStartIndex(bracket, roundIndex)
  const count = getMatchesInRound(bracket, roundIndex)
  return Array.from({ length: count }, (_, index) => start + index)
}

export function isRoundComplete(bracket, roundIndex) {
  return listMatchIndicesForRound(bracket, roundIndex)
    .every((matchIndex) => bracket[matchIndex]?.status === 'done')
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

export function getNextPendingMatch(bracket, currentRound = 0) {
  const totalRounds = getTotalRounds(bracket)

  for (let round = currentRound; round < totalRounds; round += 1) {
    const indices = listMatchIndicesForRound(bracket, round)
    const foundIndex = indices.find((matchIndex) => isReadyMatch(bracket[matchIndex]))
    if (foundIndex != null) {
      return foundIndex
    }
  }

  return null
}

export function resolveTournamentMatch({
  fighters,
  bracket,
  currentGlobalMatchIdx,
  winnerSide,
  winnerFighter,
  loserFighter,
  playerFighterIdx,
}) {
  const match = bracket[currentGlobalMatchIdx]
  if (!match) {
    return null
  }

  const winnerIdx = winnerSide === 'left' ? match.fighter1Idx : match.fighter2Idx
  const loserIdx = winnerSide === 'left' ? match.fighter2Idx : match.fighter1Idx
  const updatedBracket = advanceWinner(bracket, currentGlobalMatchIdx, winnerIdx)
  const updatedFighters = fighters.map((fighter, index) => {
    if (index === winnerIdx) {
      return healSurvivor({
        ...(winnerFighter ?? fighter),
        alive: true,
      })
    }
    if (index === loserIdx) {
      return {
        ...(loserFighter ?? fighter),
        hp: 0,
        alive: false,
        efectos: [],
      }
    }
    return fighter
  })

  const nextMatchIdx = getNextPendingMatch(updatedBracket, match.round)
  const champion = nextMatchIdx == null ? updatedFighters[winnerIdx] : null
  const playerStillAlive = playerFighterIdx == null
    ? false
    : Boolean(updatedFighters[playerFighterIdx]?.alive)

  return {
    bracket: updatedBracket,
    fighters: updatedFighters,
    currentGlobalMatchIdx: nextMatchIdx,
    currentRound: nextMatchIdx == null ? match.round : updatedBracket[nextMatchIdx]?.round ?? match.round,
    champion,
    playerStillAlive,
    resolvedMatch: match,
    winnerIdx,
    loserIdx,
    roundCompleted: isRoundComplete(updatedBracket, match.round),
  }
}

export function simulateTournamentMatch({ fighters, bracket, currentGlobalMatchIdx }) {
  const match = getCurrentMatch(bracket, currentGlobalMatchIdx)
  const { fighter1, fighter2 } = getMatchFighters(fighters, match)
  if (!fighter1 || !fighter2) {
    return null
  }

  return simulateFight(
    prepareFighterForMatch(fighter1, 'left'),
    prepareFighterForMatch(fighter2, 'right'),
  )
}

export function getBracketSideMatches(bracket, side, totalRounds = getTotalRounds(bracket)) {
  const finalRound = totalRounds - 1

  return Array.from({ length: Math.max(finalRound, 0) }, (_, round) => {
    const matches = bracket.filter((match) => match.round === round)
    const midpoint = Math.ceil(matches.length / 2)
    return side === 'left'
      ? matches.slice(0, midpoint)
      : matches.slice(midpoint)
  })
}
