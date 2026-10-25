import { z } from "zod";
import { booleanish, optionalNumber, optionalTrimmed, optionalBlank } from "@/lib/validation";
import { paginationSchema } from "@/lib/pagination";
import { toMinor } from "@/lib/money";
import { EVENT_CATEGORIES } from "./event.constants";

const tagsSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.split(",") : v),
  z
    .array(z.string().trim().toLowerCase().max(30))
    .transform((tags) => Array.from(new Set(tags.filter(Boolean))))
    .pipe(z.array(z.string()).max(10, "At most 10 tags")),
);

const dateSchema = z.coerce.date({ message: "Invalid date" });

const eventFieldsSchema = z.object({
  title: z.string().trim().min(3).max(140),
  slug: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .trim()
      .toLowerCase()
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens")
      .optional(),
  ),
  summary: z.string().trim().min(10).max(300),
  description: z.string().trim().min(20).max(20000),
  category: z.enum(EVENT_CATEGORIES),
  tags: tagsSchema.default([]),
  venueName: z.string().trim().min(2).max(140),
  venueAddress: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(80),
  latitude: optionalNumber().pipe(z.number().min(-90).max(90).optional()),
  longitude: optionalNumber().pipe(z.number().min(-180).max(180).optional()),
  startsAt: dateSchema,
  endsAt: dateSchema,
  registrationOpensAt: dateSchema,
  registrationClosesAt: dateSchema,
  priceMinor: z.coerce.number().int("Price must be in whole minor units").min(0).max(100_000_000),
  currency: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code").default("INR"),
  ),
  capacity: z.coerce.number().int().min(1).max(100_000),
  paymentInstructions: optionalTrimmed(2000),
  posterMediaId: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable().optional()),
  requireStaffConfirmation: booleanish.default(false),
  allowCodeCheckIn: booleanish.default(true),
  galleryEnabled: booleanish.default(true),
  galleryUploadsEnabled: booleanish.default(true),
  galleryAutoApprove: booleanish.default(false),
  galleryMaxUploadsPerUser: z.coerce.number().int().min(0).max(1000).default(50),
});
/** Forms send `price` in major units; APIs may send `priceMinor` directly. */
function withPriceMinor(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const { price, ...rest } = raw as Record<string, unknown>;
  if (rest.priceMinor !== undefined || price === undefined || price === "") return rest;
  const currency = typeof rest.currency === "string" && /^[A-Za-z]{3}$/.test(rest.currency) ? rest.currency.toUpperCase() : "INR";
  return { ...rest, priceMinor: toMinor(price as string, currency) };
}

export const eventInputSchema = z.preprocess(withPriceMinor, eventFieldsSchema);
export type EventInput = z.infer<typeof eventFieldsSchema>;

export const cancelEventSchema = z.object({ reason: z.string().trim().min(3).max(1000) });

export const publicEventQuerySchema = paginationSchema.extend({
  q: optionalTrimmed(100),
  category: optionalBlank(z.enum(EVENT_CATEGORIES)),
  city: optionalTrimmed(80),
  from: optionalBlank(z.coerce.date()),
  to: optionalBlank(z.coerce.date()),
  when: z.enum(["upcoming", "past", "all"]).default("upcoming"),
  price: optionalBlank(z.enum(["free", "paid"])),
  sort: z.enum(["startsAt", "-startsAt", "popular"]).default("startsAt"),
});
export type PublicEventQuery = z.infer<typeof publicEventQuerySchema>;

export const adminEventQuerySchema = paginationSchema.extend({
  q: optionalTrimmed(100),
  status: optionalBlank(z.enum(["draft", "published", "cancelled", "completed"])),
  includeDeleted: booleanish.default(false),
});
export type AdminEventQuery = z.infer<typeof adminEventQuerySchema>;
