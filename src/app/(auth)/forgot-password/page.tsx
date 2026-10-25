import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { Hi } from "@/components/home/section-header";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return (
    <AuthCard scene="reset" title="Forgot password" description={
        <>
          No stress. We&apos;ll <Hi tone="peacock">email you a link</Hi> to set a new one.
        </>
      }>
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
