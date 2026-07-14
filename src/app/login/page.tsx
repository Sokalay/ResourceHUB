import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/resources");
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Resource Hub</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to submit, store, and track official resources.</p>
        <LoginForm />
      </div>
    </div>
  );
}
