/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useReducer } from 'react'
import {
  createTournamentFighters,
  generateBracket,
  getCurrentMatch,
  getMatchFighters,
  getNextPendingMatch,
  getRoundName,
  isPlayerMatch,
  resolveTournamentMatch,
  simulateTournamentMatch,
} from '../utils/tournamentEngine'

const TournamentContext = createContext(null)

const initialState = {
  stage: 'idle',
  fighters: [],
  bracket: [],
  tournamentSize: 32,
  currentGlobalMatchIdx: null,
  currentRound: 0,
  champion: null,
  selectedCandidate: null,
  playerFighterIdx: null,
  playerStatus: 'alive',
  watchMode: 'none',
  roundSummary: null,
}

function buildRoundSummary(state, resolution) {
  const playerMatch = isPlayerMatch(resolution.resolvedMatch, state.playerFighterIdx)
  const playerAdvanced = playerMatch && resolution.playerStillAlive
  const playerEliminated = state.playerFighterIdx != null && !resolution.playerStillAlive

  return {
    round: resolution.resolvedMatch.round,
    roundName: getRoundName(resolution.bracket, resolution.resolvedMatch.round),
    playerMatch,
    playerAdvanced,
    playerEliminated,
    playerStillAlive: resolution.playerStillAlive,
    roundCompleted: resolution.roundCompleted,
  }
}

function tournamentReducer(state, action) {
  switch (action.type) {
    case 'OPEN_SETUP':
      return {
        ...initialState,
        stage: 'setup',
      }

    case 'INIT_TOURNAMENT': {
      const fighters = createTournamentFighters(action.selectedCandidate, action.size ?? 32)
      const playerFighterIdx = fighters.findIndex((fighter) => fighter.candidateId === String(action.selectedCandidate.id))
      const bracket = generateBracket(fighters)

      return {
        ...state,
        stage: 'bracket',
        fighters,
        bracket,
        tournamentSize: action.size ?? 32,
        currentGlobalMatchIdx: getNextPendingMatch(bracket, 0),
        currentRound: 0,
        champion: null,
        selectedCandidate: action.selectedCandidate,
        playerFighterIdx,
        playerStatus: 'alive',
        watchMode: 'none',
        roundSummary: null,
      }
    }

    case 'START_MATCH':
      return {
        ...state,
        stage: 'fighting',
        watchMode: action.watchMode,
        bracket: state.bracket.map((match, index) => {
          if (index === state.currentGlobalMatchIdx) {
            return { ...match, status: 'current' }
          }
          return match
        }),
      }

    case 'RESOLVE_MATCH': {
      const resolution = resolveTournamentMatch({
        fighters: state.fighters,
        bracket: state.bracket,
        currentGlobalMatchIdx: state.currentGlobalMatchIdx,
        winnerSide: action.winnerSide,
        winnerFighter: action.winnerFighter,
        loserFighter: action.loserFighter,
        playerFighterIdx: state.playerFighterIdx,
      })

      if (!resolution) {
        return state
      }

      const roundSummary = buildRoundSummary(state, resolution)
      const playerStatus = resolution.champion && state.playerFighterIdx === resolution.winnerIdx
        ? 'champion'
        : resolution.playerStillAlive ? 'alive' : 'eliminated'

      return {
        ...state,
        bracket: resolution.bracket,
        fighters: resolution.fighters,
        currentGlobalMatchIdx: resolution.currentGlobalMatchIdx,
        currentRound: resolution.currentRound,
        champion: resolution.champion,
        stage: resolution.champion ? 'champion' : roundSummary.playerMatch ? 'round_summary' : 'bracket',
        playerStatus,
        watchMode: 'none',
        roundSummary,
      }
    }

    case 'CONTINUE_AFTER_SUMMARY':
      return {
        ...state,
        stage: state.champion ? 'champion' : 'bracket',
        roundSummary: null,
      }

    case 'SIMULATE_CURRENT_MATCH': {
      const simulation = simulateTournamentMatch({
        fighters: state.fighters,
        bracket: state.bracket,
        currentGlobalMatchIdx: state.currentGlobalMatchIdx,
      })

      if (!simulation) {
        return state
      }

      return tournamentReducer(state, {
        type: 'RESOLVE_MATCH',
        winnerSide: simulation.winnerSide,
        winnerFighter: simulation.winnerFighter,
        loserFighter: simulation.loserFighter,
      })
    }

    case 'SIMULATE_REST_OF_ROUND': {
      let draftState = state
      const originRound = state.currentRound

      while (
        draftState.currentGlobalMatchIdx != null &&
        draftState.bracket[draftState.currentGlobalMatchIdx]?.round === originRound &&
        !isPlayerMatch(draftState.bracket[draftState.currentGlobalMatchIdx], draftState.playerFighterIdx)
      ) {
        const simulation = simulateTournamentMatch({
          fighters: draftState.fighters,
          bracket: draftState.bracket,
          currentGlobalMatchIdx: draftState.currentGlobalMatchIdx,
        })

        if (!simulation) {
          break
        }

        draftState = tournamentReducer(draftState, {
          type: 'RESOLVE_MATCH',
          winnerSide: simulation.winnerSide,
          winnerFighter: simulation.winnerFighter,
          loserFighter: simulation.loserFighter,
        })

        if (draftState.stage === 'round_summary') {
          break
        }
      }

      return draftState
    }

    case 'RESET_TOURNAMENT':
      return {
        ...initialState,
        stage: 'setup',
      }

    default:
      return state
  }
}

