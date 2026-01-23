# @valian/pino-logger

A pino-based logger for Firebase Functions that automatically switches between pretty output in development and forwards to the native `firebase-functions` logger in production for GCP-compatible structured logging.

## Features

- **Automatic Mode Switching**: Uses [pino-pretty](https://github.com/pinojs/pino-pretty) for colorized output during development and forwards to `firebase-functions/logger` in production
- **Firebase Logger Integration**: In production, logs are forwarded to the native Firebase logger with proper GCP severity mapping
- **Full Pino API**: Exposes a standard `pino.Logger` instance with all pino features (child loggers, bindings, etc.)
- **Optional Pretty Printing**: `pino-pretty` is an optional peer dependency for development
- **Configurable Log Levels**: Control verbosity via environment variables
- **Robust Severity Mapping**: Uses range-based mapping to handle standard and custom pino levels

## Installation

```bash
npm install @valian/pino-logger
```

Or with pnpm:

```bash
pnpm add @valian/pino-logger
```

### Peer Dependencies

This package requires `firebase-functions` as a peer dependency (used in production for GCP logging):

```bash
pnpm add firebase-functions
```

For pretty output in development, also install `pino-pretty`:

```bash
pnpm add -D pino-pretty
```

## Usage

### Basic Usage

```typescript
import { logger } from '@valian/pino-logger'

// Log with context object (pino style - object first, message second)
logger.info({ userId: '123', action: 'login' }, 'User logged in')

// Log simple messages
logger.debug('Debugging information')
logger.info('General information')
logger.warn('Warning message')
logger.error('Error occurred')

// Log errors with stack traces
logger.error(error, 'Something went wrong')
```

### Child Loggers

```typescript
import { logger } from '@valian/pino-logger'

// Create a child logger with bound context
const requestLogger = logger.child({ requestId: 'abc-123' })

requestLogger.info('Processing request') // includes requestId in output
requestLogger.error({ statusCode: 500 }, 'Request failed')
```

### In Firebase Functions

```typescript
import { onRequest } from 'firebase-functions/v2/https'
import { logger } from '@valian/pino-logger'

export const myFunction = onRequest((request, response) => {
  const reqLogger = logger.child({ path: request.path })

  reqLogger.info('Function invoked')

  try {
    // Your function logic
    reqLogger.debug({ query: request.query }, 'Processing request')
    response.send('Success')
  } catch (error) {
    reqLogger.error(error, 'Function failed')
    response.status(500).send('Error')
  }
})
```

## Configuration

### Log Levels

Control the minimum log level by setting the `LOG_LEVEL` environment variable:

```bash
# Available levels (in order of verbosity)
LOG_LEVEL=trace  # Shows all logs
LOG_LEVEL=debug  # Shows debug, info, warn, error, fatal (default)
LOG_LEVEL=info   # Shows info, warn, error, fatal
LOG_LEVEL=warn   # Shows warn, error, fatal
LOG_LEVEL=error  # Shows error, fatal
LOG_LEVEL=fatal  # Shows only fatal
```

### Environment Detection

The logger automatically detects the environment:

- **Development Mode**: Uses pino-pretty (if available) when:
  - `FUNCTIONS_EMULATOR=true` (Firebase Emulator)
  - `NODE_ENV=test` (Testing environment)
  - `NODE_ENV=development` (Development environment)

- **Production Mode**: Forwards logs to `firebase-functions/logger` for GCP-compatible structured logging

## GCP Log Level Mapping

In production, pino log levels are mapped to GCP Cloud Logging severity levels using a range-based approach that also supports custom levels:

| Pino Level   | Level Number | GCP Severity |
| ------------ | ------------ | ------------ |
| trace        | 10           | DEBUG        |
| debug        | 20           | DEBUG        |
| info         | 30           | INFO         |
| warn         | 40           | WARNING      |
| error        | 50           | ERROR        |
| fatal        | 60           | CRITICAL     |
| custom (60+) | 60+          | CRITICAL     |

The mapping uses ranges (`< 30` = DEBUG, `< 40` = INFO, etc.) to handle any numeric level, including custom pino levels.

## How It Works

In **development** (emulator, test, or development environment):

- Uses `pino-pretty` for colorized, human-readable output
- Logs directly to the console

In **production** (deployed Firebase Functions):

- Pino serializes logs to JSON
- A custom destination stream parses the JSON and extracts the message and metadata
- The log is forwarded to `firebase-functions/logger.write()` with the mapped GCP severity
- Firebase's logger handles the structured logging format expected by GCP Cloud Logging

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Application    │────>│  Pino Logger     │────>│  Firebase       │
│  logger.info()  │     │  (JSON output)   │     │  Destination    │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          v
                                               ┌─────────────────────┐
                                               │ firebase-functions  │
                                               │ logger.write()      │
                                               └──────────┬──────────┘
                                                          │
                                                          v
                                               ┌─────────────────────┐
                                               │  GCP Cloud Logging  │
                                               │  (Structured JSON)  │
                                               └─────────────────────┘
```

## API Reference

This package exports a pre-configured `pino.Logger` instance and a factory function. See the [pino documentation](https://getpino.io/) for the full API.

### Exports

#### `logger`

A pre-configured pino logger instance ready to use.

#### `createLogger(level?)`

Factory function to create a custom logger with a specific log level.

```typescript
import { createLogger } from '@valian/pino-logger'

const customLogger = createLogger('info') // Only logs info and above
```

### Common Methods

#### `logger.trace(obj?, msg?, ...args)`

#### `logger.debug(obj?, msg?, ...args)`

#### `logger.info(obj?, msg?, ...args)`

#### `logger.warn(obj?, msg?, ...args)`

#### `logger.error(obj?, msg?, ...args)`

#### `logger.fatal(obj?, msg?, ...args)`

Log at the specified level. The first argument can be an object with context data.

#### `logger.child(bindings)`

Create a child logger with additional context that will be included in all log entries.

## Development

This library is part of the [firebase-functions](https://github.com/valian-ca/firebase-functions) monorepo.

### Running Unit Tests

```bash
nx test pino-logger
```

Or using pnpm:

```bash
pnpm nx test pino-logger
```

## License

MIT © [Valian](https://valian.ca)
