import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getMe } from "@/lib/auth";
import { getUnreadTotal } from "@/lib/chat/queries";
import { logError } from "@/lib/errors";

/** Header data. The header must still render if the database is briefly unreachable. */
export async function loadChrome() {
  try {
    const me = await getMe();
    const unread = me?.collegeId ? await getUnreadTotal(me) : 0;
    return { me, unread };
  } catch (error) {
    unstable_rethrow(error);
    logError("chrome", error);
    return { me: null, unread: 0 };
  }
}
