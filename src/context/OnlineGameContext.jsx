import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameContext } from './GameContext'
import { DEFAULT_STAKE, STAKE_OPTIONS, normalizeStake } from '../utils/battleEngine'
import {
  closeOnlineSession,
  createOnlineSession,
  fetchOnlineEvents,
  fetchOnlineState,
  submitOnlineBet,
} from '../utils/onlineApi'
import { resolvePortraitUrl } from '../utils/portraitResolver'
import { resolvePartyImageUrl } from '../utils/partyResolver'

function resolveTransparentUrl(transparentImage) {
  if (!transparentImage) return null
  const s = String(transparentImage).trim()
  if (!s) return null
  return s.startsWith('/') ? s : `/${s}`
}

function resolveFighterPortrait(fighter) {
  if (!fighter) return fighter
  const resolved = resolvePortraitUrl(fighter.portraitUrl)
  const resolvedPartyImage = resolvePartyImageUrl(fighter.partyImage)
  const resolvedTransparent = resolveTransparentUrl(fighter.transparentUrl ?? fighter.transparentImage ?? null)
  return {
    ...fighter,
    portraitUrl: resolved ?? fighter.portraitUrl,
    partyImage: resolvedPartyImage ?? fighter.partyImage,
    transparentUrl: resolvedTransparent ?? fighter.transparentUrl ?? null,
  }
}

const POLL_INTERVAL = 1500

function createPlaceholderFighter(side) {
  return {
    id: `${side}-placeholder`,
    personajeId: null,
    side,
    name: side === 'left' ? 'Conectando...' : 'Esperando rival...',
    portraitUrl: null,
    partyImage: null,
    maxHp: 100,
    hp: 100,
    attack: 0,
    defense: 0,
    speed: 0,
    alive: true,
    efectos: [],
    introDialog: 'La arena online se esta preparando.',
  }
}

function createInitialState() {
  return {
    phase: 'intro',
    fighter1: createPlaceholderFighter('left'),
    fighter2: createPlaceholderFighter('right'),
    round: 1,
    coins: 10,
    stake: DEFAULT_STAKE,
    bet: null,
    battleLog: [],
    currentTurn: null,
    lastResult: null,
    winner: null,
    koState: null,
    isOnline: true,
    connectionStatus: 'connecting',
    countdown: null,
    onlineError: null,
    latestEventId: 0,
    viewer: null,
    players: [],
    gameOver: false,
    eliminationReason: null,
    playerStats: {
      roundsPlayed: 0,
      fightsWon: 0,
    },
  }
}

function mapStateResponse(payload, previousState) {
  const remoteState = payload.state ?? {}
  const viewer = payload.viewer ?? {}
  const players = Array.isArray(payload.players) ? payload.players : previousState.players

  const eliminationReason = viewer.eliminationReason
    ?? (viewer.gameOver && Number(viewer.coins ?? 0) <= 0 ? 'no_coins' : null)

  return {
    phase: remoteState.phase ?? previousState.phase,
    fighter1: resolveFighterPortrait(remoteState.fighter1) ?? previousState.fighter1,
    fighter2: resolveFighterPortrait(remoteState.fighter2) ?? previousState.fighter2,
    round: remoteState.round ?? previousState.round,
    battleLog: remoteState.battleLog ?? previousState.battleLog,
    currentTurn: remoteState.currentTurn ?? null,
    winner: remoteState.winner ?? null,
    koState: remoteState.koState ?? null,
    lastResult: viewer.lastResult ?? remoteState.lastResult ?? (viewer.gameOver ? previousState.lastResult : null),
    coins: viewer.coins ?? previousState.coins,
    stake: normalizeStake(viewer.pendingStake ?? previousState.stake ?? DEFAULT_STAKE, viewer.coins ?? previousState.coins),
    bet: viewer.currentBet?.side ?? null,
    countdown: typeof remoteState.countdown === 'number' ? remoteState.countdown : null,
    latestEventId: payload.latestEventId ?? previousState.latestEventId ?? 0,
    viewer,
    players,
    gameOver: Boolean(viewer.gameOver),
    eliminationReason,
    playerStats: {
      roundsPlayed: Number(viewer.stats?.roundsPlayed ?? previousState.playerStats?.roundsPlayed ?? 0),
      fightsWon: Number(viewer.stats?.fightsWon ?? previousState.playerStats?.fightsWon ?? 0),
    },
  }
}

