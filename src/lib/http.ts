import "server-only";
import { NextResponse, connection, type NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { AppError, errors, isDuplicateKeyError, toErrorBody } from "./errors";
import { timingSafeEqual } from "node:crypto";
import { getTrustedOrigins } from "./env";
import { idSchema } from "./ids";
import { logger } from "./logger";
import { parseInput } from "./validation";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface RouteOptions {
  /**
   * Machine endpoints (cron) may authenticate with `Authorization: Bearer <secret>`.
   * Only a request carrying the valid bearer skips the cookie CSRF origin check.
   */
  bearerSecret?: () => string | undefined;
}

export function hasValidBearer(req: Request, secret: string | undefined): boolean {
  const header = req.headers.get("authorization");
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * CSRF defence for cookie-authenticated JSON APIs: browsers always send
 * Origin on non-GET fetches, so a cross-site request is rejected here.
 * Requests without Origin (non-browser clients) cannot carry a victim's
 * cookies cross-site and are allowed.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (req.headers.get("sec-fetch-site") === "cross-site") throw errors.forbidden("Cross-site request blocked");
  if (origin && !getTrustedOrigins().includes(origin)) throw errors.forbidden("Untrusted origin");
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (isDuplicateKeyError(err)) return errors.conflict("This record already exists", "DUPLICATE");
  logger.error("unhandled_error", { err });
  return new AppError("INTERNAL_ERROR", "Something went wrong");
}

export function errorResponse(err: unknown): NextResponse {
  const appErr = toAppError(err);
  return NextResponse.json(toErrorBody(appErr), { status: appErr.status, headers: { "Cache-Control": "no-store" } });
}

export function ok<T>(data: T, init: { status?: number; headers?: Record<string, string> } = {}): NextResponse {
  return NextResponse.json({ data }, { status: init.status ?? 200, headers: { "Cache-Control": "no-store", ...init.headers } });
}

type Handler<P> = (req: NextRequest, ctx: { params: P; bearer: boolean }) => Promise<Response>;

/** Wraps a Route Handler with origin checks and the consistent error shape. */
export function apiRoute<P extends Record<string, string> = Record<string, never>>(handler: Handler<P>, options: RouteOptions = {}) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    // API responses are per-request (auth, filters); never prerender them.
    await connection();
    try {
      const bearer = options.bearerSecret ? hasValidBearer(req, options.bearerSecret()) : false;
      if (!bearer && !SAFE_METHODS.has(req.method)) assertSameOrigin(req);
      const params = ctx?.params ? await ctx.params : ({} as P);
      return await handler(req, { params, bearer });
    } catch (err) {
      unstable_rethrow(err); // framework control flow (redirects, dynamic bail-outs) is not an app error
      return errorResponse(err);
    }
  };
}

/** Raw JSON body for services that validate their own input schema. */
export async function readBody(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    if (text.length > 1_000_000) throw errors.tooLarge();
    return text ? JSON.parse(text) : {};
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw errors.badRequest("Malformed JSON body");
  }
}

export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  return parseInput(schema, await readBody(req));
}

/** Query string as a plain object for services that parse their own input schema. */
export function queryObject(req: NextRequest): Record<string, string> {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}

export function readQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.output<S> {
  return parseInput(schema, queryObject(req));
}

/** Validate a UUID path segment (invalid ids are reported as not found). */
export function readId(value: string | undefined, what = "Resource"): string {
  if (!value || !idSchema.safeParse(value).success) throw errors.notFound(what);
  return value;
}
