import type { Metadata } from "next";
import { requireParticipantPage } from "@/lib/page-guards";
import { Card, PageHeader } from "@/components/ui";
import { ProfileForm, SecurityPanel } from "@/components/participant/participant-forms";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireParticipantPage("/profile");
  return (
    <div className="container-page max-w-3xl py-10">
      <PageHeader title="Profile" description={user.email} />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Personal details</h2>
          <ProfileForm name={user.name} phone={user.phone} />
        </Card>
        <Card>
          <SecurityPanel />
        </Card>
      </div>
    </div>
  );
}
