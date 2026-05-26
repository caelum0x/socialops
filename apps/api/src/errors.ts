export class ApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function notFound(message = "not found"): ApiError {
  return new ApiError(404, message);
}

export function forbidden(message = "forbidden"): ApiError {
  return new ApiError(403, message);
}

export function badRequest(message = "bad request"): ApiError {
  return new ApiError(400, message);
}
