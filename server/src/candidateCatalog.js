import { config } from './config.js'

const PAGE_SIZE = 500
const MIN_POOL_SIZE = 2
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000]

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
  const portraitUrl = raw.portraitUrl || raw.imageUrl || null
  const typeKey = String(raw.typeKey ?? raw.type ?? '').trim().toLowerCase()

  if (!id || !name) return null

  return {
    id,
    name,
    portraitUrl,
    imageUrl: raw.imageUrl || portraitUrl,
    party: raw.party || '',
    region: raw.region || '',
    type: raw.type || '',
    typeKey,
    partyId: raw.partyId ?? null,
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

async function fetchCandidatesPage(page) {
  const base = config.candidateApiBaseUrl.replace(/\/$/, '')
  const url = `${base}/v1/candidates?page=${page}&pageSize=${PAGE_SIZE}`
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

async function fetchCandidatePoolOnce() {
  const firstPage = await fetchCandidatesPage(1)
  const totalPages = Math.max(1, Number(firstPage?.pagination?.totalPages || 1))
  const additionalPages = totalPages > 1
    ? await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) => fetchCandidatesPage(index + 2)),
      )
    : []

  const candidates = dedupeCandidates(
    [firstPage, ...additionalPages]
      .flatMap((payload) => payload.candidates)
      .map(normalizeCandidate)
      .filter(Boolean),
  )

  if (candidates.length < MIN_POOL_SIZE) {
    throw new Error(`Pool insuficiente de candidatos (${candidates.length}).`)
  }

  return candidates
}

export async function loadCandidatePoolWithRetry() {
  let attempt = 0

  while (true) {
    attempt += 1

    try {
      const candidates = await fetchCandidatePoolOnce()
      console.info(`[candidate-catalog] cargados ${candidates.length} candidatos desde API`)
      return candidates
    } catch (error) {
      const delay = getRetryDelay(attempt)
      console.error(`[candidate-catalog] intento ${attempt} fallido: ${error.message}. Reintentando en ${delay}ms.`)
      await wait(delay)
    }
  }
}
