export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export type FieldErrors = Record<string, string[] | undefined>;

/** An expected, user-safe error. Anything else is reported as INTERNAL_ERROR. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Machine-readable reason (e.g. "CAPACITY_FULL") for clients to branch on. */
  readonly reason?: string;
  readonly fieldErrors?: FieldErrors;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { reason?: string; fieldErrors?: FieldErrors; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.reason = opts.reason;
    this.fieldErrors = opts.fieldErrors;
    this.details = opts.details;
  }
}

export const errors = {
  badRequest: (message = "Invalid request", reason?: string) => new AppError("BAD_REQUEST", message, { reason }),
  validation: (fieldErrors: FieldErrors, message = "Invalid input") =>
    new AppError("VALIDATION_ERROR", message, { fieldErrors }),
  unauthenticated: (message = "Sign in required") => new AppError("UNAUTHENTICATED", message),
  forbidden: (message = "You do not have permission to do that") => new AppError("FORBIDDEN", message),
  notFound: (what = "Resource") => new AppError("NOT_FOUND", `${what} not found`),
  conflict: (message: string, reason?: string, details?: Record<string, unknown>) =>
    new AppError("CONFLICT", message, { reason, details }),
  tooLarge: (message = "Payload too large") => new AppError("PAYLOAD_TOO_LARGE", message),
  unsupportedType: (message = "Unsupported media type") => new AppError("UNSUPPORTED_MEDIA_TYPE", message),
  unprocessable: (message: string, reason?: string, fieldErrors?: FieldErrors) =>
    new AppError("UNPROCESSABLE", message, { reason, fieldErrors }),
  rateLimited: (message = "Too many requests, try again later") => new AppError("RATE_LIMITED", message),
  unavailable: (message: string) => new AppError("SERVICE_UNAVAILABLE", message),
};

export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    reason?: string;
    fieldErrors?: FieldErrors;
    details?: Record<string, unknown>;
  };
}

export function toErrorBody(err: AppError): ErrorBody {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.reason ? { reason: err.reason } : {}),
      ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
      ...(err.details ? { details: err.details } : {}),
    },
  };
}
