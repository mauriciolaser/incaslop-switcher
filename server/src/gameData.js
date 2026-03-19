import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')

function readJson(relativePath) {
  const fullPath = path.join(projectRoot, relativePath)
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'))
}

export const ataques = readJson(path.join('src', 'data', 'ataques.json'))
export const personajes = readJson(path.join('src', 'data', 'personajes.json'))
