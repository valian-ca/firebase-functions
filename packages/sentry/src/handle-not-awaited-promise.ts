import { captureException } from '@sentry/node'

export const handleNotAwaitedPromise = <T>(
  promise: Promise<T> | undefined,
  hint?: Parameters<typeof captureException>[1],
): void => {
  promise?.catch((error: unknown) => {
    captureException(error, hint)
  })
}
