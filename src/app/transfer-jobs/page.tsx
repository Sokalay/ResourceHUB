import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { visibleResourceWhere } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { humanizeEnum } from "@/lib/resource-metadata";

export default async function TransferJobsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const jobs = await prisma.transferJob.findMany({
    where: { resource: visibleResourceWhere(user) },
    include: { resource: true, createdBy: true },
    orderBy: { createdAt: "desc" }
  });
  return (
    <PageShell title="Storage Jobs">
      <p className="-mt-4 mb-6 text-sm text-slate-600">MVP storage review and transfer records. Automatic external pulling is not enabled yet.</p>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Resource</th><th>Source Type</th><th>Source</th><th>Destination</th><th>Status</th><th>Completed</th></tr></thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t border-line">
                <td className="px-4 py-3 font-semibold">{job.resource.name}</td>
                <td>{humanizeEnum(job.sourceType)}</td>
                <td className="max-w-xs truncate">{job.sourceLocation}</td>
                <td className="max-w-xs truncate">{job.destinationLocation ?? "-"}</td>
                <td>{humanizeEnum(job.status)}</td>
                <td>{formatDate(job.completedAt)}</td>
              </tr>
            ))}
            {!jobs.length && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={6}>No transfer jobs.</td></tr>}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
