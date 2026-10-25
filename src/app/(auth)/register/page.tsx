import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { Hi } from "@/components/home/section-header";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create your account" };

export default function Page() {
  return (
    <AuthCard scene="register" title="Create your account" description={
        <>
          Join the <Hi tone="pink">Hyderabad</Hi> crew for <Hi tone="marigold">house parties</Hi>, <Hi tone="saffron">blind dates</Hi> and <Hi tone="indigo">DJ nights</Hi>.
        </>
      }>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
