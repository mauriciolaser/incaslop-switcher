import { resolvePortraitUrl } from './portraitResolver'
import { resolvePartyImageUrl } from './partyResolver'
import partyCatalog from '../data/parties.json'

const DEFAULT_CANDIDATE_API_BASE = 'https://api.candidatos.incaslop.online'
const PAGE_SIZE = 500
const MIN_POOL_SIZE = 2
const LEGISLATIVE_TYPE_KEYS = new Set(['diputado', 'senador'])

const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000]

const API_BASE = import.meta.env.VITE_CANDIDATE_API_BASE?.replace(/\/$/, '') ?? DEFAULT_CANDIDATE_API_BASE

let candidatePool = []
let loadingPromise = null
const partyCatalogMap = new Map(
  partyCatalog
    .filter((party) => party?.name)
    .map((party) => [String(party.name).trim(), party]),
)

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRetryDelay(attempt) {
  const index = Math.min(Math.max(attempt - 1, 0), RETRY_DELAYS_MS.length - 1)
  return RETRY_DELAYS_MS[index]
}

function normalizeCandidate(raw = {}) {
  const id = String(raw.id ?? '').trim()
  const name = String(raw.name ?? '').trim()
  const party = String(raw.party ?? '').trim()
  const rawPortrait = raw.portraitImage || raw.portraitUrl || raw.imageUrl || null
  const partyData = partyCatalogMap.get(party) ?? null
  const rawPartyImage = raw.partyImage || partyData?.partyImage || null
  const portraitUrl = resolvePortraitUrl(rawPortrait) ?? rawPortrait
  const partyImage = resolvePartyImageUrl(rawPartyImage) ?? rawPartyImage
  const typeKey = String(raw.typeKey ?? raw.type ?? '').trim().toLowerCase()

  if (!id || !name) return null

  return {
    id,
    name,
    party,
    partyImage,
    region: String(raw.region ?? '').trim(),
    type: String(raw.type ?? '').trim(),
    typeKey,
    partyId: raw.partyId ?? null,
    portraitUrl,
  }
}

function dedupeCandidates(candidates) {
  const seen = new Set()
  return candidates.filter((candidate) => {
    if (!candidate?.id || seen.has(candidate.id)) {
      return false
    }
    seen.add(candidate.id)
    return true
  })
}

async function fetchCandidatePage(page) {
  const url = `${API_BASE}/v1/candidates?page=${page}&pageSize=${PAGE_SIZE}`
  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`)
  }

  if (!Array.isArray(data?.candidates)) {
    throw new Error('Candidate API payload invalido: candidates ausente.')
  }

  return data
}

async function fetchAllCandidatePagesOnce() {
  const firstPage = await fetchCandidatePage(1)
  const totalPages = Math.max(1, Number(firstPage?.pagination?.totalPages || 1))
  const additionalPages = totalPages > 1
    ? await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) => fetchCandidatePage(index + 2)),
      )
    : []

  const merged = [firstPage, ...additionalPages]
    .flatMap((payload) => payload.candidates)
    .map(normalizeCandidate)
    .filter(Boolean)

  const unique = dedupeCandidates(merged)

  if (unique.length < MIN_POOL_SIZE) {
    throw new Error(`Pool insuficiente de candidatos (${unique.length}).`)
  }

  return unique
}

async function loadCandidatePoolWithRetry() {
  let attempt = 0

  while (candidatePool.length < MIN_POOL_SIZE) {
    attempt += 1

    try {
      candidatePool = await fetchAllCandidatePagesOnce()
      console.info(`[candidate-catalog] cargados ${candidatePool.length} candidatos desde API`)
      return candidatePool
    } catch (error) {
      const delay = getRetryDelay(attempt)
      console.error(`[candidate-catalog] intento ${attempt} fallido: ${error.message}. Reintentando en ${delay}ms.`)
      await wait(delay)
    }
  }

  return candidatePool
}

function sortAlphabetically(values) {
  return [...values].sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }))
}

function filterCandidates(candidates, { party, region, types } = {}) {
  const allowedTypes = Array.isArray(types) && types.length > 0
    ? new Set(types.map((value) => String(value).toLowerCase()))
    : null

  return candidates.filter((candidate) => {
    if (allowedTypes && !allowedTypes.has(candidate.typeKey)) {
      return false
    }
    if (party && candidate.party !== party) {
      return false
    }
    if (region && candidate.region !== region) {
      return false
    }
    return true
  })
}

export function getCandidateApiBase() {
  return API_BASE
}

export function hasCandidatePool() {
  return candidatePool.length >= MIN_POOL_SIZE
}

export async function ensureCandidatePool() {
  if (hasCandidatePool()) {
    return candidatePool
  }

  if (!loadingPromise) {
    loadingPromise = loadCandidatePoolWithRetry().finally(() => {
      if (!hasCandidatePool()) {
        loadingPromise = null
      }
    })
  }

  return loadingPromise
}

export function getCandidatePoolOrThrow() {
  if (!hasCandidatePool()) {
    throw new Error('Candidate pool no disponible. Llama a ensureCandidatePool() antes de generar peleadores.')
  }

  return candidatePool
}

export function getLegislativeCandidatePool() {
  return filterCandidates(getCandidatePoolOrThrow(), {
    types: [...LEGISLATIVE_TYPE_KEYS],
  })
}

export function getCandidateParties({ legislativeOnly = false } = {}) {
  const pool = legislativeOnly ? getLegislativeCandidatePool() : getCandidatePoolOrThrow()
  const parties = pool
    .map((candidate) => candidate.party)
    .filter(Boolean)

  return sortAlphabetically([...new Set(parties)])
}

export function getCandidateRegionsByParty(party, { legislativeOnly = false } = {}) {
  const pool = legislativeOnly ? getLegislativeCandidatePool() : getCandidatePoolOrThrow()
  const filtered = party ? pool.filter((candidate) => candidate.party === party) : pool
  const regions = filtered
    .map((candidate) => candidate.region)
    .filter(Boolean)

  return sortAlphabetically([...new Set(regions)])
}

export function getCandidatesByFilters(filters = {}) {
  const basePool = filters.legislativeOnly ? getLegislativeCandidatePool() : getCandidatePoolOrThrow()
  return filterCandidates(basePool, {
    party: filters.party,
    region: filters.region,
    types: filters.types,
  }).sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }))
}

export function listCandidatesByFilters(filters = {}) {
  const basePool = filters.legislativeOnly ? getLegislativeCandidatePool() : getCandidatePoolOrThrow()
  return filterCandidates(basePool, {
    party: filters.party,
    region: filters.region,
    types: filters.types,
  }).sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }))
}

export function getCandidateById(candidateId) {
  return getCandidatePoolOrThrow().find((candidate) => candidate.id === candidateId) ?? null
}

export function pickRandomCandidate(options = {}) {
  const pool = options.pool ?? getCandidatePoolOrThrow()
  return pool[Math.floor(Math.random() * pool.length)]
}

export function pickUniqueCandidates(count, options = {}) {
  const pool = options.pool ?? getCandidatePoolOrThrow()
  const excludeIds = new Set(options.excludeIds ?? [])
  const available = pool.filter((candidate) => !excludeIds.has(candidate.id))
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  const picked = shuffled.slice(0, Math.min(count, shuffled.length))

  while (picked.length < count && available.length > 0) {
    picked.push(available[Math.floor(Math.random() * available.length)])
  }

  return picked
}

export function isLegislativeCandidate(candidate) {
  return Boolean(candidate?.typeKey && LEGISLATIVE_TYPE_KEYS.has(candidate.typeKey))
}
