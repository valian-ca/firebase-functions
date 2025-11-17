import { type ErrorEvent, firebaseIntegration, init, type NodeOptions } from '@sentry/node'

import { ErrorWithSentryCaptureContext } from './error-with-sentry-capture-context'

const processErrorWithSentryCaptureContext = (event: ErrorEvent, exception: unknown) => {
  if (exception instanceof ErrorWithSentryCaptureContext) {
    exception.beforeSend(event)
    if (exception.cause) {
      processErrorWithSentryCaptureContext(event, exception.cause)
    }
  }
}

export const initSentry = (options?: Omit<NodeOptions, 'beforeSend'>) => {
  init({
    integrations: (defaultIntegrations) => [...defaultIntegrations, firebaseIntegration()],
    ...options,
    beforeSend: (event, hint) => {
      processErrorWithSentryCaptureContext(event, hint.originalException)
      return event
    },
  })
}
