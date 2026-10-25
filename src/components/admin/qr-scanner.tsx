"use client";

import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { useCallback, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/components/ui";

interface Outcome {
  outcome: "checked_in" | "already_checked_in" | "pending_confirmation" | "confirmed" | "rejected";
  message: string;
  attendee?: { name: string; email: string } | null;
  checkedInAt?: string;
}

const COLORS: Record<Outcome["outcome"], string> = {
  checked_in: "var(--color-success)",
  confirmed: "var(--color-success)",
  already_checked_in: "var(--color-warning)",
  pending_confirmation: "var(--color-warning)",
  rejected: "var(--color-danger)",
};

/**
 * Staff scanner. It only forwards the raw QR payload; the server resolves the
 * pass, checks payment/event/revocation and records attendance atomically.
 */
export function QrCheckInScanner({ eventId }: { eventId: string }) {
  const [result, setResult] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const busy = useRef(false);
  const lastPayload = useRef<{ value: string; at: number } | null>(null);

  const submit = useCallback(
    async (payload: string) => {
      if (busy.current) return;
      const now = Date.now();
      if (lastPayload.current && lastPayload.current.value === payload && now - lastPayload.current.at < 4000) return;
      lastPayload.current = { value: payload, at: now };
      busy.current = true;
      setPaused(true);
      setError(null);
      try {
        setResult(await apiFetch<Outcome>("/api/v1/attendance/scan", { body: { eventId, payload } }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scan failed");
      } finally {
        busy.current = false;
        setTimeout(() => setPaused(false), 1500);
      }
    },
    [eventId],
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="overflow-hidden rounded-lg border border-[var(--color-line)]">
        <Scanner
          formats={["qr_code"]}
          paused={paused}
          onScan={(codes: IDetectedBarcode[]) => {
            const value = codes[0]?.rawValue;
            if (value) void submit(value);
          }}
          onError={() => setError("Camera unavailable. Allow camera access or use manual check-in from Registrations.")}
        />
      </div>
      <div className="space-y-3">
        {result ? (
          <div className="rounded-lg border-2 p-4" style={{ borderColor: COLORS[result.outcome] }}>
            <p className="text-2xl font-bold" style={{ color: COLORS[result.outcome] }}>{result.message}</p>
            {result.attendee ? (
              <p className="mt-2 text-sm">
                {result.attendee.name} <span className="muted">· {result.attendee.email}</span>
              </p>
            ) : null}
            {result.checkedInAt ? <p className="muted text-xs">Checked in {formatDateTime(result.checkedInAt)}</p> : null}
          </div>
        ) : (
          <p className="muted text-sm">Point the camera at an attendee&apos;s QR pass.</p>
        )}
        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get("payload");
            if (typeof v === "string" && v.trim()) void submit(v.trim());
          }}
        >
          <input className="input font-mono text-xs" name="payload" placeholder="Or paste QR payload" />
          <button className="btn btn-sm">Check</button>
        </form>
      </div>
    </div>
  );
}
