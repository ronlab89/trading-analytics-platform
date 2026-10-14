/**
 * Transport-free errors raised by use cases.
 * Source: ADR-001 point 3.
 *
 * They carry a message and nothing about HTTP: the API error handler maps
 * each kind to a status code and a wire error code. Domain validation
 * errors keep their own classes and are not wrapped here.
 *
 * Names must not start with `Invalid` or `Insufficient`: the HTTP error
 * handler classifies domain errors by that name pattern.
 */
export abstract class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The resource does not exist, or exists but is not the actor's (anti-enumeration). */
export class NotFoundError extends ApplicationError {}

/** The request is valid but conflicts with the current state of a resource. */
export class ConflictError extends ApplicationError {}

/** The actor is authenticated but lacks the permission for this use case. */
export class ForbiddenError extends ApplicationError {}

/** One problem found in a request, tied to the field that caused it. */
export interface FieldIssue {
  field: string;
  code: string;
  message: string;
}

/**
 * The request is well formed but a value in it is not acceptable for this
 * use case (for example a reference to a record that does not exist),
 * reported with one issue per offending field so the client can fix them
 * all in a single round trip.
 */
export class ValidationFailedError extends ApplicationError {
  constructor(
    message: string,
    readonly details: readonly FieldIssue[],
  ) {
    super(message);
  }
}
