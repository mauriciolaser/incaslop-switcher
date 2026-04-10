import { config } from '../config.js'

export async function createStore() {
  if (config.storeMode === 'memory') {
    const { MemoryStore } = await import('./memoryStore.js')
    return new MemoryStore()
  }

  if (config.storeMode === 'sqlite') {
    const { SQLiteStore } = await import('./sqliteStore.js')
    return new SQLiteStore()
  }

  if (config.storeMode === 'file') {
    const { FileStore } = await import('./fileStore.js')
    return new FileStore()
  }

  throw new Error(`ONLINE_STORE invalido: ${config.storeMode}`)
}
