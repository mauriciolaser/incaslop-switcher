import rawCandidatesJson from '../../server/src/data/candidates.json?raw'
import partyCatalog from '../data/parties.json'
import { resolvePortraitUrl } from './portraitResolver'
import { resolvePartyImageUrl } from './partyResolver'

const MIN_POOL_SIZE = 2
const LEGISLATIVE_TYPE_KEYS = new Set(['diputado', 'senador'])

const partyCatalogMap = new Map(
  partyCatalog
    .filter((party) => party?.name)
    .map((party) => [String(party.name).trim(), party]),
)

let candidatePool = []
const rawCandidates = JSON.parse(rawCandidatesJson)

function normalizeCandidate(raw = {}) {
  const id = String(raw.id ?? '').trim()
  const name = String(raw.name ?? '').trim()
  const party = String(raw.party ?? '').trim()
  const rawPortrait = raw.portraitImage || raw.portraitUrl || raw.imageUrl || null
  const partyData = partyCatalogMap.get(party) ?? null
  const rawPartyImage = raw.partyImage || partyData?.partyImage || null
  const portraitUrl = resolvePortraitUrl(rawPortrait) ?? rawPortrait
  const partyImage = resolvePartyImageUrl(rawPartyImage) ?? rawPartyImage
  const transparentUrl = raw.transparentImage ? `/${raw.transparentImage}` : null
  const typeKey = String(raw.typeKey ?? raw.type ?? '').trim().toLowerCase()

  if (!id || !name) return null

  const partyId = raw.partyId
    ?? (rawPartyImage
      ? String(rawPartyImage).split('/').pop().replace(/\.[^.]+$/, '')
      : null)

  const partyLabel = raw.partyLabel ?? null

  return {
    id,
    name,
    party,
    partyImage,
    region: String(raw.region ?? '').trim(),
    type: String(raw.type ?? '').trim(),
    typeKey,
    partyId,
    partyLabel,
    portraitUrl,
    transparentUrl,
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

function loadLocalCandidatePool() {
  const unique = dedupeCandidates(
    rawCandidates
      .map(normalizeCandidate)
      .filter(Boolean),
  )

  if (unique.length < MIN_POOL_SIZE) {
    throw new Error(`Pool insuficiente de candidatos (${unique.length}).`)
  }

  return unique
}

function ensureLocalPoolLoaded() {
  if (candidatePool.length >= MIN_POOL_SIZE) {
    return candidatePool
  }

  candidatePool = loadLocalCandidatePool()
  return candidatePool
}

export function getCandidateApiBase() {
  return 'local-catalog'
}

export function hasCandidatePool() {
  return ensureLocalPoolLoaded().length >= MIN_POOL_SIZE
}

export async function ensureCandidatePool() {
  return ensureLocalPoolLoaded()
}

export function getCandidatePoolOrThrow() {
  return ensureLocalPoolLoaded()
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
