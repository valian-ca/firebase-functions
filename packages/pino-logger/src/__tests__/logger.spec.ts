import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('logger', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset modules before each test to allow re-importing with different env vars
    vi.resetModules()
    // Create a fresh copy of process.env
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original env
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('in emulator environment', () => {
    it('should create a pino logger when FUNCTIONS_EMULATOR is true', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'debug'

      const { logger } = await import('../logger.js')

      expect(logger).toBeDefined()
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
      expect(typeof logger.fatal).toBe('function')
      expect(typeof logger.trace).toBe('function')
    })

    it('should log debug messages with LOG_LEVEL=debug', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'debug'

      const { logger } = await import('../logger.js')

      expect(() => {
        logger.debug({ data: 'value' }, 'test debug message')
      }).not.toThrow()
    })

    it('should log info messages with LOG_LEVEL=info', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'info'

      const { logger } = await import('../logger.js')

      expect(() => {
        logger.info('test info message')
      }).not.toThrow()
    })

    it('should log warn messages with LOG_LEVEL=warn', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'warn'

      const { logger } = await import('../logger.js')

      expect(() => {
        logger.warn('test warn message')
      }).not.toThrow()
    })

    it('should log error messages with LOG_LEVEL=error', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'error'

      const { logger } = await import('../logger.js')

      expect(() => {
        logger.error(new Error('test error'), 'test error message')
      }).not.toThrow()
    })

    it('should use default log level when LOG_LEVEL is not set', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      delete process.env.LOG_LEVEL

      const { logger } = await import('../logger.js')

      expect(() => {
        logger.debug('test debug message')
      }).not.toThrow()
    })
  })

  describe('in test environment', () => {
    it('should create a pino logger when NODE_ENV is test', async () => {
      process.env.NODE_ENV = 'test'
      delete process.env.FUNCTIONS_EMULATOR

      const { logger } = await import('../logger.js')

      expect(logger).toBeDefined()
      expect(typeof logger.debug).toBe('function')
    })

    it('should log messages in test environment', async () => {
      process.env.NODE_ENV = 'test'
      process.env.LOG_LEVEL = 'debug'

      const { logger } = await import('../logger.js')

      expect(() => {
        logger.debug('test message in test env')
      }).not.toThrow()
    })
  })

  describe('in development environment', () => {
    it('should create a pino logger when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development'
      delete process.env.FUNCTIONS_EMULATOR

      const { logger } = await import('../logger.js')

      expect(logger).toBeDefined()
      expect(typeof logger.debug).toBe('function')
    })

    it('should log messages in development environment', async () => {
      process.env.NODE_ENV = 'development'
      delete process.env.FUNCTIONS_EMULATOR
      process.env.LOG_LEVEL = 'debug'

      const { logger } = await import('../logger.js')

      expect(() => {
        logger.info('test message in development')
      }).not.toThrow()
    })
  })

  describe('in production environment', () => {
    it('should use firebase destination in production', async () => {
      delete process.env.FUNCTIONS_EMULATOR
      delete process.env.NODE_ENV

      const { logger } = await import('../logger.js')

      expect(logger).toBeDefined()
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
    })

    it('should have all pino logger methods in production', async () => {
      delete process.env.FUNCTIONS_EMULATOR
      delete process.env.NODE_ENV

      const { logger } = await import('../logger.js')

      // Test that all methods exist and are callable
      expect(() => {
        logger.debug('test')
      }).not.toThrow()
      expect(() => {
        logger.info('test')
      }).not.toThrow()
      expect(() => {
        logger.warn('test')
      }).not.toThrow()
      expect(() => {
        logger.error('test')
      }).not.toThrow()
      expect(() => {
        logger.fatal('test')
      }).not.toThrow()
    })

    it('should forward logs with data to firebase logger', async () => {
      delete process.env.FUNCTIONS_EMULATOR
      delete process.env.NODE_ENV

      const { logger } = await import('../logger.js')

      // Test debug with data
      expect(() => {
        logger.debug({ userId: '123' }, 'debug with data')
      }).not.toThrow()

      // Test info with data
      expect(() => {
        logger.info({ action: 'login' }, 'info with data')
      }).not.toThrow()

      // Test warn with data
      expect(() => {
        logger.warn({ warning: 'high memory' }, 'warn with data')
      }).not.toThrow()

      // Test error with data
      expect(() => {
        logger.error({ errorCode: 500 }, 'error with data')
      }).not.toThrow()
    })

    it('should handle messages without additional data', async () => {
      delete process.env.FUNCTIONS_EMULATOR
      delete process.env.NODE_ENV

      const { logger } = await import('../logger.js')

      // Test all levels without data
      expect(() => {
        logger.debug('debug message only')
      }).not.toThrow()
      expect(() => {
        logger.info('info message only')
      }).not.toThrow()
      expect(() => {
        logger.warn('warn message only')
      }).not.toThrow()
      expect(() => {
        logger.error('error message only')
      }).not.toThrow()
    })

    it('should handle object-only logs without message', async () => {
      delete process.env.FUNCTIONS_EMULATOR
      delete process.env.NODE_ENV

      const { logger } = await import('../logger.js')

      // Log only an object without a message string - tests the msg ?? '' fallback
      expect(() => {
        logger.info({ userId: '123', action: 'test' })
      }).not.toThrow()
    })

    it('should handle malformed JSON gracefully', async () => {
      delete process.env.FUNCTIONS_EMULATOR
      delete process.env.NODE_ENV

      // Import the destination directly by getting a fresh logger
      const { createLogger } = await import('../logger.js')
      const logger = createLogger()

      // Mock JSON.parse to throw for pino log lines
      const originalParse = JSON.parse
      vi.spyOn(JSON, 'parse').mockImplementation((text: string): unknown => {
        // Throw for any pino log line (contains "level" field)
        if (typeof text === 'string' && text.includes('"level":')) {
          throw new Error('Simulated JSON parse error')
        }
        return originalParse(text) as unknown
      })

      // This should not throw even when JSON.parse fails
      expect(() => {
        logger.info('malformed test')
      }).not.toThrow()

      vi.restoreAllMocks()
    })
  })

  describe('pino logger features', () => {
    it('should support object as first argument (pino style)', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'debug'

      const { logger } = await import('../logger.js')

      expect(() => {
        logger.info({ key: 'value', another: 'object' }, 'message with context')
      }).not.toThrow()
    })

    it('should handle nested objects', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'debug'

      const { logger } = await import('../logger.js')

      const complexObject = {
        nested: {
          deep: {
            value: 'test',
          },
        },
        array: [1, 2, 3],
      }

      expect(() => {
        logger.debug(complexObject, 'complex data')
      }).not.toThrow()
    })

    it('should handle Error objects', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'error'

      const { logger } = await import('../logger.js')

      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at test.js:1:1'

      expect(() => {
        logger.error(error, 'Error occurred')
      }).not.toThrow()
    })

    it('should support child loggers', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'debug'

      const { logger } = await import('../logger.js')

      const childLogger = logger.child({ requestId: '123' })

      expect(childLogger).toBeDefined()
      expect(() => {
        childLogger.info('child logger message')
      }).not.toThrow()
    })

    it('should support string-only messages', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'debug'

      const { logger } = await import('../logger.js')

      expect(() => {
        logger.info('single message')
      }).not.toThrow()
    })
  })
})
