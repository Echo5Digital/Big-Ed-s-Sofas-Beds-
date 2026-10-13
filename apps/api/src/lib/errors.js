class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super(404, message);
  }
}

class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(401, message);
  }
}

class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(403, message);
  }
}

class ConflictError extends ApiError {
  constructor(message = "Conflict", details) {
    super(409, message, details);
  }
}

class ValidationError extends ApiError {
  constructor(details) {
    super(422, "Validation failed", details);
  }
}

module.exports = {
  ApiError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
};
