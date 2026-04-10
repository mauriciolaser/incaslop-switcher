const DEFAULT_CANDIDATE_API_BASE = 'https://api.candidatos.incaslop.online'
const PAGE_SIZE = 500
const MIN_POOL_SIZE = 2

const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000]

const API_BASE = import.meta.env.VITE_CANDIDATE_API_BASE?.replace(/\/$/, '') ?? DEFAULT_CANDIDATE_API_BASE

let candidatePool = []
let loadingPromise = null

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

  if (!id || !name) return null

  return {
    id,
    name,
    portraitUrl,
    imageUrl: raw.imageUrl || null,
    party: raw.party || '',
    region: raw.region || '',
    type: raw.type || '',
  }
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

async function fetchCandidatePoolOnce() {
  const firstPage = await fetchCandidatePage(1)
  const totalPages = Math.max(1, Number(firstPage?.pagination?.totalPages || 1))
  const targetPage = totalPages > 1
    ? Math.floor(Math.random() * totalPages) + 1
    : 1

  const targetPayload = targetPage === 1
    ? firstPage
    : await fetchCandidatePage(targetPage)

  const normalized = targetPayload.candidates
    .map(normalizeCandidate)
    .filter(Boolean)

  if (normalized.length < MIN_POOL_SIZE) {
    throw new Error(`Pool insuficiente de candidatos (${normalized.length}).`)
  }

  return {
    candidates: normalized,
    targetPage,
    totalPages,
  }
}

async function loadCandidatePoolWithRetry() {
  let attempt = 0

  while (candidatePool.length < MIN_POOL_SIZE) {
    attempt += 1

    try {
      const { candidates, targetPage, totalPages } = await fetchCandidatePoolOnce()
      candidatePool = candidates
      console.info(`[candidate-catalog] cargados ${candidates.length} candidatos desde pagina ${targetPage}/${totalPages}`)
      return candidatePool
    } catch (error) {
      const delay = getRetryDelay(attempt)
      console.error(`[candidate-catalog] intento ${attempt} fallido: ${error.message}. Reintentando en ${delay}ms.`)
      await wait(delay)
    }
  }

  return candidatePool
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

export function pickRandomCandidate() {
  const pool = getCandidatePoolOrThrow()
  return pool[Math.floor(Math.random() * pool.length)]
}
