export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const badRequest = (m, d) => new HttpError(400, 'BAD_REQUEST', m, d);
export const unauthorized = (m = 'Please sign in to continue.') => new HttpError(401, 'UNAUTHORIZED', m);
export const forbidden = (m = 'You do not have permission to do this.') => new HttpError(403, 'FORBIDDEN', m);
export const notFound = (m = 'We could not find what you were looking for.') => new HttpError(404, 'NOT_FOUND', m);
