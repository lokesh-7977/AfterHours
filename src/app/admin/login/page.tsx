import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Admin console" };

export default function Page() {
  return (
    <AuthCard scene="admin" title="Admin console" description="Organizer access only. Privileges are verified on the server for every action.">
      <Suspense>
        <LoginForm mode="admin" />
      </Suspense>
    </AuthCard>
  );
}
