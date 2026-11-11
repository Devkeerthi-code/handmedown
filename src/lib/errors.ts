export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string> };

export const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string, fields?: Record<string, string>): ActionResult<never> => ({
  ok: false,
  error,
  fields,
});

const RATE_LIMIT_MESSAGES: Record<string, string> = {
  listings: "You've posted 15 listings today. Try again tomorrow.",
  messages: "You're sending messages very fast. Wait a minute and try again.",
  conversations: "You've started a lot of chats today. Try again tomorrow.",
  reports: "You've sent a lot of reports today. Our admins will get to them.",
  alerts: "You can keep up to 10 alerts. Delete one to add another.",
  colleges: "You've set up the limit of colleges for today. Try again tomorrow.",
  domains: "This college already has 5 domains waiting for approval.",
};

/** Collects the message from an error and its causes (Prisma driver adapters nest the Postgres error). */
function fullMessage(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    } else if (typeof current === "object") {
      parts.push(JSON.stringify(current));
      break;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(" | ");
}

/** Maps database failures to something a student can act on. Never leaks SQL. */
export function friendlyError(error: unknown): string {
  const msg = fullMessage(error);
  const rate = /RATE_LIMIT:(\w+)/.exec(msg);
  if (rate) return RATE_LIMIT_MESSAGES[rate[1]] ?? "Slow down a little and try again.";
  if (/CROSS_COLLEGE/.test(msg)) return "That belongs to a different college.";
  if (/CATEGORY_NOT_ENABLED/.test(msg)) return "This college doesn't use that category.";
  if (/UNKNOWN_PICKUP_SPOT/.test(msg)) return "Pick one of this college's meeting spots.";
  if (/row-level security|permission denied|42501|Only an admin|Only the platform admin/i.test(msg)) {
    return "You're not allowed to do that.";
  }
  if (/duplicate key|unique constraint|P2002/i.test(msg)) return "That's already been done.";
  if (/violates check constraint/i.test(msg)) return "Some details aren't valid. Check the form and try again.";
  if (/ECONNREFUSED|ETIMEDOUT|Can't reach database|timeout/i.test(msg)) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return "Something went wrong on our side. Please try again.";
}

export function isPermissionError(error: unknown) {
  return /row-level security|permission denied|42501/i.test(fullMessage(error));
}

export function logError(scope: string, error: unknown) {
  if (process.env.NODE_ENV !== "test") console.error(`[${scope}]`, fullMessage(error));
}
