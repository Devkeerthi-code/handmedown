import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <div className="container auth">
      <div className="auth__card">
        <div>
          <h1>Forgot your password?</h1>
          <p className="lede">Enter your email and we&apos;ll send a link to set a new one.</p>
        </div>
        <ForgotForm />
        <p className="auth__switch">
          <Link className="link" href="/login">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
