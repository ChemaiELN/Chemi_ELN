/**
 * Jest setupFilesAfterEnv — integration project only.
 * Bootstraps Express (routes + DB) once per worker before Supertest suites run.
 */
import { bootstrap } from './app'
import { sequelize } from './database/connection'

beforeAll(async () => {
  await bootstrap()
})

afterAll(async () => {
  await sequelize.close()
})
