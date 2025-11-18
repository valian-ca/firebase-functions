import { logger as firebaseLogger } from 'firebase-functions'
import { Logger as TSLogger } from 'tslog'

export type Logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (...args: any[]) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log: (...args: any[]) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (...args: any[]) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (...args: any[]) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) => void
}

function getMinLevel() {
  const logLevel = (process.env.LOG_LEVEL ?? 'debug') as keyof Logger
  switch (logLevel) {
    case 'debug':
      return 2
    case 'info':
      return 3
    case 'warn':
      return 4
    case 'error':
      return 5
    default:
      return 0
  }
}

export const logger: Logger =
  process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development'
    ? new TSLogger({
        minLevel: getMinLevel(),
        prettyLogTemplate: '{{hh}}:{{MM}}:{{ss}}:{{ms}}  {{logLevelName}}  [{{fileNameWithLine}}{{name}}]  ',
        prettyErrorTemplate: '\n{{errorName}} {{errorMessage}}\nerror stack:\n{{errorStack}}',
        prettyErrorStackTemplate: '  • {{fileName}}\t{{method}}\n\t{{filePathWithLine}}',
        prettyErrorParentNamesSeparator: ':',
        prettyErrorLoggerNameDelimiter: '\t',
        prettyInspectOptions: {
          depth: 5,
          colors: true,
          sorted: true,
        },
        stylePrettyLogs: true,
        prettyLogTimeZone: 'local',
        prettyLogStyles: {
          logLevelName: {
            '*': ['bold', 'black', 'bgWhiteBright', 'dim'],
            SILLY: ['bold', 'white'],
            TRACE: ['bold', 'whiteBright'],
            DEBUG: ['bold', 'green'],
            INFO: ['bold', 'blue'],
            WARN: ['bold', 'yellow'],
            ERROR: ['bold', 'red'],
            FATAL: ['bold', 'redBright'],
          },
          dateIsoStr: 'white',
          filePathWithLine: 'white',
          name: ['white', 'bold'],
          nameWithDelimiterPrefix: ['white', 'bold'],
          nameWithDelimiterSuffix: ['white', 'bold'],
          errorName: ['bold', 'bgRedBright', 'whiteBright'],
          fileName: ['yellow'],
        },
      })
    : (firebaseLogger as Logger)
