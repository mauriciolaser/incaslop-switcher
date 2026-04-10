const API_BASE = import.meta.env.VITE_ONLINE_API_BASE?.replace(/\/$/, '') ?? '/api/online'

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error || `HTTP ${response.status}`
    throw new Error(message)
  }
  return data
}

export function getOnlineApiBase() {
  return API_BASE
}

export async function createOnlineSession() {
  const response = await fetch(`${API_BASE}/session`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  return parseJsonResponse(response)
}

export async function closeOnlineSession() {
  const response = await fetch(`${API_BASE}/session`, {
    method: 'DELETE',
    credentials: 'include',
  })

  return parseJsonResponse(response)
}

export async function fetchOnlineState() {
  const response = await fetch(`${API_BASE}/state`, {
    credentials: 'include',
  })

  return parseJsonResponse(response)
}

export async function fetchOnlineEvents(since = 0) {
  const response = await fetch(`${API_BASE}/events?since=${since}`, {
    credentials: 'include',
  })

  return parseJsonResponse(response)
}

export async function submitOnlineBet({ side, amount }) {
  const response = await fetch(`${API_BASE}/bet`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ side, amount }),
  })

  return parseJsonResponse(response)
}
