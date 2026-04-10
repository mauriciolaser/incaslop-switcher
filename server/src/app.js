import process from 'node:process'
import express from 'express'
import cookieParser from 'cookie-parser'
import { config } from './config.js'
import { createStore } from './store/index.js'
import { OnlineArenaService } from './gameService.js'
import { createUserKey } from './battleEngine.js'

const app = express()
let arena = null

app.use(express.json())
app.use(cookieParser())

function getUserKey(req, res) {
  let userKey = req.cookies[config.sessionCookieName]
  if (!userKey) {
    userKey = createUserKey()
    res.cookie(config.sessionCookieName, userKey, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 365,
      path: '/',
    })
  }
  return userKey
}

app.post('/api/online/session', async (req, res) => {
  const userKey = getUserKey(req, res)
  const payload = await arena.createSession(userKey)
  res.json(payload)
})

app.delete('/api/online/session', async (req, res) => {
  const userKey = getUserKey(req, res)
  const payload = await arena.leaveSession(userKey)
  res.json(payload)
})

app.get('/api/online/state', async (req, res) => {
  const userKey = getUserKey(req, res)
  const payload = await arena.getStateForUser(userKey)
  res.json(payload)
})

app.get('/api/online/events', async (req, res) => {
  const since = Number(req.query.since || 0)
  const payload = await arena.getEventsSince(since)
  res.json(payload)
})

app.post('/api/online/bet', async (req, res) => {
  try {
    const userKey = getUserKey(req, res)
    const side = req.body?.side
    const amount = Number(req.body?.amount || 0)

    if (!['left', 'right'].includes(side)) {
      res.status(400).json({ error: 'Lado de apuesta invalido.' })
      return
    }

    const payload = await arena.placeBet(userKey, side, amount)
    res.json(payload)
  } catch (error) {
    res.status(400).json({ error: error.message || 'No se pudo registrar la apuesta.' })
  }
})

app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'up' })
})

async function start() {
  const store = await createStore()
  arena = new OnlineArenaService(store)
  await arena.init()
  app.listen(config.port, () => {
    console.log(`Online arena server listening on port ${config.port}`)
  })
}

start().catch((error) => {
  console.error('Failed to start online arena server:', error)
  process.exit(1)
})
