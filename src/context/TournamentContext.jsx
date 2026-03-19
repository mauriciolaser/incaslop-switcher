import { createContext, useContext, useReducer, useCallback } from 'react'
import {
  createTournamentFighters,
  generateBracket,
  advanceWinner,
  getNextPendingMatch,
} from '../utils/tournamentEngine'
import { healSurvivor } from '../utils/battleEngine'

const TournamentContext = createContext(null)

const initialState = {
  mode: 'menu', // 'menu' | 'endless' | 'torneo'
  fighters: [],
  bracket: [],
  tournamentSize: 16,
  currentGlobalMatchIdx: null,
  currentRound: 0,
  tournamentPhase: 'bracket', // 'bracket' | 'fighting' | 'champion'
  champion: null,
}

function createInitialState(initialMode = 'menu') {
  return {
    ...initialState,
    mode: initialMode,
  }
}

function tournamentReducer(state, action) {
  switch (action.type) {
    case 'SET_MODE':
      return { ...initialState, mode: action.mode }

    case 'INIT_TOURNAMENT': {
      const tournamentSize = action.size ?? 16
      const fighters = createTournamentFighters(tournamentSize)
      const bracket = generateBracket(fighters)
      return {
        ...state,
        mode: 'torneo',
        fighters,
        bracket,
        tournamentSize,
        currentGlobalMatchIdx: 0,
        currentRound: 0,
        tournamentPhase: 'bracket',
        champion: null,
      }
    }

    case 'SET_CURRENT_MATCH':
      return {
        ...state,
        currentGlobalMatchIdx: action.globalIdx,
        currentRound: state.bracket[action.globalIdx]?.round ?? state.currentRound,
        tournamentPhase: 'bracket',
      }

    case 'START_MATCH': {
      const bracket = state.bracket.map((m, i) => {
        if (i === state.currentGlobalMatchIdx) {
          return { ...m, status: 'current' }
        }
        return m
      })
      return { ...state, bracket, tournamentPhase: 'fighting' }
    }

    case 'MATCH_RESULT': {
      const { winnerSide } = action
      const match = state.bracket[state.currentGlobalMatchIdx]
      const winnerIdx = winnerSide === 'left' ? match.fighter1Idx : match.fighter2Idx
      const loserIdx = winnerSide === 'left' ? match.fighter2Idx : match.fighter1Idx

      // Update bracket
      const updatedBracket = advanceWinner(state.bracket, state.currentGlobalMatchIdx, winnerIdx)

      // Heal winner, mark loser dead
      const updatedFighters = state.fighters.map((f, i) => {
        if (i === winnerIdx) return healSurvivor(action.winnerFighter || f)
        if (i === loserIdx) return { ...f, alive: false }
        return f
      })

      // Find next match
      const nextMatchIdx = getNextPendingMatch(updatedBracket, match.round)
      const isTournamentOver = nextMatchIdx === null

      return {
        ...state,
        bracket: updatedBracket,
        fighters: updatedFighters,
        currentGlobalMatchIdx: nextMatchIdx,
        currentRound: isTournamentOver ? match.round : updatedBracket[nextMatchIdx]?.round ?? match.round,
        tournamentPhase: isTournamentOver ? 'champion' : 'bracket',
        champion: isTournamentOver ? updatedFighters[winnerIdx] : null,
      }
    }

    case 'RESET_TOURNAMENT':
      return { ...initialState, mode: 'menu' }

    default:
      return state
  }
}

export function TournamentProvider({ children, initialMode = 'menu' }) {
  const [state, dispatch] = useReducer(tournamentReducer, initialMode, createInitialState)

  const setMode = useCallback((mode) => {
    dispatch({ type: 'SET_MODE', mode })
  }, [])

  const initTournament = useCallback((size = 16) => {
    dispatch({ type: 'INIT_TOURNAMENT', size })
  }, [])

  const startMatch = useCallback(() => {
    dispatch({ type: 'START_MATCH' })
  }, [])

  const matchResult = useCallback((winnerSide, winnerFighter) => {
    dispatch({ type: 'MATCH_RESULT', winnerSide, winnerFighter })
  }, [])

  const resetTournament = useCallback(() => {
    dispatch({ type: 'RESET_TOURNAMENT' })
  }, [])

  return (
    <TournamentContext.Provider value={{
      ...state,
      setMode,
      initTournament,
      startMatch,
      matchResult,
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
