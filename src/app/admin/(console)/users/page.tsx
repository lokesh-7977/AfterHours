import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/page-guards";
import { listUsers } from "@/modules/users/user.service";
import { PageHeader, Pagination, StatusBadge, formatDateTime, spObject } from "@/components/ui";
import { RoleForm } from "@/components/admin/admin-actions";

export const metadata: Metadata = { title: "Users" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Super admins only: provisioning admins and changing privileges are high-risk actions. */
export default async function UsersPage({ searchParams }: Props) {
  const user = await requireAdminPage({ superAdmin: true });
  const q = spObject(await searchParams);
  const result = await listUsers(user, { page: q.page, q: q.q, role: q.role });
  return (
    <div>
      <PageHeader title="Users & roles" description="Promote a registered account to admin. Role changes sign the user out everywhere." />
      <form className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-64" name="q" placeholder="Search name or email" defaultValue={q.q} />
        <select className="input max-w-44" name="role" defaultValue={q.role ?? ""}>
          <option value="">All roles</option>
          <option value="participant">Participant</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super admin</option>
        </select>
        <button className="btn">Search</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Verified</th>
              <th>Joined</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((u) => (
              <tr key={u.id}>
                <td>{u.name}<div className="muted text-xs">{u.email}</div></td>
                <td><StatusBadge status={u.emailVerified ? "verified" : "pending"} plain /></td>
                <td className="whitespace-nowrap">{formatDateTime(u.createdAt)}</td>
                <td>{u.id === user.id ? <span className="muted text-xs">{u.role} (you)</span> : <RoleForm userId={u.id} role={u.role} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/admin/users" params={{ q: q.q, role: q.role }} />
    </div>
  );
}
