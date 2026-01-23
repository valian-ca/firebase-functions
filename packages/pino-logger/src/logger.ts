import { logger as firebaseLogger } from 'firebase-functions'
// eslint-disable-next-line import-x/no-named-as-default
import pino, { type DestinationStream, type LevelWithSilentOrString } from 'pino'

const isLocalEnvironment = () =>
  process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development'

type LogSeverity = 'DEBUG' | 'INFO' | 'NOTICE' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'ALERT' | 'EMERGENCY'

type PinoLogEntry = {
  level: number
  time: number
  pid: number
  hostname: string
  msg?: string
  [key: string]: unknown
}

/**
 * Maps pino log level numbers to GCP LogSeverity.
 * Uses ranges to handle any numeric level, including custom levels.
 *
 * Pino standard levels: 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal
 *
 * @see https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#LogSeverity
 */
const pinoLevelToSeverity = (level: number): LogSeverity => {
  if (level < 30) return 'DEBUG' // trace (10) and debug (20)
  if (level < 40) return 'INFO' // info (30)
  if (level < 50) return 'WARNING' // warn (40)
  if (level < 60) return 'ERROR' // error (50)
  return 'CRITICAL' // fatal (60+)
}

const firebaseDestination: DestinationStream = {
  write(logLine) {
    try {
      const log = JSON.parse(logLine) as PinoLogEntry
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { level, time, pid, hostname, msg, ...rest } = log

      firebaseLogger.write({
        severity: pinoLevelToSeverity(level),
        message: msg ?? '',
        ...rest,
      })
    } catch {
      // Fallback for malformed JSON - write raw log line
      firebaseLogger.write({
        severity: 'ERROR',
        message: logLine,
      })
    }
  },
}

export const createLogger = (level: LevelWithSilentOrString = process.env.LOG_LEVEL ?? 'debug') =>
  isLocalEnvironment()
    ? pino({
        level,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      })
    : pino({ level }, firebaseDestination)

export const logger = createLogger()
