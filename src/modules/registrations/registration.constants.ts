/** Client-safe registration/payment enums. */
export const REGISTRATION_STATUSES = ["registered", "cancelled", "refunded"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "submitted", "approved", "rejected", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["upi", "bank_transfer", "cash", "card_offline", "other", "free"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Methods a participant may declare (free is assigned by the system). */
export const SUBMITTABLE_PAYMENT_METHODS = ["upi", "bank_transfer", "cash", "card_offline", "other"] as const;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  upi: "UPI",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  card_offline: "Card (offline)",
  other: "Other",
  free: "Free event",
};
