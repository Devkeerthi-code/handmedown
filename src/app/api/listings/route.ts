import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { decodeCursor } from "@/lib/cursor";
import { logError } from "@/lib/errors";
import { countListings, searchListings } from "@/lib/listings/queries";
import { parseSearchFilters } from "@/lib/validation";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * GET /api/listings?…filters&cursor=  -> next page for infinite scroll (opaque keyset cursor)
 * GET /api/listings?…filters&count=1  -> { total } for the filter sheet's live "Show N listings"
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const filters = parseSearchFilters(params);
  try {
    const viewer = await getViewer();
    if (params.count === "1") {
      return NextResponse.json({ total: await countListings(viewer, filters) }, { headers: NO_STORE });
    }
    const cursor = decodeCursor(params.cursor);
    if (params.cursor && !cursor) return NextResponse.json({ error: "Bad cursor" }, { status: 400 });
    const page = await searchListings(viewer, filters, cursor);
    return NextResponse.json(page, { headers: NO_STORE });
  } catch (error) {
    logError("api/listings", error);
    return NextResponse.json({ error: "Couldn't load listings." }, { status: 503, headers: NO_STORE });
  }
}
