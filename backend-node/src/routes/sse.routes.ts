import { Router, Request, Response } from 'express'
import { decodeToken, isAccessToken } from '../utils/auth.utils'
import { User } from '../models/User.model'
import { sseBus } from '../utils/sseBus'

const router = Router()

// GET /api/sse/events?token=<jwt>
// EventSource API does not support custom headers, so token is passed as query param
router.get('/events', async (req: Request, res: Response) => {
  const token = req.query.token as string
  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication token required.' })
    return
  }

  const payload = decodeToken(token)
  if (!payload || !isAccessToken(payload)) {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' })
    return
  }

  const user = await User.findByPk(payload.sub)
  if (!user || !user.isActive || user.tokenVersion !== payload.ver) {
    res.status(401).json({ success: false, message: 'Session invalid.' })
    return
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ userId: user.id })}\n\n`)

  sseBus.addClient(res)

  req.on('close', () => {
    sseBus.removeClient(res)
  })
})

export default router
