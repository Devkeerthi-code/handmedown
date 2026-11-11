import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { allowedDomains } from "@/app/actions/auth";
import { CAMPUS } from "@/config/campus";
import { SignupForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage() {
  if (await getViewer()) redirect("/account");
  const domains = await allowedDomains().catch(() => []);
  return (
    <div className="container auth">
      <div className="auth__card">
        <div>
          <h1>Join HandMeDown</h1>
          <p className="lede">
            For {CAMPUS.name} students. Browse and chat with any email. Selling needs your college email, so buyers know
            you&apos;re from campus.
          </p>
        </div>
        <SignupForm domains={domains} />
        <p className="auth__switch">
          Already have an account?{" "}
          <Link className="link" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
