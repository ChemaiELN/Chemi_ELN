/**
 * Runs in each Jest worker before test files load.
 * Must set NODE_ENV=test and load .env.test before config/connection import.
 */
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

process.env.NODE_ENV = 'test'

const envTestPath = path.resolve(__dirname, '../.env.test')
if (!fs.existsSync(envTestPath)) {
  throw new Error(
    'Missing backend-node/.env.test — copy .env.test.example to .env.test and set your DB credentials.',
  )
}

const result = dotenv.config({ path: envTestPath, override: true })
if (result.error) {
  throw new Error(`Failed to load .env.test: ${result.error.message}`)
}

// Shell DATABASE_URL must not override discrete DB_* fields in test mode.
if (!result.parsed?.DATABASE_URL) {
  delete process.env.DATABASE_URL
}
