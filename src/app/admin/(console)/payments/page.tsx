import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/page-guards";
import { listRegistrations } from "@/modules/registrations/registration.service";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/modules/registrations/registration.constants";
import { Card, EmptyState, PageHeader, Pagination, StatusBadge, formatDateTime, spObject } from "@/components/ui";
import { PaymentDecision } from "@/components/admin/admin-actions";

export const metadata: Metadata = { title: "Payment verification" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TABS = [
  ["submitted", "Awaiting verification"],
  ["pending", "Not yet submitted"],
  ["rejected", "Rejected"],
  ["approved", "Approved"],
] as const;

export default async function PaymentsPage({ searchParams }: Props) {
  const user = await requireAdminPage();
  const q = spObject(await searchParams);
  const status = TABS.some(([t]) => t === q.status) ? q.status : "submitted";
  const result = await listRegistrations(user, { page: q.page, paymentStatus: status, status: "registered", pageSize: 20 });

  return (
    <div>
      <PageHeader title="Payment verification" description="Check each reference against your bank/UPI statement. A screenshot is evidence, not proof." />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([t, label]) => (
          <Link key={t} href={`/admin/payments?status=${t}`} className={`btn btn-sm ${status === t ? "btn-primary" : ""}`}>{label}</Link>
        ))}
      </div>
      {result.items.length === 0 ? (
        <EmptyState title="Nothing here" />
      ) : (
        <div className="space-y-3">
          {result.items.map((r) => (
            <Card key={r.id} className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.user?.name}</span>
                  <span className="muted">{r.user?.email}</span>
                  <StatusBadge status={r.paymentStatus} />
                </div>
                <p>{r.eventTitle} · <strong>{formatMoney(r.amountMinor, r.currency)}</strong></p>
                <p className="muted">
                  {r.paymentMethod ? PAYMENT_METHOD_LABELS[r.paymentMethod] : "No method"} · Ref <span className="font-mono">{r.paymentReference ?? "—"}</span> · submitted {formatDateTime(r.paymentSubmittedAt)}
                </p>
                {r.paymentNote ? <p className="prose-text text-xs">“{r.paymentNote}”</p> : null}
                {r.rejectionReason ? <p className="text-xs text-[var(--color-danger)]">Rejected: {r.rejectionReason}</p> : null}
                {r.paymentProofUrl ? (
                  <a href={r.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.paymentProofUrl} alt="Payment proof" className="mt-2 max-h-48 rounded border border-[var(--color-line)]" />
                  </a>
                ) : null}
              </div>
              <div className="md:w-96">
                <PaymentDecision registrationId={r.id} paymentStatus={r.paymentStatus} status={r.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/admin/payments" params={{ status }} />
    </div>
  );
}
