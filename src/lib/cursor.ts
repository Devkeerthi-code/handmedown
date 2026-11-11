import { z } from "zod";

/** Keyset cursor: the sort value of the last row plus its id, so ties never skip or repeat rows. */
const cursorSchema = z.object({ v: z.union([z.string(), z.number()]), id: z.string().uuid() });
export type Cursor = z.infer<typeof cursorSchema>;

export function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
