import { v7 as uuidv7, validate, version } from "uuid";
import { z } from "zod";

/** The single source of application entity identifiers (UUID v7, time-ordered). */
export function newId(): string {
  return uuidv7();
}

export function isUuidV7(value: string): boolean {
  return validate(value) && version(value) === 7;
}

/** Accepts any RFC 9562 UUID (Better Auth users and app entities are both v7). */
export const idSchema = z.uuid({ message: "Invalid identifier" });
