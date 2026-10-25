import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParticipantPage } from "@/lib/page-guards";
import { AppError } from "@/lib/errors";
import { isUuidV7 } from "@/lib/ids";
import { getPassQrDataUrl } from "@/modules/passes/pass.service";
import { Alert, formatDateTime } from "@/components/ui";
import { PrintButton } from "@/components/participant/print-button";

export const metadata: Metadata = { title: "Event pass" };

type Props = { params: Promise<{ passId: string }> };

/** Printable pass. The QR is rendered only for the owner and only while the pass is valid. */
export default async function PassPage({ params }: Props) {
  const { passId } = await params;
  const user = await requireParticipantPage(`/my-passes/${passId}`);
  if (!isUuidV7(passId)) notFound();
  let result: Awaited<ReturnType<typeof getPassQrDataUrl>>;
  try {
    result = await getPassQrDataUrl(user, passId);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    if (err instanceof AppError) {
      return (
        <div className="container-page max-w-md py-16">
          <Alert tone="red">{err.message}</Alert>
          <Link href="/my-passes" className="link mt-4 inline-block text-sm">← Back to passes</Link>
        </div>
      );
    }
    throw err;
  }
  const { pass, qrDataUrl } = result;
  return (
    <div className="container-page flex justify-center py-10">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-line-strong)] bg-white p-6 text-center text-black print:border-0">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">AfterHours event pass</p>
        <h1 className="mt-2 text-xl font-bold">{pass.event?.title}</h1>
        <p className="text-sm text-neutral-600">{formatDateTime(pass.event?.startsAt)}</p>
        <p className="text-sm text-neutral-600">{pass.event?.venueName}, {pass.event?.city}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="Pass QR code" className="mx-auto my-4 h-64 w-64" />
        <p className="text-sm font-semibold">{user.name}</p>
        <p className="mt-1 text-xs text-neutral-500">Issued {formatDateTime(pass.issuedAt)} · Do not share this code</p>
        <div className="mt-4 flex justify-center gap-2 print:hidden">
          <PrintButton />
          <Link href="/my-passes" className="btn btn-sm">Back</Link>
        </div>
      </div>
    </div>
  );
}
