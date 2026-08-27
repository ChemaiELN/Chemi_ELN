/**
 * Jest setupFilesAfterEnv — integration project only.
 * Bootstraps Express (routes + DB) once per worker before Supertest suites run.
 *
 * Do not call sequelize.close() here: with --runInBand, afterAll runs after
 * every file and would tear down the shared connection for later suites.
 * Process exit is handled by Jest forceExit (open pg handles on Windows).
 */
import { bootstrap } from './app'

jest.setTimeout(30000)

beforeAll(async () => {
  await bootstrap()
})
