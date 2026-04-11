import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PARTIES_PATH = path.resolve(__dirname, '..', '..', 'src', 'data', 'parties.json')

let cachedPartyMap = null

function loadPartyMap() {
  if (cachedPartyMap) return cachedPartyMap

  try {
    const raw = JSON.parse(fs.readFileSync(PARTIES_PATH, 'utf8'))
    cachedPartyMap = new Map(
      Array.isArray(raw)
        ? raw
          .filter((party) => party?.name)
          .map((party) => [String(party.name).trim(), party])
        : [],
    )
  } catch {
    cachedPartyMap = new Map()
  }

  return cachedPartyMap
}

export function getPartyByName(name) {
  if (!name) return null
  return loadPartyMap().get(String(name).trim()) ?? null
}