export function OnlineGameProvider({ children }) {
  const [state, setState] = useState(createInitialState)
  const latestEventIdRef = useRef(0)
  const pollingRef = useRef(null)
  const stateRef = useRef(state)
  const leaveRef = useRef(false)

  stateRef.current = state

  const syncFromSnapshot = useCallback((payload) => {
    setState((current) => {
      const next = mapStateResponse(payload, current)
      latestEventIdRef.current = next.latestEventId
      return {
        ...current,
        ...next,
        isOnline: true,
        connectionStatus: 'connected',
        onlineError: null,
      }
    })
  }, [])

  const refreshState = useCallback(async () => {
    const payload = await fetchOnlineState()
    syncFromSnapshot(payload)
    return payload
  }, [syncFromSnapshot])

  const refreshEvents = useCallback(async () => {
    const payload = await fetchOnlineEvents(latestEventIdRef.current)
    if (Array.isArray(payload.events) && payload.events.length > 0) {
      latestEventIdRef.current = payload.latestEventId ?? latestEventIdRef.current

      setState((current) => {
        const appendedEntries = payload.events
          .map((event) => event.payload?.logEntry)
          .filter(Boolean)

        return {
          ...current,
          battleLog: appendedEntries.length > 0
            ? [...current.battleLog, ...appendedEntries].slice(-60)
            : current.battleLog,
        }
      })
    }
    return payload
  }, [])

  const runPollingCycle = useCallback(async () => {
    try {
      await Promise.all([refreshEvents(), refreshState()])
    } catch (error) {
      setState((current) => ({
        ...current,
        connectionStatus: 'error',
        onlineError: error.message,
      }))
    }
  }, [refreshEvents, refreshState])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const payload = await createOnlineSession()
        if (cancelled) return
        syncFromSnapshot(payload)
      } catch (error) {
        if (cancelled) return
        setState((current) => ({
          ...current,
          connectionStatus: 'error',
          onlineError: error.message,
        }))
      }
    }

    void bootstrap()
    pollingRef.current = window.setInterval(() => {
      void runPollingCycle()
    }, POLL_INTERVAL)

    return () => {
      cancelled = true
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current)
      }
      if (!leaveRef.current) {
        void closeOnlineSession().catch(() => {})
      }
    }
  }, [runPollingCycle, syncFromSnapshot])

  const placeBet = useCallback(async (side) => {
    try {
      if (stateRef.current.gameOver) {
        throw new Error('Tu run ya termino. Vuelve al home para iniciar otro.')
      }
      const amount = normalizeStake(stateRef.current.stake, stateRef.current.coins)
      const payload = await submitOnlineBet({ side, amount })
      syncFromSnapshot(payload)
    } catch (error) {
      setState((current) => ({
        ...current,
        onlineError: error.message,
      }))
      throw error
    }
  }, [syncFromSnapshot])

  const setStake = useCallback((stake) => {
    setState((current) => ({
      ...current,
      stake: normalizeStake(stake, current.coins),
    }))
  }, [])

  const leaveOnlineSession = useCallback(async () => {
    leaveRef.current = true
    try {
      await closeOnlineSession()
    } catch {
      // noop
    }
  }, [])

  const contextValue = useMemo(() => ({
    ...state,
    isOnline: true,
    startBetting: () => {},
    startBattle: () => {},
    addLog: () => {},
    startKo: () => {},
    updateFighter: () => {},
    setCurrentTurn: () => {},
    fightEnded: () => {},
    nextRound: () => {},
    setFighters: () => {},
    resetGame: () => {},
    placeBet,
    setStake: (stake) => {
      if (!STAKE_OPTIONS.includes(stake)) return
      setStake(stake)
    },
    refreshOnlineState: refreshState,
    leaveOnlineSession,
  }), [leaveOnlineSession, placeBet, refreshState, setStake, state])

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  )
}
