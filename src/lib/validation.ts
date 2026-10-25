import { z } from "zod";
import { errors } from "./errors";

/** Parse untrusted input or throw a VALIDATION_ERROR carrying field errors. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const flat = z.flattenError(result.error);
    const fieldErrors: Record<string, string[]> = { ...(flat.fieldErrors as Record<string, string[]>) };
    if (flat.formErrors.length) fieldErrors._form = flat.formErrors;
    throw errors.validation(fieldErrors);
  }
  return result.data;
}

/** Converts FormData to a plain object; repeated keys become arrays, files are ignored. */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (typeof value !== "string") continue;
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return out;
}

/** Form/query convention: an empty (or whitespace-only) string means "not provided". */
export const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** `schema`, optional, where "" counts as absent (filters, optional form fields). */
export const optionalBlank = <S extends z.ZodType>(schema: S) => z.preprocess(blankToUndefined, schema.optional());

export const optionalTrimmed = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

/** Optional number from a form field ("" means not provided). */
export const optionalNumber = () => z.preprocess(blankToUndefined, z.coerce.number().optional());

/**
 * Checkbox / "true" / "false" parsing for form and JSON inputs. A form may send
 * a hidden "false" followed by the checkbox's "true"; the last value wins.
 */
export const booleanish = z.preprocess((raw) => {
  const v = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "on" || v === "1") return true;
  if (v === "false" || v === "off" || v === "0" || v === undefined || v === "") return false;
  return v;
}, z.boolean());

/** Escape a string for safe use inside a RegExp built from user input. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
