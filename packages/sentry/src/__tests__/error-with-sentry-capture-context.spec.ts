import { type ErrorEvent } from '@sentry/core'
import { describe, expect, it } from 'vitest'
import { mock, stub } from 'vitest-mock-extended'

import { ErrorWithSentryCaptureContext } from '../error-with-sentry-capture-context'

describe('ErrorWithSentryCaptureContext', () => {
  describe('constructor', () => {
    it('should create an error with message and capture context', () => {
      const captureContext = {
        extra: { foo: 'bar' },
        tags: { environment: 'test' },
      }
      const error = new ErrorWithSentryCaptureContext('Test error', captureContext)

      expect(error.message).toBe('Test error')
      expect(error.captureContext).toEqual(captureContext)
      expect(error.name).toBe('Error')
    })

    it('should set name from cause error when provided', () => {
      const cause = new TypeError('Original error')
      const captureContext = { extra: { foo: 'bar' } }
      const error = new ErrorWithSentryCaptureContext('Wrapped error', captureContext, { cause })

      expect(error.message).toBe('Wrapped error')
      expect(error.name).toBe('TypeError')
      expect(error.cause).toBe(cause)
    })

    it('should use default Error name when cause is not an Error instance', () => {
      const captureContext = { extra: { foo: 'bar' } }
      const error = new ErrorWithSentryCaptureContext('Test error', captureContext, {
        cause: 'string cause',
      })

      expect(error.name).toBe('Error')
    })

    it('should handle empty capture context', () => {
      const error = new ErrorWithSentryCaptureContext('Test error', {})

      expect(error.captureContext).toEqual({})
    })
  })

  describe('beforeSend', () => {
    it('should add extra to event', () => {
      const captureContext = {
        extra: { foo: 'bar', baz: 'qux' },
      }
      const error = new ErrorWithSentryCaptureContext('Test error', captureContext)
      const event = mock<ErrorEvent>({ extra: { existing: 'value' } })

      const result = error.beforeSend(event)

      expect(result.extra).toEqual({
        existing: 'value',
        foo: 'bar',
        baz: 'qux',
      })
    })

    it('should add tags to event', () => {
      const captureContext = {
        tags: { environment: 'test', version: '1.0' },
      }
      const error = new ErrorWithSentryCaptureContext('Test error', captureContext)
      const event = mock<ErrorEvent>({ tags: { existing: 'tag' } })

      const result = error.beforeSend(event)

      expect(result.tags).toEqual({
        existing: 'tag',
        environment: 'test',
        version: '1.0',
      })
    })

    it('should add contexts to event', () => {
      const captureContext = {
        contexts: {
          custom: { key: 'value' },
        },
      }
      const error = new ErrorWithSentryCaptureContext('Test error', captureContext)
      const event = mock<ErrorEvent>({
        contexts: { existing: { data: 'test' } },
      })

      const result = error.beforeSend(event)

      expect(result.contexts).toMatchObject({
        existing: { data: 'test' },
        custom: { key: 'value' },
      })
    })

    it('should set fingerprint on event', () => {
      const captureContext = {
        fingerprint: ['custom', 'fingerprint'],
      }
      const error = new ErrorWithSentryCaptureContext('Test error', captureContext)
      const event = stub<ErrorEvent>()

      const result = error.beforeSend(event)

      expect(result.fingerprint).toEqual(['custom', 'fingerprint'])
    })

    it('should handle all properties together', () => {
      const captureContext = {
        extra: { foo: 'bar' },
        tags: { environment: 'test' },
        contexts: { custom: { key: 'value' } },
        fingerprint: ['custom', 'fingerprint'],
      }
      const error = new ErrorWithSentryCaptureContext('Test error', captureContext)
      const event = mock<ErrorEvent>({
        extra: { existing: 'extra' },
        tags: { existing: 'tag' },
        contexts: { existing: { data: 'test' } },
      })

      const result = error.beforeSend(event)

      expect(result.extra).toEqual({ existing: 'extra', foo: 'bar' })
      expect(result.tags).toEqual({ existing: 'tag', environment: 'test' })
      expect(result.contexts).toMatchObject({
        existing: { data: 'test' },
        custom: { key: 'value' },
      })
      expect(result.fingerprint).toEqual(['custom', 'fingerprint'])
    })

    it('should not modify event when capture context is empty', () => {
      const error = new ErrorWithSentryCaptureContext('Test error', {})
      const event = mock<ErrorEvent>({
        extra: { existing: 'extra' },
        tags: { existing: 'tag' },
      })

      const result = error.beforeSend(event)

      expect(result).toMatchObject({
        extra: { existing: 'extra' },
        tags: { existing: 'tag' },
      })
    })

    it('should handle event without existing properties', () => {
      const captureContext = {
        extra: { foo: 'bar' },
        tags: { environment: 'test' },
        contexts: { custom: { key: 'value' } },
      }
      const error = new ErrorWithSentryCaptureContext('Test error', captureContext)
      const event = stub<ErrorEvent>()

      const result = error.beforeSend(event)

      expect(result.extra).toMatchObject({ foo: 'bar' })
      expect(result.tags).toMatchObject({ environment: 'test' })
      expect(result.contexts).toMatchObject({ custom: { key: 'value' } })
    })
  })
})
