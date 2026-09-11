import { describe, expect, it } from 'vitest'
import { NoOpNotificationProvider, type NotificationPayload } from './provider'

function makePayload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return { toEmail: 'member@example.com', subject: 'Your weekly matches', bodyText: 'Here they are.', ...overrides }
}

describe('NoOpNotificationProvider', () => {
  it('reports success without throwing or making any network call', async () => {
    const provider = new NoOpNotificationProvider()
    const result = await provider.send(makePayload())
    expect(result.success).toBe(true)
  })

  it('exposes a log-friendly name identifying it as the deferred/no-provider-chosen default', () => {
    const provider = new NoOpNotificationProvider()
    expect(provider.name).toBe('noop')
  })

  it('never returns a providerMessageId -- it never actually dispatched anything', async () => {
    const provider = new NoOpNotificationProvider()
    const result = await provider.send(makePayload())
    expect(result.providerMessageId).toBeUndefined()
  })
})
