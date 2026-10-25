import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { Hi } from "@/components/home/section-header";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function Page() {
  return (
    <AuthCard scene="reset" title="Choose a new password" description={
        <>
          Pick something <Hi tone="marigold">memorable</Hi>. All other sessions will be signed out.
        </>
      }>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
