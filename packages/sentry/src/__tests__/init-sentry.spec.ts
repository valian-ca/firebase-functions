import { type ErrorEvent } from '@sentry/core'
import * as SentryNode from '@sentry/node'
import { describe, expect, it, vi } from 'vitest'
import { mock, stub } from 'vitest-mock-extended'

import { ErrorWithSentryCaptureContext } from '../error-with-sentry-capture-context'
import { initSentry } from '../init-sentry'

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  firebaseIntegration: vi.fn(() => ({ name: 'FirebaseIntegration' })),
}))

describe('initSentry', () => {
  it('should initialize Sentry with default options', () => {
    initSentry()

    expect(SentryNode.init).toHaveBeenCalledWith(
      expect.objectContaining({
        integrations: expect.any(Function),
        beforeSend: expect.any(Function),
      }),
    )
  })

  it('should initialize Sentry with custom options', () => {
    const options = {
      dsn: 'https://test@sentry.io/123',
      environment: 'test',
      tracesSampleRate: 0.5,
    }

    initSentry(options)

    expect(SentryNode.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://test@sentry.io/123',
        environment: 'test',
        tracesSampleRate: 0.5,
        integrations: expect.any(Function),
        beforeSend: expect.any(Function),
      }),
    )
  })

  it('should add firebase integration to default integrations', () => {
    initSentry()

    const initCall = vi.mocked(SentryNode.init).mock.calls[0][0]
    const integrations = initCall!.integrations as (integrations: unknown[]) => unknown[]
    const defaultIntegrations = [{ name: 'DefaultIntegration1' }, { name: 'DefaultIntegration2' }]

    const result = integrations(defaultIntegrations)

    expect(result).toEqual([...defaultIntegrations, { name: 'FirebaseIntegration' }])
    expect(SentryNode.firebaseIntegration).toHaveBeenCalled()
  })

  describe('beforeSend hook', () => {
    it('should process ErrorWithSentryCaptureContext', () => {
      initSentry()

      const initCall = vi.mocked(SentryNode.init).mock.calls[0][0]
      const beforeSend = initCall!.beforeSend as (event: ErrorEvent, hint: { originalException: unknown }) => ErrorEvent

      const captureContext = {
        extra: { foo: 'bar' },
        tags: { environment: 'test' },
      }
      const error = new ErrorWithSentryCaptureContext('Test error', captureContext)
      const event = stub<ErrorEvent>()
      const hint = { originalException: error }

      const result = beforeSend(event, hint)

      expect(result.extra).toMatchObject({ foo: 'bar' })
      expect(result.tags).toMatchObject({ environment: 'test' })
    })

    it('should process nested ErrorWithSentryCaptureContext causes', () => {
      initSentry()

      const initCall = vi.mocked(SentryNode.init).mock.calls[0][0]
      const beforeSend = initCall!.beforeSend as (event: ErrorEvent, hint: { originalException: unknown }) => ErrorEvent

      const rootCause = new ErrorWithSentryCaptureContext('Root cause', {
        extra: { level: 'root' },
        tags: { root: 'true' },
      })

      const middleCause = new ErrorWithSentryCaptureContext(
        'Middle cause',
        {
          extra: { level: 'middle' },
          tags: { middle: 'true' },
        },
        { cause: rootCause },
      )

      const topError = new ErrorWithSentryCaptureContext(
        'Top error',
        {
          extra: { level: 'top' },
          tags: { top: 'true' },
        },
        { cause: middleCause },
      )

      const event = stub<ErrorEvent>()
      const hint = { originalException: topError }

      const result = beforeSend(event, hint)

      // All contexts should be merged
      expect(result.extra).toMatchObject({
        level: 'root', // Nested causes are processed from innermost to outermost
      })
      expect(result.tags).toMatchObject({
        root: 'true',
        middle: 'true',
        top: 'true',
      })
    })

    it('should handle regular errors without modification', () => {
      initSentry()

      const initCall = vi.mocked(SentryNode.init).mock.calls[0][0]
      const beforeSend = initCall!.beforeSend as (event: ErrorEvent, hint: { originalException: unknown }) => ErrorEvent

      const error = new Error('Regular error')
      const event = mock<ErrorEvent>({ extra: { existing: 'data' } })
      const hint = { originalException: error }

      const result = beforeSend(event, hint)

      expect(result).toMatchObject({ extra: { existing: 'data' } })
    })

    it('should handle non-error exceptions', () => {
      initSentry()

      const initCall = vi.mocked(SentryNode.init).mock.calls[0][0]
      const beforeSend = initCall!.beforeSend as (event: ErrorEvent, hint: { originalException: unknown }) => ErrorEvent

      const event = stub<ErrorEvent>()
      const hint = { originalException: 'string error' }

      const result = beforeSend(event, hint)

      expect(result).toMatchObject({})
    })

    it('should handle ErrorWithSentryCaptureContext with regular Error cause', () => {
      initSentry()

      const initCall = vi.mocked(SentryNode.init).mock.calls[0][0]
      const beforeSend = initCall!.beforeSend as (event: ErrorEvent, hint: { originalException: unknown }) => ErrorEvent

      const regularCause = new Error('Regular cause')
      const error = new ErrorWithSentryCaptureContext(
        'Wrapped error',
        { extra: { foo: 'bar' } },
        { cause: regularCause },
      )

      const event = stub<ErrorEvent>()
      const hint = { originalException: error }

      const result = beforeSend(event, hint)

      expect(result.extra).toMatchObject({ foo: 'bar' })
    })

    it('should process all capture context properties', () => {
      initSentry()

      const initCall = vi.mocked(SentryNode.init).mock.calls[0][0]
      const beforeSend = initCall!.beforeSend as (event: ErrorEvent, hint: { originalException: unknown }) => ErrorEvent

      const error = new ErrorWithSentryCaptureContext('Test error', {
        extra: { extra: 'data' },
        tags: { tag: 'value' },
        contexts: { custom: { key: 'value' } },
        fingerprint: ['custom', 'fingerprint'],
      })

      const event = stub<ErrorEvent>()
      const hint = { originalException: error }

      const result = beforeSend(event, hint)

      expect(result.extra).toMatchObject({ extra: 'data' })
      expect(result.tags).toMatchObject({ tag: 'value' })
      expect(result.contexts).toMatchObject({ custom: { key: 'value' } })
      expect(result.fingerprint).toEqual(['custom', 'fingerprint'])
    })
  })
})
