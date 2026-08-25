import { Sequelize } from 'sequelize'
import { config } from '../config'
import { logger } from '../utils/logger'

let sequelize: Sequelize

if (config.db.url) {
  sequelize = new Sequelize(config.db.url, {
    dialect: 'postgres',
    logging: config.isDev ? (msg) => logger.debug(msg) : false,
    pool: config.nodeEnv === 'test'
      ? { max: 1, min: 0, acquire: 10000, idle: 1000 }
      : { max: 10, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions: { ssl: false },
  })
} else {
  sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
    host: config.db.host,
    port: config.db.port,
    dialect: 'postgres',
    logging: config.isDev ? (msg) => logger.debug(msg) : false,
    pool: config.nodeEnv === 'test'
      ? { max: 1, min: 0, acquire: 10000, idle: 1000 }
      : { max: 10, min: 0, acquire: 30000, idle: 10000 },
  })
}

export { sequelize }

export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate()
  logger.info('Database connection established.')
}
