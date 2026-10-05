
import { ZodError } from 'zod';

import { HttpError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  return res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'This address does not exist.',
      requestId: req.id ?? null,
    },
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const requestId = req.id ?? null;

  // If Express is already in the process of sending a response,
  // let Express finish/close it rather than trying to write again.
  if (res.headersSent) {
    return;
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Some of the information you entered is not valid.',
        fields: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
        requestId,
      },
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
        requestId,
      },
    });
  }

  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request is too large.',
        requestId,
      },
    });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: {
        code: 'BAD_JSON',
        message: 'The request could not be read.',
        requestId,
      },
    });
  }

  logger.error('unhandled_error', {
    requestId,
    path: req.path,
    method: req.method,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  return res.status(500).json({
    error: {
      code: 'INTERNAL',
      message:
        'Something went wrong on our side. Please try again in a moment.',
      requestId,
    },
  });
}
