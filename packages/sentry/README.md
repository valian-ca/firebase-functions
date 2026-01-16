# @valian/node-sentry

A comprehensive Sentry integration library for Firebase Functions (v1 and v2) that provides automatic error tracking, context enrichment, and performance monitoring.

## Features

- 🔧 Easy Sentry initialization with Firebase-specific integrations
- 📦 Wrapper functions for all Firebase Function types (v1 and v2)
- 🎯 Automatic error capture with unhandled exception tracking
- 📊 Performance monitoring with distributed tracing
- 🏷️ Automatic context enrichment (function name, version, event data)
- 🔗 Support for error cause chains with custom Sentry context
- ⚡ Helper utilities for promise handling

## Installation

```bash
npm install @valian/node-sentry @sentry/node @sentry/core
```

or

```bash
pnpm add @valian/node-sentry @sentry/node @sentry/core
```

## Quick Start

### 1. Initialize Sentry

Create an initialization file (e.g., `sentry.ts`):

```typescript
import { initSentry } from '@valian/node-sentry/init'

initSentry({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.ENVIRONMENT || 'development',
  tracesSampleRate: 1.0,
})
```

Import this file at the top of your functions entry point before defining any functions.

### 2. Wrap Your Firebase Functions

### Firebase Functions v2

#### Firestore Trigger

```typescript
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { sentryWrapOnDocumentChange } from '@valian/node-sentry'

export const onUserUpdate = onDocumentWritten(
  'users/{userId}',
  sentryWrapOnDocumentChange({ name: 'onUserUpdate' }, async (event) => {
    // Your function logic here
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    // ...
  }),
)
```

#### PubSub Trigger

```typescript
import { onMessagePublished } from 'firebase-functions/v2/pubsub'
import { sentryWrapOnMessagePublished } from '@valian/node-sentry'

export const onTaskCreated = onMessagePublished(
  'task-created',
  sentryWrapOnMessagePublished({ name: 'onTaskCreated' }, async (event) => {
    const messageData = event.data.message.json
    // Your function logic here
  }),
)
```

#### Scheduled Function

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { sentryWrapOnSchedule } from '@valian/node-sentry'

export const dailyCleanup = onSchedule(
  'every 24 hours',
  sentryWrapOnSchedule({ name: 'dailyCleanup' }, async (event) => {
    // Your cleanup logic here
  }),
)
```

### Firebase Functions v1

#### Firestore Trigger

```typescript
import * as functions from 'firebase-functions/v1'
import { sentryOnWriteV1Wrapper } from '@valian/node-sentry'

export const onUserUpdateV1 = functions.firestore.document('users/{userId}').onWrite(
  sentryOnWriteV1Wrapper({ name: 'onUserUpdateV1' }, async (change, context) => {
    // Your function logic here
  }),
)
```

#### PubSub Trigger

```typescript
import * as functions from 'firebase-functions/v1'
import { sentryOnPublishV1Wrapper } from '@valian/node-sentry'

export const onTaskCreatedV1 = functions.pubsub.topic('task-created').onPublish(
  sentryOnPublishV1Wrapper({ name: 'onTaskCreatedV1' }, async (message, context) => {
    // Your function logic here
  }),
)
```

#### Auth Trigger

```typescript
import * as functions from 'firebase-functions/v1'
import { sentryOnUserChangeV1Wrapper } from '@valian/node-sentry'

export const onUserCreate = functions.auth.user().onCreate(
  sentryOnUserChangeV1Wrapper({ name: 'onUserCreate' }, async (user, context) => {
    // Your function logic here
  }),
)
```

#### Scheduled Function

```typescript
import * as functions from 'firebase-functions/v1'
import { sentryOnScheduleRunV1Wrapper } from '@valian/node-sentry'

export const dailyCleanupV1 = functions.pubsub.schedule('every 24 hours').onRun(
  sentryOnScheduleRunV1Wrapper({ name: 'dailyCleanupV1' }, async (context) => {
    // Your cleanup logic here
  }),
)
```

## Advanced Usage

### Custom Error with Sentry Context

Use `ErrorWithSentryCaptureContext` to throw errors with additional Sentry context that will be automatically captured:

```typescript
import { ErrorWithSentryCaptureContext } from '@valian/node-sentry'

