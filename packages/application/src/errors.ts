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
