import type { Metadata } from "next";
import { requireMe } from "@/lib/auth";
import { NewPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "New password" };

export default async function NewPasswordPage() {
  await requireMe("/account/password");
  return (
    <div className="container auth">
      <div className="auth__card">
        <div>
          <h1>Set a new password</h1>
          <p className="lede">You&apos;ll stay signed in on this device.</p>
        </div>
        <NewPasswordForm />
      </div>
    </div>
  );
}
