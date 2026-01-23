# Valian Firebase Functions Utilities

## Packages

This monorepo contains the following packages:

### [@valian/function-logger](./packages/logger)

A smart logger wrapper for Firebase Functions that automatically switches between production and development logging modes.

- 🔄 Automatic Mode Switching between Firebase Functions logger and tslog
- 🎨 Beautiful Console Output with color-coded logs
- ⚙️ Configurable Log Levels via environment variables
- 🔌 Drop-in Replacement for standard logging interfaces

[View Documentation](./packages/logger/README.md)

### [@valian/pino-logger](./packages/pino-logger)

A pino-based logger for Firebase Functions that automatically switches between pretty output in development and forwards to the native `firebase-functions` logger in production.

- 🌲 Full Pino API with child loggers, bindings, and structured logging
- 🔄 Automatic Mode Switching between pino-pretty and Firebase logger
- 🎯 GCP Severity Mapping with range-based level support
- 📊 Structured JSON Logging compatible with GCP Cloud Logging
- ⚙️ Configurable Log Levels via environment variables

[View Documentation](./packages/pino-logger/README.md)

### [@valian/node-sentry](./packages/sentry)

A comprehensive Sentry integration library for Firebase Functions (v1 and v2) that provides automatic error tracking, context enrichment, and performance monitoring.

- 🔧 Easy Sentry initialization with Firebase-specific integrations
- 📦 Wrapper functions for all Firebase Function types (v1 and v2)
- 🎯 Automatic error capture with unhandled exception tracking
- 📊 Performance monitoring with distributed tracing
- 🏷️ Automatic context enrichment (function name, version, event data)

[View Documentation](./packages/sentry/README.md)

## Generate a library

```sh
npx nx g @nx/js:lib packages/pkg1 --publishable --importPath=@my-org/pkg1
```

## Versioning and releasing

To version and release the library use

```sh
npx nx release --skip-publish
```

Pass `--dry-run` to see what would happen without actually releasing the library.

[Learn more about Nx release &raquo;](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
