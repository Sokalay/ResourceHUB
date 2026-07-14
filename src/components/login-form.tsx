"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="mt-6 grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        const form = new FormData(event.currentTarget);
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
        });
        setLoading(false);
        if (!response.ok) {
          setError("Invalid email or password");
          return;
        }
        router.push("/dashboard");
        router.refresh();
      }}
    >
      <label>Email<input name="email" type="email" defaultValue="admin@resourcehub.local" required /></label>
      <label>Password<input name="password" type="password" defaultValue="admin123" required /></label>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button className="rounded-md bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
