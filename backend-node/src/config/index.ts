import dotenv from 'dotenv'
import path from 'path'

// Prefer .env.test when running under Jest / NODE_ENV=test so suites never hit the dev DB.
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true })
} else {
  dotenv.config()
}

function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

function optional(key: string, defaultVal = ''): string {
  return process.env[key] || defaultVal
}

function optionalInt(key: string, defaultVal: number): number {
  const val = process.env[key]
  return val ? parseInt(val, 10) : defaultVal
}

export const config = {
  port: optionalInt('PORT', 8000),
  nodeEnv: optional('NODE_ENV', 'development'),

  db: {
    host: optional('DB_HOST', 'localhost'),
    port: optionalInt('DB_PORT', 5432),
    name: optional('DB_NAME', process.env.NODE_ENV === 'test' ? 'chemi_eln_test' : 'laurus_eln'),
    user: optional('DB_USER', 'postgres'),
    password: optional('DB_PASSWORD', ''),
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: required('JWT_SECRET'),
    algorithm: optional('JWT_ALGORITHM', 'HS256') as 'HS256',
    accessExpireMinutes: optionalInt('ACCESS_TOKEN_EXPIRE_MINUTES', 30),
    refreshExpireDays: optionalInt('REFRESH_TOKEN_EXPIRE_DAYS', 7),
  },

  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()),

  uploadDir: optional('UPLOAD_DIR', 'uploads'),
  maxUploadBytes: optionalInt('MAX_UPLOAD_BYTES', 52428800),
  maxBodyBytes: optionalInt('MAX_BODY_BYTES', 10485760),

  ad: {
    apiBaseUrl: optional('AD_API_BASE_URL'),
    integrationApiKey: optional('AD_INTEGRATION_API_KEY'),
    defaultTlUsername: optional('AD_DEFAULT_TL_USERNAME'),
  },

  isProd: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV !== 'production',
}