export function TournamentProvider({ children }) {
  const [state, dispatch] = useReducer(tournamentReducer, {
    ...initialState,
    stage: 'setup',
  })

  const openSetup = useCallback(() => {
    dispatch({ type: 'OPEN_SETUP' })
  }, [])

  const initTournament = useCallback((selectedCandidate, size = 32) => {
    dispatch({ type: 'INIT_TOURNAMENT', selectedCandidate, size })
  }, [])

  const startMatch = useCallback((watchMode = 'watch') => {
    dispatch({ type: 'START_MATCH', watchMode })
  }, [])

  const resolveMatch = useCallback((winnerSide, winnerFighter, loserFighter) => {
    dispatch({ type: 'RESOLVE_MATCH', winnerSide, winnerFighter, loserFighter })
  }, [])

  const continueAfterSummary = useCallback(() => {
    dispatch({ type: 'CONTINUE_AFTER_SUMMARY' })
  }, [])

  const simulateCurrentMatch = useCallback(() => {
    dispatch({ type: 'SIMULATE_CURRENT_MATCH' })
  }, [])

  const skipRound = useCallback(() => {
    dispatch({ type: 'SIMULATE_REST_OF_ROUND' })
  }, [])

  const resetTournament = useCallback(() => {
    dispatch({ type: 'RESET_TOURNAMENT' })
  }, [])

  const currentMatch = useMemo(
    () => getCurrentMatch(state.bracket, state.currentGlobalMatchIdx),
    [state.bracket, state.currentGlobalMatchIdx],
  )

  const currentMatchFighters = useMemo(
    () => getMatchFighters(state.fighters, currentMatch),
    [currentMatch, state.fighters],
  )

  const isCurrentPlayerMatch = useMemo(
    () => isPlayerMatch(currentMatch, state.playerFighterIdx),
    [currentMatch, state.playerFighterIdx],
  )

  return (
    <TournamentContext.Provider value={{
      ...state,
      currentMatch,
      currentMatchFighters,
      isCurrentPlayerMatch,
      openSetup,
      initTournament,
      startMatch,
      resolveMatch,
      continueAfterSummary,
      simulateCurrentMatch,
      skipRound,
      resetTournament,
    }}>
      {children}
    </TournamentContext.Provider>
  )
}

export function useTournament() {
  const ctx = useContext(TournamentContext)
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider')
  return ctx
}
