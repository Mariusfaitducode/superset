import { verifyQstashRequest } from "@/lib/verifyQstash";
import { purgeExpiredDeletions } from "./purgeExpiredDeletions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PATH = "/api/account/jobs/purge-expired-deletions";

export async function POST(request: Request): Promise<Response> {
	const body = await request.text();
	const rejected = await verifyQstashRequest(request, body, PATH);
	if (rejected) return rejected;

	return Response.json(await purgeExpiredDeletions({ now: Date.now }));
}
