import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { CATEGORIES } from "@/lib/catalog";
import { collegeForDomain } from "@/lib/college";
import { db } from "@/lib/db/client";
import { emailDomain, isPublicEmailDomain } from "@/lib/public-domains";
import { OnboardingForm, type OnboardingState } from "@/components/college/OnboardingForm";

export const metadata: Metadata = { title: "Bring HandMeDown to your college" };

/** Decides which onboarding step to show from the signed-in user's confirmed Auth email. */
async function onboardingState(): Promise<OnboardingState> {
  const viewer = await getViewer();
  if (!viewer) return { kind: "signed-out" };
  const [user] = await db.$queryRaw<{ email: string; confirmed: boolean }[]>`
    SELECT email, email_confirmed_at IS NOT NULL AS confirmed FROM auth.users WHERE id = ${viewer.id}::uuid`;
  const email = user?.email ?? viewer.email ?? "";
  if (!user?.confirmed) return { kind: "unverified", email };
  const domain = emailDomain(email);
  if (isPublicEmailDomain(domain)) return { kind: "public-domain", email, domain };
  const owner = await collegeForDomain(domain);
  if (owner) return { kind: "exists", domain, college: owner.college };
  return { kind: "ready", email, domain };
}

export default async function StartPage() {
  const state = await onboardingState();
  return (
    <div className="container page">
      <OnboardingForm
        state={state}
        categories={CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
        defaultCategories={CATEGORIES.map((c) => c.id)}
      />
    </div>
  );
}
