import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { SignupForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage() {
  if (await getMe()) redirect("/account");
  return (
    <div className="container auth">
      <div className="auth__card">
        <div>
          <h1>Join HandMeDown</h1>
          <p className="lede">
            Sign up with your college email to join your college&apos;s marketplace. Any email works for browsing.
          </p>
        </div>
        <SignupForm />
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
