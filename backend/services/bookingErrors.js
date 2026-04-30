export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = 404;
  }
}

export class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnauthorizedError";
    this.statusCode = 401;
  }
}

export class ConflictError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ConflictError";
    this.statusCode = 409;
    this.details = details;
  }
}

export class BookingConflictError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "BookingConflictError";
    this.statusCode = 409;
    this.details = details;
  }
}
