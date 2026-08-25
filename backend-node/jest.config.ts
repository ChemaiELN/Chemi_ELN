import type { Config } from 'jest'

const tsJestTransform = {
  '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: false }],
}

const config: Config = {
  // Sequelize/pg pool can keep the process alive after afterAll close on Windows
  forceExit: true,
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      transform: tsJestTransform,
      setupFiles: ['<rootDir>/src/jest.env.ts'],
      // No setupFilesAfterEnv — pure unit tests must not require Postgres
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/__integration__/**/*.test.ts'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      transform: tsJestTransform,
      testTimeout: 30000,
      // One worker — shared sentinel users (test_superadmin) must not race
      maxWorkers: 1,
      setupFiles: ['<rootDir>/src/jest.env.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/jest.setup.ts'],
      globalSetup: '<rootDir>/src/jest.globalSetup.js',
    },
  ],
}

export default config
