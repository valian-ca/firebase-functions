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
    it('should use TSLogger when FUNCTIONS_EMULATOR is true', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'debug'

      const { logger } = await import('../logger.js')

      expect(logger).toBeDefined()
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.log).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
    })

    it('should log debug messages with LOG_LEVEL=debug', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'debug'

      const { logger } = await import('../logger.js')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      logger.debug('test debug message', { data: 'value' })

      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should log info messages with LOG_LEVEL=info', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'info'

      const { logger } = await import('../logger.js')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      logger.info('test info message')

      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should not log debug messages when LOG_LEVEL=info', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'info'

      const { logger } = await import('../logger.js')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      logger.debug('test debug message')

      expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('should log warn messages with LOG_LEVEL=warn', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'warn'

      const { logger } = await import('../logger.js')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      logger.warn('test warn message')

      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should not log info messages when LOG_LEVEL=warn', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'warn'

      const { logger } = await import('../logger.js')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      logger.info('test info message')

      expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('should log error messages with LOG_LEVEL=error', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'error'

      const { logger } = await import('../logger.js')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      logger.error('test error message', new Error('test error'))

      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should not log warn messages when LOG_LEVEL=error', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'error'

      const { logger } = await import('../logger.js')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      logger.warn('test warn message')

      expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('should use default log level when LOG_LEVEL is not set', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      delete process.env.LOG_LEVEL

      const { logger } = await import('../logger.js')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      logger.debug('test debug message')

      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should handle invalid LOG_LEVEL value', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'invalid'

      const { logger } = await import('../logger.js')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      // With invalid log level (default case returns 0), all logs should show
      logger.debug('test debug message')

      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should support log method', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'debug'

      const { logger } = await import('../logger.js')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      logger.log('test log message')

      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('in test environment', () => {
    it('should use TSLogger when NODE_ENV is test', async () => {
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
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      logger.debug('test message in test env')

      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('in production environment', () => {
    it('should use firebase logger in production', async () => {
      delete process.env.FUNCTIONS_EMULATOR
      delete process.env.NODE_ENV

      const { logger } = await import('../logger.js')

      expect(logger).toBeDefined()
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.log).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
    })

    it('should have all required logger methods in production', async () => {
      delete process.env.FUNCTIONS_EMULATOR
      delete process.env.NODE_ENV

      const { logger } = await import('../logger.js')

      // Test that all methods exist and are callable
      expect(() => {
        logger.debug('test')
      }).not.toThrow()
      expect(() => {
        logger.log('test')
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
    })
  })

  describe('logger method variants', () => {
    it('should handle multiple arguments', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'debug'

      const { logger } = await import('../logger.js')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      logger.info('message', { key: 'value' }, ['array'], 123, true)

      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should handle objects and arrays', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'debug'

      const { logger } = await import('../logger.js')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      const complexObject = {
        nested: {
          deep: {
            value: 'test',
          },
        },
        array: [1, 2, 3],
      }

      logger.debug('complex data', complexObject)

      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should handle Error objects', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true'
      process.env.LOG_LEVEL = 'error'

      const { logger } = await import('../logger.js')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn())

      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at test.js:1:1'

      logger.error('Error occurred', error)

      expect(consoleSpy).toHaveBeenCalled()
    })
  })
})
