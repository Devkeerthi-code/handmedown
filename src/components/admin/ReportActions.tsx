"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveReport } from "@/app/actions/reports";
import { useToast } from "@/components/Toast";

type Decision = "restore" | "remove" | "dismiss" | "ban";

const DONE: Record<Decision, string> = {
  restore: "Listing is visible again",
  remove: "Listing stays hidden",
  dismiss: "Report dismissed",
  ban: "Account banned from posting and messaging",
};

export function ReportActions({ reportId, isListing, canBan }: { reportId: string; isListing: boolean; canBan: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const act = (decision: Decision) =>
    start(async () => {
      const result = await resolveReport(reportId, decision);
      if (!result.ok) toast(result.error, undefined, { type: "error" });
      else toast(DONE[decision]);
      router.refresh();
    });

  return (
    <div className="rep-actions" aria-busy={pending}>
      {isListing ? (
        <>
          <button className="btn btn--outline" type="button" disabled={pending} onClick={() => act("restore")}>
            Restore
          </button>
          <button className="btn btn--primary" type="button" disabled={pending} onClick={() => act("remove")}>
            Keep hidden
          </button>
        </>
      ) : (
        <button className="btn btn--outline" type="button" disabled={pending} onClick={() => act("dismiss")}>
          Dismiss
        </button>
      )}
      {canBan ? (
        <button className="btn btn--danger" type="button" disabled={pending} onClick={() => act("ban")}>
          Ban user
        </button>
      ) : null}
    </div>
  );
}
