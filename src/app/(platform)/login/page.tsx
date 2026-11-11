import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer, safeNext } from "@/lib/auth";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  if (await getViewer()) redirect(next);
  return (
    <div className="container auth">
      <div className="auth__card">
        <div>
          <h1>Sign in</h1>
          <p className="lede">To chat with sellers, post listings and get alerts.</p>
        </div>
        <LoginForm next={next} linkError={sp.error === "link"} />
        <p className="auth__switch">
          New here?{" "}
          <Link className="link" href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
