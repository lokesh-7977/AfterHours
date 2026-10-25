import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { Hi } from "@/components/home/section-header";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return (
    <AuthCard scene="login" title="Welcome back" description={
        <>
          Log in to see the events you&apos;re <Hi tone="pink">into</Hi>, your <Hi tone="indigo">passes</Hi> and your <Hi tone="peacock">galleries</Hi>.
        </>
      }>
      <Suspense>
        <LoginForm mode="participant" />
      </Suspense>
    </AuthCard>
  );
}
