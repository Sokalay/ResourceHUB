"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="mt-4 inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm hover:bg-panel"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      type="button"
    >
      <LogOut size={16} /> Logout
    </button>
  );
}
