import * as SentryCore from '@sentry/core'
import { type Scope } from '@sentry/core'
import * as SentryNode from '@sentry/node'
import { type Logger } from '@valian/function-logger'
import { type CloudEvent } from 'firebase-functions/core'
import { type FirestoreEvent } from 'firebase-functions/firestore'
import { type MessagePublishedData } from 'firebase-functions/pubsub'
import { type ScheduledEvent } from 'firebase-functions/scheduler'
import { type Change, type EventContext } from 'firebase-functions/v1'
import { type UserRecord } from 'firebase-functions/v1/auth'
import { type DocumentSnapshot } from 'firebase-functions/v1/firestore'
import { type Message } from 'firebase-functions/v1/pubsub'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mock } from 'vitest-mock-extended'

import {
  markEventUnhandled,
  sentryConfigurationWrapper,
  sentryOnPublishV1Wrapper,
  sentryOnScheduleRunV1Wrapper,
  sentryOnUserChangeV1Wrapper,
  sentryOnWriteV1Wrapper,
  sentryWrapOnDocumentChange,
  sentryWrapOnMessagePublished,
  sentryWrapOnSchedule,
} from '../sentry-wrapper'

let mockScope: ReturnType<typeof mock<Scope>>

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
  startSpan: vi.fn(async (_options: SentryCore.StartSpanOptions, callback: () => Promise<unknown>) => await callback()),
  withScope: vi.fn(async (callback: (scope: Scope) => Promise<unknown>) => await callback(mockScope)),
}))

vi.mock('@valian/function-logger', () => ({
  logger: mock<Logger>(),
}))

vi.mock('@sentry/core', () => ({
  addExceptionMechanism: vi.fn(),
}))

