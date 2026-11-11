"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewDomain, setCollegeStatus } from "@/app/actions/colleges";
import { useToast } from "@/components/Toast";

export function CollegeStatusButton({ collegeId, status, name }: { collegeId: string; status: "active" | "suspended"; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const next = status === "active" ? "suspended" : "active";
  return (
    <button
      className={`btn btn--sm ${status === "active" ? "btn--danger" : "btn--outline"}`}
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await setCollegeStatus(collegeId, next);
          if (!r.ok) toast(r.error, undefined, { type: "error" });
          else toast(next === "suspended" ? `${name} suspended` : `${name} reactivated`, next === "suspended" ? "It's read-only now." : undefined);
          router.refresh();
        })
      }
    >
      {status === "active" ? "Suspend" : "Reactivate"}
    </button>
  );
}

export function DomainReview({ domain }: { domain: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const act = (approve: boolean) =>
    start(async () => {
      const r = await reviewDomain(domain, approve);
      if (!r.ok) toast(r.error, undefined, { type: "error" });
      else toast(approve ? `@${domain} approved` : `@${domain} rejected`, approve ? "Its students join automatically." : undefined);
      router.refresh();
    });
  return (
    <div className="rep-actions">
      <button className="btn btn--outline" type="button" disabled={pending} onClick={() => act(false)}>Reject</button>
      <button className="btn btn--primary" type="button" disabled={pending} onClick={() => act(true)}>Approve</button>
    </div>
  );
}
