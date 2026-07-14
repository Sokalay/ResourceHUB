"use client";

import { Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

const sourceTypes = ["EXTERNAL_LINK", "GOOGLE_DRIVE_LINK", "GITHUB_LINK", "HUGGINGFACE_LINK", "SERVER_PATH", "MANUAL"];

export function ExternalLinkForm({ resourceId }: { resourceId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <form
      className="grid gap-4 rounded-lg border border-line bg-white p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const form = new FormData(event.currentTarget);
        const response = await fetch(`/api/resources/${resourceId}/register-external-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType: form.get("sourceType"), sourceLocation: form.get("sourceLocation") })
        });
        if (!response.ok) {
          setError((await response.json()).error ?? "Could not register link");
          return;
        }
        event.currentTarget.reset();
        router.refresh();
      }}
    >
      <h2 className="text-lg font-bold">Register External Link</h2>
      <label>Source Type<select name="sourceType">{sourceTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Source Location<input name="sourceLocation" required /></label>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button className="inline-flex w-fit items-center gap-2 rounded-md border border-line px-4 py-2 font-semibold">
        <LinkIcon size={16} /> Register
      </button>
    </form>
  );
}
