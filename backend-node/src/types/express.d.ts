export {}

declare global {
  namespace Express {
    interface Request {
      user?: import('../models/User.model').User
      requestId?: string
    }
  }
}
