import { createContext, useContext, useReducer, useCallback } from 'react'
import { generateFighter, generateStake } from '../utils/battleEngine'

const GameContext = createContext(null)

const INITIAL_COINS = 500

const initialState = {
  phase: 'betting',
  fighter1: generateFighter('left'),
  fighter2: generateFighter('right'),
  round: 1,
  coins: INITIAL_COINS,
  stake: generateStake(),
  bet: null,
  battleLog: [],
  currentTurn: null,
  lastResult: null,
  winner: null,
}

function gameReducer(state, action) {
  switch (action.type) {
    case 'PLACE_BET':
      return { ...state, bet: action.side }

    case 'START_BATTLE':
      return {
        ...state,
        phase: 'fighting',
        battleLog: [],
        lastResult: null,
        winner: null,
      }

    case 'ADD_LOG': {
      return {
        ...state,
        battleLog: [...state.battleLog, action.entry],
      }
    }

    case 'UPDATE_FIGHTER': {
      const key = action.side === 'left' ? 'fighter1' : 'fighter2'
      return { ...state, [key]: action.fighter }
    }

    case 'SET_CURRENT_TURN':
      return { ...state, currentTurn: action.side }

    case 'FIGHT_ENDED': {
      const { winnerSide, loserSide } = action
      const betResult = state.bet === winnerSide ? 'win' : state.bet === loserSide ? 'lose' : 'none'
      let coinDelta = 0
      if (betResult === 'win') coinDelta = state.stake
      if (betResult === 'lose') coinDelta = -state.stake

      return {
        ...state,
        phase: 'result',
        winner: winnerSide,
        coins: Math.max(0, state.coins + coinDelta),
        lastResult: {
          winnerSide,
          betResult,
          coinDelta,
          stake: state.stake,
        },
      }
    }

    case 'NEXT_ROUND': {
      const survivorKey = state.winner === 'left' ? 'fighter1' : 'fighter2'
      const survivor = state[survivorKey]
      const healAmount = Math.floor(survivor.maxHp * 0.2)
      const healedSurvivor = {
        ...survivor,
        hp: Math.min(survivor.maxHp, survivor.hp + healAmount),
      }
      const newOpponent = generateFighter(state.winner === 'left' ? 'right' : 'left')

      return {
        ...state,
        phase: 'betting',
        fighter1: state.winner === 'left' ? healedSurvivor : newOpponent,
        fighter2: state.winner === 'right' ? healedSurvivor : newOpponent,
        round: state.round + 1,
        stake: generateStake(),
        bet: null,
        battleLog: [],
        currentTurn: null,
        winner: null,
        lastResult: null,
      }
    }

    default:
      return state
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  const placeBet = useCallback((side) => {
    dispatch({ type: 'PLACE_BET', side })
  }, [])

  const startBattle = useCallback(() => {
    dispatch({ type: 'START_BATTLE' })
  }, [])

  const addLog = useCallback((entry) => {
    dispatch({ type: 'ADD_LOG', entry })
  }, [])

  const updateFighter = useCallback((side, fighter) => {
    dispatch({ type: 'UPDATE_FIGHTER', side, fighter })
  }, [])

  const setCurrentTurn = useCallback((side) => {
    dispatch({ type: 'SET_CURRENT_TURN', side })
  }, [])

  const fightEnded = useCallback((winnerSide, loserSide) => {
    dispatch({ type: 'FIGHT_ENDED', winnerSide, loserSide })
  }, [])

  const nextRound = useCallback(() => {
    dispatch({ type: 'NEXT_ROUND' })
  }, [])

  return (
    <GameContext.Provider value={{
      ...state,
      placeBet,
      startBattle,
      addLog,
      updateFighter,
      setCurrentTurn,
      fightEnded,
      nextRound,
    }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
