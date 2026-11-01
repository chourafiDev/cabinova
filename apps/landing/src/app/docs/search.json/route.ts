import { searchIndex } from "@/lib/docs";

export const dynamic = "force-static";

/** Loaded by the search box the first time it opens. */
export async function GET() {
	return Response.json(await searchIndex());
}
