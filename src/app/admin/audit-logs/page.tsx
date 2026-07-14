import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AuditLogsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/resources");
  const logs = await prisma.auditLog.findMany({
    include: { user: true, resource: true },
    orderBy: { createdAt: "desc" },
    take: 250
  });
  return (
    <PageShell title="Audit Logs">
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Date</th><th>User</th><th>Action</th><th>Resource</th><th>Details</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-line">
                <td className="px-4 py-3">{formatDate(log.createdAt)}</td>
                <td>{log.user.name}</td>
                <td className="font-semibold">{log.action}</td>
                <td>{log.resource?.name ?? "-"}</td>
                <td className="max-w-md truncate font-mono text-xs">{log.details ? JSON.stringify(log.details) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
