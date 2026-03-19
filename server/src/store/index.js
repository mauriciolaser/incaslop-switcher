import { hasDatabaseConfig, config } from '../config.js'
import { FileStore } from './fileStore.js'
import { MySQLStore } from './mysqlStore.js'

export function createStore() {
  if (hasDatabaseConfig()) {
    return new MySQLStore()
  }

  if (config.allowFileFallback) {
    return new FileStore()
  }

  throw new Error('No database configuration found and file fallback is disabled.')
}
