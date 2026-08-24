import { EventEmitter } from 'events'
import { Response } from 'express'

class SseBus extends EventEmitter {
  private clients: Set<Response> = new Set()

  addClient(res: Response): void {
    this.clients.add(res)
  }

  removeClient(res: Response): void {
    this.clients.delete(res)
  }

  broadcast(eventType: string, data: unknown): void {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
    for (const res of this.clients) {
      try {
        res.write(payload)
      } catch {
        this.clients.delete(res)
      }
    }
  }

  sendKeepalive(): void {
    for (const res of this.clients) {
      try {
        res.write(': keepalive\n\n')
      } catch {
        this.clients.delete(res)
      }
    }
  }
}

export const sseBus = new SseBus()
sseBus.setMaxListeners(500)

// Keepalive every 30 seconds
setInterval(() => sseBus.sendKeepalive(), 30_000)
