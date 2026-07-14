import Link from "next/link";
import { BarChart3, Boxes, ClipboardCheck, Database, FolderKanban, Layers3, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { humanizeEnum } from "@/lib/resource-metadata";

export async function Nav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const mainLinks = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/resources", label: "Resources", icon: Database },
    ...(user.role === "ADMIN" || user.role === "CONTRIBUTOR" ? [{ href: "/resources/new", label: "Submit Resource", icon: ClipboardCheck }] : []),
    { href: "/transfer-jobs", label: "Storage Jobs", icon: Boxes },
    { href: "/teams", label: "Teams", icon: UsersRound }
  ];
  const adminLinks = [
    { href: "/categories", label: "Categories", icon: Layers3 },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: ShieldCheck }
  ];
  const mobileLinks = mainLinks.slice(0, 4);
  return (
    <>
    <div className="border-b border-line bg-white px-4 py-3 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-slate-950">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">RH</span>
          Resource Hub
        </Link>
        <div className="text-xs font-semibold text-slate-500">{humanizeEnum(user.role)}</div>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm font-semibold">
        {mobileLinks.map((item) => (
          <Link className="shrink-0 rounded-md border border-line px-3 py-2" href={item.href} key={item.href}>{item.label}</Link>
        ))}
      </div>
    </div>
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-line bg-white px-4 py-5 md:block">
      <Link href="/dashboard" className="flex items-center gap-3 rounded-md px-2 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">RH</span>
        <span>
          <span className="block text-lg font-bold tracking-normal text-slate-950">Resource Hub</span>
          <span className="block text-xs font-semibold text-slate-500">{humanizeEnum(user.role)}</span>
        </span>
      </Link>
      <nav className="mt-6 grid gap-6 text-sm font-medium">
        <div>
          <div className="muted-label px-3">Workspace</div>
          <div className="mt-2 grid gap-1">
            {mainLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-950" href={item.href} key={item.href}>
                  <Icon aria-hidden="true" className="h-4 w-4 text-slate-500" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        {user.role === "ADMIN" && (
          <div>
            <div className="muted-label px-3">Admin</div>
            <div className="mt-2 grid gap-1">
              {adminLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-950" href={item.href} key={item.href}>
                    <Icon aria-hidden="true" className="h-4 w-4 text-slate-500" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>
      <div className="absolute bottom-5 left-4 right-4 rounded-md border border-line bg-slate-50 p-3 text-sm">
        <div className="font-semibold">{user.name}</div>
        <div className="mt-1 break-all text-xs text-slate-500">{user.email}</div>
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
          <Settings2 aria-hidden="true" className="h-3.5 w-3.5" />
          Session
        </div>
        <LogoutButton />
      </div>
    </aside>
    </>
  );
}
