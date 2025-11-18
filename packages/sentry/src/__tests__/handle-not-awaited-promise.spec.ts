import * as SentryNode from '@sentry/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { handleNotAwaitedPromise } from '../handle-not-awaited-promise'

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}))

describe('handleNotAwaitedPromise', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should capture exception when promise rejects', async () => {
    const error = new Error('Test error')
    const promise = Promise.reject(error)
    const hint = { tags: { test: 'value' } }

    handleNotAwaitedPromise(promise, hint)

    // Wait for the promise to be processed
    await vi.waitFor(() => {
      expect(SentryNode.captureException).toHaveBeenCalledWith(error, hint)
    })
  })

  it('should not call captureException when promise resolves', async () => {
    const promise = Promise.resolve('success')

    handleNotAwaitedPromise(promise)

    // Wait a bit to ensure the promise is resolved
    await new Promise((resolve) => {
      setTimeout(resolve, 10)
    })

    expect(SentryNode.captureException).not.toHaveBeenCalled()
  })

  it('should handle undefined promise', () => {
    expect(() => {
      // eslint-disable-next-line unicorn/no-useless-undefined
      handleNotAwaitedPromise(undefined)
    }).not.toThrow()
    expect(SentryNode.captureException).not.toHaveBeenCalled()
  })

  it('should capture exception without hint', async () => {
    const error = new Error('Test error without hint')
    const promise = Promise.reject(error)

    handleNotAwaitedPromise(promise)

    await vi.waitFor(() => {
      expect(SentryNode.captureException).toHaveBeenCalledWith(error, undefined)
    })
  })

  it('should capture non-Error exceptions', async () => {
    const error = new Error('string error')
    const promise = Promise.reject(error)

    handleNotAwaitedPromise(promise)

    await vi.waitFor(() => {
      expect(SentryNode.captureException).toHaveBeenCalledWith(error, undefined)
    })
  })
})
