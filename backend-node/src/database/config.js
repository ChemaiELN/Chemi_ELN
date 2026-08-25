const path = require('path')
const dotenv = require('dotenv')

// When NODE_ENV=test (Jest globalSetup / sequelize-cli migrate), load .env.test so we
// never migrate the development database by accident.
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true })
  if (!process.env.DATABASE_URL) {
    delete process.env.DATABASE_URL
  }
  const testDb = process.env.DB_NAME || 'chemi_eln_test'
  if (['laurus_eln', 'postgres'].includes(testDb)) {
    throw new Error(`Refusing sequelize-cli test migration against database "${testDb}"`)
  }
} else {
  dotenv.config()
}

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'laurus_eln',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    url: process.env.DATABASE_URL,
  },
  test: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chemi_eln_test',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    // Smaller pool in test — drains faster; reduces Jest open-handle hangs on Windows
    pool: { max: 1, min: 0, acquire: 10000, idle: 1000 },
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  },
}
