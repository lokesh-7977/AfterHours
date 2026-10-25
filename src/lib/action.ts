import "server-only";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { FieldErrors } from "./errors";
import { toAppError } from "./http";

export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: { code: string; message: string; reason?: string; fieldErrors?: FieldErrors } };

/**
 * Standard Server Action envelope. Server Actions are public HTTP endpoints:
 * `fn` must authenticate, authorize and validate on its own (it calls the
 * same guarded services as the Route Handlers).
 */
export async function runAction<T>(
  fn: () => Promise<T>,
  opts: { revalidate?: string[]; message?: string } = {},
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    for (const path of opts.revalidate ?? []) revalidatePath(path);
    return { ok: true, data, message: opts.message };
  } catch (err) {
    unstable_rethrow(err); // let redirect()/notFound() propagate
    const appErr = toAppError(err);
    return {
      ok: false,
      error: { code: appErr.code, message: appErr.message, reason: appErr.reason, fieldErrors: appErr.fieldErrors },
    };
  }
}
