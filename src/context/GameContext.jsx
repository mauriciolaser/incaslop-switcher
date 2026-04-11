/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useReducer, useCallback } from 'react'
import { DEFAULT_STAKE, generateFighter, healSurvivor, normalizeStake } from '../utils/battleEngine'
import { prepareFighterForMatch } from '../utils/fighterFactory'

export const GameContext = createContext(null)

const INITIAL_COINS = 500

function createPlaceholderFighter(side) {
  return {
    id: `${side}-placeholder`,
    personajeId: null,
    candidateId: null,
    side,
    name: side === 'left' ? 'Esperando peleador...' : 'Esperando rival...',
    portraitUrl: null,
    party: '',
    partyImage: null,
    region: '',
    type: '',
    typeKey: '',
    partyId: null,
    maxHp: 100,
    hp: 100,
    attack: 0,
    defense: 0,
    speed: 0,
    alive: true,
    efectos: [],
    bio: '',
    dialogos: [],
    introDialog: 'La arena se esta preparando.',
    isPlayer: false,
  }
}

function createInitialState() {
  return {
    phase: 'intro',
    fighter1: createPlaceholderFighter('left'),
    fighter2: createPlaceholderFighter('right'),
    round: 1,
    coins: INITIAL_COINS,
    stake: DEFAULT_STAKE,
    bet: null,
    battleLog: [],
    currentTurn: null,
    lastResult: null,
    winner: null,
  }
}

const initialState = createInitialState()

function gameReducer(state, action) {
  switch (action.type) {
    case 'PLACE_BET':
      return { ...state, bet: action.side }

    case 'START_BETTING':
      return {
        ...state,
        phase: 'betting',
        currentTurn: null,
      }

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

    case 'SET_STAKE':
      return { ...state, stake: action.stake }

    case 'SET_FIGHTERS': {
      return {
        ...state,
        phase: 'intro',
        fighter1: prepareFighterForMatch(action.fighter1, 'left'),
        fighter2: prepareFighterForMatch(action.fighter2, 'right'),
        bet: null,
        battleLog: [],
        currentTurn: null,
        winner: null,
        lastResult: null,
        stake: normalizeStake(state.stake, state.coins),
      }
    }

    case 'RESET_GAME':
      return {
        ...createInitialState(),
        fighter1: prepareFighterForMatch(generateFighter('left'), 'left'),
        fighter2: prepareFighterForMatch(generateFighter('right'), 'right'),
      }

    case 'NEXT_ROUND': {
      const survivorKey = state.winner === 'left' ? 'fighter1' : 'fighter2'
      const healedSurvivor = healSurvivor(state[survivorKey])
      const newOpponent = generateFighter(state.winner === 'left' ? 'right' : 'left')

      return {
        ...state,
        phase: 'intro',
        fighter1: prepareFighterForMatch(state.winner === 'left' ? healedSurvivor : newOpponent, 'left'),
        fighter2: prepareFighterForMatch(state.winner === 'right' ? healedSurvivor : newOpponent, 'right'),
        round: state.round + 1,
        stake: normalizeStake(state.stake, state.coins),
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

export function LocalGameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  const placeBet = useCallback((side) => {
    dispatch({ type: 'PLACE_BET', side })
  }, [])

  const startBetting = useCallback(() => {
    dispatch({ type: 'START_BETTING' })
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

  const setStake = useCallback((stake) => {
    dispatch({ type: 'SET_STAKE', stake })
  }, [])

  const nextRound = useCallback(() => {
    dispatch({ type: 'NEXT_ROUND' })
  }, [])

  const setFighters = useCallback((fighter1, fighter2) => {
    dispatch({ type: 'SET_FIGHTERS', fighter1, fighter2 })
  }, [])

  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET_GAME' })
  }, [])

  return (
    <GameContext.Provider value={{
      ...state,
      isOnline: false,
      connectionStatus: 'local',
      countdown: null,
      onlineError: null,
      placeBet,
      startBetting,
      startBattle,
      addLog,
      updateFighter,
      setCurrentTurn,
      fightEnded,
      setStake,
      nextRound,
      setFighters,
      resetGame,
    }}>
      {children}
    </GameContext.Provider>
  )
}

export const GameProvider = LocalGameProvider

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