throw new ErrorWithSentryCaptureContext(
  'Failed to process payment',
  {
    extra: {
      paymentId: 'payment_123',
      amount: 100,
    },
    tags: {
      payment_type: 'subscription',
    },
    fingerprint: ['payment-processing-error'],
  },
  { cause: originalError },
)
```

### Handle Unawaited Promises

For fire-and-forget promises that you don't want to await, use `handleNotAwaitedPromise` to ensure errors are captured:

```typescript
import { handleNotAwaitedPromise } from '@valian/node-sentry'

// Instead of:
// someAsyncTask().catch(console.error)

// Use:
handleNotAwaitedPromise(someAsyncTask(), (scope) => {
  scope.setTag('task_type', 'background')
})
```

### Custom Configuration Wrapper

For custom function types or more control, use `sentryConfigurationWrapper`:

```typescript
import { sentryConfigurationWrapper } from '@valian/node-sentry'

export const myCustomFunction = async (request, response) => {
  return sentryConfigurationWrapper(
    { name: 'myCustomFunction', op: 'http.server' },
    (scope) => {
      scope.setTag('function.type', 'custom')
      scope.setContext('request', {
        method: request.method,
        url: request.url,
      })
    },
    async () => {
      // Your function logic here
      return { success: true }
    },
  )
}
```

### Mark Events as Unhandled

To explicitly mark caught exceptions as unhandled in Sentry:

```typescript
import { captureException } from '@sentry/node'
import { markEventUnhandled } from '@valian/node-sentry'

try {
  await riskyOperation()
} catch (error) {
  captureException(error, (scope) => {
    markEventUnhandled(scope)
    scope.setTag('operation', 'risky')
    return scope
  })
  // Re-throw or handle as needed
}
```

## What Gets Captured Automatically

The wrapper functions automatically capture and send to Sentry:

- **Unhandled exceptions** - All errors thrown from your function handlers
- **Function metadata** - Function name, version (v1 or v2)
- **Event context** - Event ID, type, timestamp, source
- **Firestore data** - Document paths, IDs, before/after snapshots
- **PubSub messages** - Message data
- **User information** - User ID for auth triggers
- **Performance traces** - Distributed tracing for all operations

## Environment Variables

```bash
SENTRY_DSN=your-sentry-dsn
ENVIRONMENT=production
NODE_ENV=production
```

## API Reference

### `initSentry(options)`

Initialize Sentry with Firebase-specific integrations.

- **Parameters:**
  - `options` (Omit<NodeOptions, 'beforeSend'>): Sentry Node.js options
- **Returns:** void

### Wrapper Functions

All wrapper functions follow the same pattern:

```typescript
wrapperFunction({ name: 'functionName' }, async (event, context?) => {
  // Your handler
})
```

#### V2 Wrappers

- `sentryWrapOnDocumentChange` - Firestore document changes
- `sentryWrapOnMessagePublished` - PubSub messages
- `sentryWrapOnSchedule` - Scheduled functions

#### V1 Wrappers

- `sentryOnWriteV1Wrapper` - Firestore writes
- `sentryOnPublishV1Wrapper` - PubSub publishes
- `sentryOnUserChangeV1Wrapper` - Auth user changes
- `sentryOnScheduleRunV1Wrapper` - Scheduled runs

### `ErrorWithSentryCaptureContext`

Custom error class for attaching Sentry capture context.

```typescript
new ErrorWithSentryCaptureContext(
  message: string,
  captureContext: ErrorCaptureContext,
  options?: ErrorOptions
)
```

### `handleNotAwaitedPromise(promise, hint?)`

Handle promises that aren't awaited and capture any errors.

- **Parameters:**
  - `promise` (`Promise<T> | undefined`): The promise to handle
  - `hint` (optional): Sentry capture hint for additional context

### `sentryConfigurationWrapper(context, configure, work)`

Generic wrapper for custom Sentry configuration.

- **Parameters:**
  - `context` (`StartSpanOptions`): Span configuration
  - `configure` (`(scope: Scope) => void`): Scope configuration function
  - `work` (`() => Promise<R>`): The work to execute

## Best Practices

1. **Initialize early** - Import and call `initSentry()` before defining any functions
2. **Name your functions** - Always provide a descriptive `name` in wrapper options
3. **Use appropriate wrappers** - Use v2 wrappers for v2 functions, v1 for v1
4. **Handle background tasks** - Use `handleNotAwaitedPromise` for fire-and-forget operations
5. **Add custom context** - Use `ErrorWithSentryCaptureContext` for domain-specific error information
6. **Set environment** - Configure different sample rates and environments for dev/prod

## License

MIT

## Development

Run unit tests:

```bash
nx test sentry
```

Build the library:

```bash
nx build sentry
```
