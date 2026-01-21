import { addExceptionMechanism, type StartSpanOptions } from '@sentry/core'
import { captureException, flush, type Scope, startSpan, withScope } from '@sentry/node'
import { logger } from '@valian/function-logger'
import { type CloudEvent } from 'firebase-functions/core'
import { type FirestoreEvent } from 'firebase-functions/firestore'
import { type MessagePublishedData } from 'firebase-functions/pubsub'
import { type ScheduledEvent } from 'firebase-functions/scheduler'
import { type Request } from 'firebase-functions/tasks'
import { type Change, type EventContext } from 'firebase-functions/v1'
import { type UserRecord } from 'firebase-functions/v1/auth'
import { type DocumentSnapshot } from 'firebase-functions/v1/firestore'
import { type Message } from 'firebase-functions/v1/pubsub'

type SentryWrapperParams = { name: string }

/**
 * Marks an event as unhandled by adding a span processor to the passed scope.
 */
export function markEventUnhandled(scope: Scope): Scope {
  scope.addEventProcessor((event) => {
    addExceptionMechanism(event, { handled: false })
    return event
  })

  return scope
}

const sentryCaptureUnhandledExceptionWrapper =
  <R>(work: () => Promise<R>, captureContext?: (scope: Scope) => Scope) =>
  async () => {
    try {
      return await work()
    } catch (error) {
      // Unhandled exceptions are automatically logged when run in Firebase in production, but not in the emulator in
      // development.
      if (process.env.NODE_ENV !== 'production') {
        logger.error('Unhandled exception', error)
      }
      captureException(error, (scope) => {
        markEventUnhandled(scope)
        return captureContext?.(scope) ?? scope
      })
      throw error
    }
  }

export async function sentryConfigurationWrapper<R>(
  context: StartSpanOptions,
  configure: (scope: Scope) => void,
  work: () => Promise<R>,
) {
  try {
    return await startSpan(context, async () =>
      withScope(async (scope) => {
        configure(scope)
        return work()
      }),
    )
  } finally {
    await flush(5000)
  }
}

const sentryInvocationV1Wrapper = <R, EC>(
  options: SentryWrapperParams,
  context: EventContext<EC>,
  configure: (scope: Scope) => void,
  work: () => Promise<R>,
) =>
  sentryConfigurationWrapper(
    { name: options.name, op: context.eventType },
    (scope) => {
      configure(scope)
      scope.setTag('function.version', 'v1')
      scope.setTag('function.name', options.name)
      scope.setContext('Firebase Context', {
        eventId: context.eventId,
        eventType: context.eventType,
        resource: context.resource,
        timestamp: context.timestamp,
      })
    },
    sentryCaptureUnhandledExceptionWrapper(work),
  )

export const sentryOnPublishV1Wrapper =
  <R, EC>(options: SentryWrapperParams, handler: (event: Message, context: EventContext<EC>) => Promise<R>) =>
  (message: Message, context: EventContext<EC>) =>
    sentryInvocationV1Wrapper(
      options,
      context,
      (scope) => {
        scope.setContext('PubSub Message', message.json as Record<string, unknown>)
      },
      () => handler(message, context),
    )

export const sentryOnWriteV1Wrapper =
  <R, EC>(
    options: SentryWrapperParams,
    handler: (change: Change<DocumentSnapshot>, context: EventContext<EC>) => Promise<R>,
  ) =>
  (change: Change<DocumentSnapshot>, context: EventContext<EC>) =>
    sentryInvocationV1Wrapper(
      options,
      context,
      (scope) => {
        scope.setContext('Firestore Document', {
          param: context.params,
          id: change.before.ref.id,
          path: change.before.ref.path,
          before: JSON.stringify(change.before.data(), null, 2),
          after: JSON.stringify(change.after.data(), null, 2),
        })
      },
      () => handler(change, context),
    )

export const sentryOnUserChangeV1Wrapper =
  <R>(options: SentryWrapperParams, handler: (user: UserRecord, context: EventContext) => Promise<R>) =>
  (user: UserRecord, context: EventContext) =>
    sentryInvocationV1Wrapper(
      options,
      context,
      (scope) => {
        scope.setUser({ id: user.uid })
      },
      () => handler(user, context),
    )

export const sentryOnScheduleRunV1Wrapper =
  <R>(options: SentryWrapperParams, handler: (context: EventContext) => Promise<R>) =>
  (context: EventContext) =>
    sentryInvocationV1Wrapper(
      options,
      context,
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- No need to configure the scope
      () => {},
      () => handler(context),
    )

const sentryInvocationV2Wrapper = <R, T>(
  options: SentryWrapperParams,
  event: CloudEvent<T>,
  configure: (scope: Scope) => void,
  work: () => Promise<R>,
) =>
  sentryConfigurationWrapper(
    { name: options.name, op: event.type },
    (scope) => {
      configure(scope)
      scope.setTag('function.version', 'v2')
      scope.setTag('function.name', options.name)
      scope.setContext('Firebase Context', {
        eventId: event.id,
        eventType: event.type,
        source: event.source,
        subject: event.subject,
        timestamp: event.time,
      })
    },
    sentryCaptureUnhandledExceptionWrapper(work),
  )

export const sentryWrapOnDocumentChange =
  <T, P, R>(options: SentryWrapperParams, handler: (event: FirestoreEvent<T, P>) => Promise<R>) =>
  (event: FirestoreEvent<T, P>) =>
    sentryInvocationV2Wrapper(
      options,
      event,
      (scope) => {
        scope.setContext('Firestore Document', {
          document: event.document,
          data: event.data,
        })
      },
      () => handler(event),
    )

export const sentryWrapOnMessagePublished =
  <T extends Record<string, unknown>, R>(
    options: SentryWrapperParams,
    handler: (event: CloudEvent<MessagePublishedData<T>>) => Promise<R>,
  ) =>
  async (event: CloudEvent<MessagePublishedData<T>>) =>
    sentryInvocationV2Wrapper(
      options,
      event,
      (scope) => {
        scope.setContext('PubSub Message', event.data.message.json)
      },
      () => handler(event),
    )

export const sentryWrapOnSchedule =
  (options: SentryWrapperParams, handler: (event: ScheduledEvent) => Promise<void>) => async (event: ScheduledEvent) =>
    sentryConfigurationWrapper(
      { name: options.name, op: 'on-schedule' },
      (scope) => {
        scope.setContext('scheduledEvent', { event })
        scope.setTag('function.version', 'v2')
        scope.setTag('function.name', options.name)
      },
      sentryCaptureUnhandledExceptionWrapper(() => handler(event)),
    )

export const sentryWrapOnTaskDispatched =
  <T, R>(options: SentryWrapperParams, handler: (request: Request<T>) => Promise<R>) =>
  async (request: Request<T>) =>
    sentryConfigurationWrapper(
      { name: options.name, op: 'on-task-dispatched' },
      (scope) => {
        scope.setTag('function.version', 'v2')
        scope.setTag('function.name', options.name)
        scope.setContext('Task Request', {
          id: request.id,
          queueName: request.queueName,
          retryCount: request.retryCount,
          data: request.data,
        })
      },
      sentryCaptureUnhandledExceptionWrapper(() => handler(request)),
    )