describe('sentry-wrapper', () => {
  beforeEach(() => {
    mockScope = mock<Scope>()
    vi.clearAllMocks()
  })

  describe('markEventUnhandled', () => {
    it('should add event processor that marks exception as unhandled', () => {
      const result = markEventUnhandled(mockScope)

      expect(result).toBe(mockScope)
      expect(mockScope.addEventProcessor).toHaveBeenCalled()

      // Get the event processor function
      const eventProcessor = vi.mocked(mockScope.addEventProcessor).mock.calls[0][0]
      const mockEvent = { type: 'error' } as unknown as SentryCore.Event

      const processedEvent = eventProcessor(mockEvent, {})

      expect(SentryCore.addExceptionMechanism).toHaveBeenCalledWith(mockEvent, { handled: false })
      expect(processedEvent).toBe(mockEvent)
    })
  })

  describe('sentryConfigurationWrapper', () => {
    it('should execute work with proper configuration', async () => {
      const work = vi.fn().mockResolvedValue('result')
      const configure = vi.fn()
      const context = { name: 'test-function', op: 'test-operation' }

      const result = await sentryConfigurationWrapper(context, configure, work)

      expect(result).toBe('result')
      expect(SentryNode.startSpan).toHaveBeenCalledWith(context, expect.any(Function))
      expect(SentryNode.withScope).toHaveBeenCalledWith(expect.any(Function))
      expect(configure).toHaveBeenCalled()
      expect(work).toHaveBeenCalled()
      expect(SentryNode.flush).toHaveBeenCalledWith(5000)
    })

    it('should flush even when work throws', async () => {
      const error = new Error('Work failed')
      const work = vi.fn().mockRejectedValue(error)
      const configure = vi.fn()
      const context = { name: 'test-function', op: 'test-operation' }

      await expect(sentryConfigurationWrapper(context, configure, work)).rejects.toThrow('Work failed')

      expect(SentryNode.flush).toHaveBeenCalledWith(5000)
    })

    it('should capture unhandled exceptions in production through wrapper', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const error = new Error('Unhandled error')
      const handler = vi.fn().mockRejectedValue(error)
      const wrapper = sentryOnScheduleRunV1Wrapper({ name: 'test-function' }, handler)

      const context: EventContext = {
        eventId: 'event-123',
        eventType: 'google.pubsub.topic.publish',
        resource: { service: 'pubsub', name: 'projects/test/topics/test-topic' },
        timestamp: '2023-01-01T00:00:00.000Z',
        params: {},
      }

      await expect(wrapper(context)).rejects.toThrow('Unhandled error')

      expect(SentryNode.captureException).toHaveBeenCalledWith(error, expect.any(Function))

      process.env.NODE_ENV = originalEnv
    })

    it('should log and capture unhandled exceptions in non-production through wrapper', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const error = new Error('Unhandled error')
      const handler = vi.fn().mockRejectedValue(error)
      const wrapper = sentryOnScheduleRunV1Wrapper({ name: 'test-function' }, handler)
      const { logger } = await import('@valian/function-logger')

      const context: EventContext = {
        eventId: 'event-123',
        eventType: 'google.pubsub.topic.publish',
        resource: { service: 'pubsub', name: 'projects/test/topics/test-topic' },
        timestamp: '2023-01-01T00:00:00.000Z',
        params: {},
      }

      await expect(wrapper(context)).rejects.toThrow('Unhandled error')

      expect(logger.error).toHaveBeenCalledWith('Unhandled exception', error)
      expect(SentryNode.captureException).toHaveBeenCalledWith(error, expect.any(Function))

      process.env.NODE_ENV = originalEnv
    })

    it('should mark unhandled exceptions properly', async () => {
      const error = new Error('Test error')
      const handler = vi.fn().mockRejectedValue(error)
      const wrapper = sentryOnScheduleRunV1Wrapper({ name: 'test-function' }, handler)

      const context: EventContext = {
        eventId: 'event-123',
        eventType: 'google.pubsub.topic.publish',
        resource: { service: 'pubsub', name: 'projects/test/topics/test-topic' },
        timestamp: '2023-01-01T00:00:00.000Z',
        params: {},
      }

      await expect(wrapper(context)).rejects.toThrow('Test error')

      expect(SentryNode.captureException).toHaveBeenCalled()
      const captureExceptionCall = vi.mocked(SentryNode.captureException).mock.calls[0]
      expect(captureExceptionCall[0]).toBe(error)

      // Test the scope callback
      const scopeCallback = captureExceptionCall[1] as (scope: Scope) => Scope

      const resultScope = scopeCallback(mockScope)

      expect(mockScope.addEventProcessor).toHaveBeenCalled()
      expect(resultScope).toBe(mockScope)
    })
  })

  describe('sentryOnPublishV1Wrapper', () => {
    it('should wrap PubSub v1 handler successfully', async () => {
      const handler = vi.fn().mockResolvedValue('success')
      const wrapper = sentryOnPublishV1Wrapper({ name: 'pubsub-function' }, handler)

      const message: Message = {
        json: { foo: 'bar', nested: { key: 'value' } },
        data: 'test-data',
      } as Message

      const context: EventContext = {
        eventId: 'event-123',
        eventType: 'google.pubsub.topic.publish',
        resource: { service: 'pubsub', name: 'projects/test/topics/test-topic' },
        timestamp: '2023-01-01T00:00:00.000Z',
        params: {},
      }

      const result = await wrapper(message, context)

      expect(result).toBe('success')
      expect(handler).toHaveBeenCalledWith(message, context)
      expect(SentryNode.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'pubsub-function',
          op: 'google.pubsub.topic.publish',
        }),
        expect.any(Function)
      )
    })

    it('should set proper context for PubSub v1', async () => {
      const handler = vi.fn().mockResolvedValue('success')
      const wrapper = sentryOnPublishV1Wrapper({ name: 'pubsub-function' }, handler)

      const message: Message = {
        json: { data: 'test' },
        data: 'test-data',
      } as Message

      const context: EventContext = {
        eventId: 'event-123',
        eventType: 'google.pubsub.topic.publish',
        resource: { service: 'pubsub', name: 'projects/test/topics/test-topic' },
        timestamp: '2023-01-01T00:00:00.000Z',
        params: {},
      }

      await wrapper(message, context)

      expect(mockScope.setTag).toHaveBeenCalledWith('function.version', 'v1')
      expect(mockScope.setTag).toHaveBeenCalledWith('function.name', 'pubsub-function')
      expect(mockScope.setContext).toHaveBeenCalledWith('Firebase Context', {
        eventId: 'event-123',
        eventType: 'google.pubsub.topic.publish',
        resource: { service: 'pubsub', name: 'projects/test/topics/test-topic' },
        timestamp: '2023-01-01T00:00:00.000Z',
      })
      expect(mockScope.setContext).toHaveBeenCalledWith('PubSub Message', { data: 'test' })
    })
  })

  describe('sentryOnWriteV1Wrapper', () => {
    it('should wrap Firestore v1 write handler successfully', async () => {
      const handler = vi.fn().mockResolvedValue('success')
      const wrapper = sentryOnWriteV1Wrapper({ name: 'firestore-function' }, handler)

      const beforeSnapshot = {
        ref: { id: 'doc-123', path: 'collection/doc-123' },
        data: () => ({ before: 'data' }),
      } as unknown as DocumentSnapshot

      const afterSnapshot = {
        ref: { id: 'doc-123', path: 'collection/doc-123' },
        data: () => ({ after: 'data' }),
      } as unknown as DocumentSnapshot

      const change: Change<DocumentSnapshot> = {
        before: beforeSnapshot,
        after: afterSnapshot,
      }

      const context: EventContext = {
        eventId: 'event-123',
        eventType: 'providers/cloud.firestore/eventTypes/document.write',
        resource: { service: 'firestore', name: 'projects/test/databases/(default)/documents/collection/doc-123' },
        timestamp: '2023-01-01T00:00:00.000Z',
        params: { docId: 'doc-123' },
      }

      const result = await wrapper(change, context)

      expect(result).toBe('success')
      expect(handler).toHaveBeenCalledWith(change, context)
    })

    it('should set proper context for Firestore v1', async () => {
      const handler = vi.fn().mockResolvedValue('success')
      const wrapper = sentryOnWriteV1Wrapper({ name: 'firestore-function' }, handler)

      const beforeSnapshot = {
        ref: { id: 'doc-123', path: 'collection/doc-123' },
        data: () => ({ field: 'before' }),
      } as unknown as DocumentSnapshot

      const afterSnapshot = {
        ref: { id: 'doc-123', path: 'collection/doc-123' },
        data: () => ({ field: 'after' }),
      } as unknown as DocumentSnapshot

      const change: Change<DocumentSnapshot> = {
        before: beforeSnapshot,
        after: afterSnapshot,
      }

      const context: EventContext = {
        eventId: 'event-123',
        eventType: 'providers/cloud.firestore/eventTypes/document.write',
        resource: { service: 'firestore', name: 'projects/test/databases/(default)/documents/collection/doc-123' },
        timestamp: '2023-01-01T00:00:00.000Z',
        params: { docId: 'doc-123' },
      }

      await wrapper(change, context)

      expect(mockScope.setContext).toHaveBeenCalledWith('Firestore Document', {
        param: { docId: 'doc-123' },
        id: 'doc-123',
        path: 'collection/doc-123',
        before: JSON.stringify({ field: 'before' }, null, 2),
        after: JSON.stringify({ field: 'after' }, null, 2),
      })
    })
  })

  describe('sentryOnUserChangeV1Wrapper', () => {
    it('should wrap Auth v1 user change handler successfully', async () => {
      const handler = vi.fn().mockResolvedValue('success')
      const wrapper = sentryOnUserChangeV1Wrapper({ name: 'auth-function' }, handler)

      const user: UserRecord = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      } as UserRecord

      const context: EventContext = {
        eventId: 'event-123',
        eventType: 'providers/cloud.auth/eventTypes/user.create',
        resource: { service: 'auth', name: 'projects/test' },
        timestamp: '2023-01-01T00:00:00.000Z',
        params: {},
      }

      const result = await wrapper(user, context)

      expect(result).toBe('success')
      expect(handler).toHaveBeenCalledWith(user, context)
    })

    it('should set user context for Auth v1', async () => {
      const handler = vi.fn().mockResolvedValue('success')
      const wrapper = sentryOnUserChangeV1Wrapper({ name: 'auth-function' }, handler)

      const user: UserRecord = {
        uid: 'user-456',
      } as UserRecord

      const context: EventContext = {
        eventId: 'event-123',
        eventType: 'providers/cloud.auth/eventTypes/user.create',
        resource: { service: 'auth', name: 'projects/test' },
        timestamp: '2023-01-01T00:00:00.000Z',
        params: {},
      }

      await wrapper(user, context)

      expect(mockScope.setUser).toHaveBeenCalledWith({ id: 'user-456' })
    })
  })

  describe('sentryOnScheduleRunV1Wrapper', () => {
    it('should wrap Schedule v1 handler successfully', async () => {
      const handler = vi.fn().mockResolvedValue('success')
      const wrapper = sentryOnScheduleRunV1Wrapper({ name: 'schedule-function' }, handler)

      const context: EventContext = {
        eventId: 'event-123',
        eventType: 'google.pubsub.topic.publish',
        resource: { service: 'pubsub', name: 'projects/test/topics/firebase-schedule-schedule-function' },
        timestamp: '2023-01-01T00:00:00.000Z',
        params: {},
      }

      const result = await wrapper(context)

      expect(result).toBe('success')
      expect(handler).toHaveBeenCalledWith(context)
    })

    it('should set proper tags for Schedule v1', async () => {
      const handler = vi.fn().mockResolvedValue('success')
      const wrapper = sentryOnScheduleRunV1Wrapper({ name: 'schedule-function' }, handler)

      const context: EventContext = {
        eventId: 'event-123',
        eventType: 'google.pubsub.topic.publish',
        resource: { service: 'pubsub', name: 'projects/test/topics/firebase-schedule-schedule-function' },
        timestamp: '2023-01-01T00:00:00.000Z',
        params: {},
      }

      await wrapper(context)

      expect(mockScope.setTag).toHaveBeenCalledWith('function.version', 'v1')
      expect(mockScope.setTag).toHaveBeenCalledWith('function.name', 'schedule-function')
    })
  })

  describe('sentryWrapOnDocumentChange', () => {
    it('should wrap Firestore v2 handler successfully', async () => {
      const handler = vi.fn().mockResolvedValue('success')
      const wrapper = sentryWrapOnDocumentChange({ name: 'firestore-v2-function' }, handler)

      const event: FirestoreEvent<{ foo: string }, { docId: string }> = {
        id: 'event-123',
        type: 'google.cloud.firestore.document.v1.written',
        source: 'projects/test/databases/(default)',
        subject: 'documents/collection/doc-123',
        time: '2023-01-01T00:00:00.000Z',
        document: 'projects/test/databases/(default)/documents/collection/doc-123',
        data: { foo: 'bar' } as { foo: string },
        params: { docId: 'doc-123' },
      } as FirestoreEvent<{ foo: string }, { docId: string }>

      const result = await wrapper(event)

      expect(result).toBe('success')
      expect(handler).toHaveBeenCalledWith(event)
    })

    it('should set proper context for Firestore v2', async () => {
      const handler = vi.fn().mockResolvedValue('success')
      const wrapper = sentryWrapOnDocumentChange({ name: 'firestore-v2-function' }, handler)

      const event: FirestoreEvent<{ data: string }, { docId: string }> = {
        id: 'event-123',
        type: 'google.cloud.firestore.document.v1.written',
        source: 'projects/test/databases/(default)',
        subject: 'documents/collection/doc-123',
        time: '2023-01-01T00:00:00.000Z',
        document: 'projects/test/databases/(default)/documents/collection/doc-123',
        data: { data: 'test' } as { data: string },
        params: { docId: 'doc-123' },
      } as FirestoreEvent<{ data: string }, { docId: string }>

      await wrapper(event)

      expect(mockScope.setTag).toHaveBeenCalledWith('function.version', 'v2')
      expect(mockScope.setTag).toHaveBeenCalledWith('function.name', 'firestore-v2-function')
      expect(mockScope.setContext).toHaveBeenCalledWith('Firebase Context', {
        eventId: 'event-123',
        eventType: 'google.cloud.firestore.document.v1.written',
        source: 'projects/test/databases/(default)',
        subject: 'documents/collection/doc-123',
        timestamp: '2023-01-01T00:00:00.000Z',
      })
      expect(mockScope.setContext).toHaveBeenCalledWith('Firestore Document', {
        document: 'projects/test/databases/(default)/documents/collection/doc-123',
        data: { data: 'test' },
      })
    })
  })

  describe('sentryWrapOnMessagePublished', () => {
    it('should wrap PubSub v2 handler successfully', async () => {
      const handler = vi.fn().mockResolvedValue('success')
      const wrapper = sentryWrapOnMessagePublished({ name: 'pubsub-v2-function' }, handler)

      const event: CloudEvent<MessagePublishedData<{ foo: string }>> = {
        id: 'event-123',
        type: 'google.cloud.pubsub.topic.v1.messagePublished',
        source: 'projects/test/topics/test-topic',
        subject: 'test-subject',
        time: '2023-01-01T00:00:00.000Z',
        data: {
          message: {
            json: { foo: 'bar' },
            data: 'dGVzdA==',
            attributes: {},
          },
        } as MessagePublishedData<{ foo: string }>,
      } as CloudEvent<MessagePublishedData<{ foo: string }>>

      const result = await wrapper(event)

      expect(result).toBe('success')
      expect(handler).toHaveBeenCalledWith(event)
    })

    it('should set proper context for PubSub v2', async () => {
      const handler = vi.fn().mockResolvedValue('success')
      const wrapper = sentryWrapOnMessagePublished({ name: 'pubsub-v2-function' }, handler)

      const event: CloudEvent<MessagePublishedData<{ data: string }>> = {
        id: 'event-123',
        type: 'google.cloud.pubsub.topic.v1.messagePublished',
        source: 'projects/test/topics/test-topic',
        subject: 'test-subject',
        time: '2023-01-01T00:00:00.000Z',
        data: {
          message: {
            json: { data: 'test-data' },
            data: 'dGVzdA==',
            attributes: {},
          },
        } as MessagePublishedData<{ data: string }>,
      } as CloudEvent<MessagePublishedData<{ data: string }>>

      await wrapper(event)

      expect(mockScope.setTag).toHaveBeenCalledWith('function.version', 'v2')
      expect(mockScope.setTag).toHaveBeenCalledWith('function.name', 'pubsub-v2-function')
      expect(mockScope.setContext).toHaveBeenCalledWith('PubSub Message', { data: 'test-data' })
    })
  })

  describe('sentryWrapOnSchedule', () => {
    it('should wrap Schedule v2 handler successfully', async () => {
      // eslint-disable-next-line unicorn/no-useless-undefined
      const handler = vi.fn().mockResolvedValue(undefined)
      const wrapper = sentryWrapOnSchedule({ name: 'schedule-v2-function' }, handler)

      const event: ScheduledEvent = {
        jobName: 'test-job',
        scheduleTime: '2023-01-01T00:00:00.000Z',
      } as ScheduledEvent

      await wrapper(event)

      expect(handler).toHaveBeenCalledWith(event)
    })

    it('should set proper context for Schedule v2', async () => {
      // eslint-disable-next-line unicorn/no-useless-undefined
      const handler = vi.fn().mockResolvedValue(undefined)
      const wrapper = sentryWrapOnSchedule({ name: 'schedule-v2-function' }, handler)

      const event: ScheduledEvent = {
        jobName: 'test-job',
        scheduleTime: '2023-01-01T00:00:00.000Z',
      } as ScheduledEvent

      await wrapper(event)

      expect(mockScope.setTag).toHaveBeenCalledWith('function.version', 'v2')
      expect(mockScope.setTag).toHaveBeenCalledWith('function.name', 'schedule-v2-function')
      expect(mockScope.setContext).toHaveBeenCalledWith('scheduledEvent', { event })
    })

    it('should use on-schedule as operation name', async () => {
      // eslint-disable-next-line unicorn/no-useless-undefined
      const handler = vi.fn().mockResolvedValue(undefined)
      const wrapper = sentryWrapOnSchedule({ name: 'schedule-v2-function' }, handler)

      const event: ScheduledEvent = {
        jobName: 'test-job',
        scheduleTime: '2023-01-01T00:00:00.000Z',
      } as ScheduledEvent

      await wrapper(event)

      expect(SentryNode.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'schedule-v2-function',
          op: 'on-schedule',
        }),
        expect.any(Function)
      )
    })
  })
})
