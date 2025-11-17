# @valian/function-logger

A smart logger wrapper for Firebase Functions that automatically switches between production and development logging modes.

## Features

- 🔄 **Automatic Mode Switching**: Uses Firebase Functions logger in production and [tslog](https://tslog.js.org/) with pretty formatting during development
- 🎨 **Beautiful Console Output**: Color-coded logs with timestamps and source file information in development
- ⚙️ **Configurable Log Levels**: Control verbosity via environment variables
- 🔌 **Drop-in Replacement**: Compatible API with standard logging interfaces

## Installation

```bash
npm install @valian/function-logger
```

Or with pnpm:

```bash
pnpm add @valian/function-logger
```

## Usage

### Basic Usage

```typescript
import { logger } from '@valian/function-logger'

// Log at different levels
logger.debug('Debugging information')
logger.info('General information')
logger.warn('Warning message')
logger.error('Error occurred', error)

// Log multiple arguments
logger.info('User action:', { userId: '123', action: 'login' })
```

### In Firebase Functions

```typescript
import { onRequest } from 'firebase-functions/v2/https'
import { logger } from '@valian/function-logger'

export const myFunction = onRequest((request, response) => {
  logger.info('Function invoked', { path: request.path })

  try {
    // Your function logic
    logger.debug('Processing request...')
    response.send('Success')
  } catch (error) {
    logger.error('Function failed', error)
    response.status(500).send('Error')
  }
})
```

## Configuration

### Log Levels

Control the minimum log level by setting the `LOG_LEVEL` environment variable:

```bash
# Available levels (in order of verbosity)
LOG_LEVEL=debug  # Shows debug, info, warn, error (default)
LOG_LEVEL=info   # Shows info, warn, error
LOG_LEVEL=warn   # Shows warn, error
LOG_LEVEL=error  # Shows only error
```

### Environment Detection

The logger automatically detects the environment:

- **Development Mode**: Uses tslog with pretty formatting when:

  - `FUNCTIONS_EMULATOR=true` (Firebase Emulator)
  - `NODE_ENV=test` (Testing environment)

- **Production Mode**: Uses Firebase Functions logger when running in deployed functions

## API Reference

### `logger.debug(...args: any[])`

Logs debug-level messages. Useful for detailed diagnostic information.

### `logger.log(...args: any[])`

Alias for general logging (same as `info`).

### `logger.info(...args: any[])`

Logs informational messages about normal application flow.

### `logger.warn(...args: any[])`

Logs warning messages for potentially problematic situations.

### `logger.error(...args: any[])`

Logs error messages for serious problems.

## Development

This library is part of the [firebase-functions](https://github.com/valian-ca/firebase-functions) monorepo.

### Running Unit Tests

```bash
nx test logger
```

Or using pnpm:

```bash
pnpm nx test logger
```

## License

MIT © [Valian](https://valian.ca)
