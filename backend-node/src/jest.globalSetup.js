/**
 * Jest globalSetup — CommonJS so Jest can load it without ts-jest transform.
 * Ensures NODE_ENV=test, .env.test is loaded, test DB exists, migrations applied.
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { Client } = require('pg')
const dotenv = require('dotenv')

const FORBIDDEN_TEST_DB_NAMES = ['laurus_eln', 'postgres']

module.exports = async function globalSetup() {
  const root = path.resolve(__dirname, '..')
  process.env.NODE_ENV = 'test'

  const envTestPath = path.join(root, '.env.test')
  if (!fs.existsSync(envTestPath)) {
    throw new Error(
      'Missing backend-node/.env.test — copy .env.test.example to .env.test and set your DB credentials.',
    )
  }

  const result = dotenv.config({ path: envTestPath, override: true })
  if (result.error) {
    throw new Error(`Failed to load .env.test: ${result.error.message}`)
  }
  if (!result.parsed?.DATABASE_URL) {
    delete process.env.DATABASE_URL
  }

  const dbName = process.env.DB_NAME || 'chemi_eln_test'
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error(`Refusing unsafe test DB name: ${dbName}`)
  }
  if (FORBIDDEN_TEST_DB_NAMES.includes(dbName)) {
    throw new Error(`Refusing to run tests against database "${dbName}"`)
  }

  const admin = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  })
  await admin.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
    if ((exists.rowCount || 0) === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`)
    }
  } finally {
    await admin.end()
  }

  execSync('npx sequelize-cli db:migrate', {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: 'inherit',
  })
}
