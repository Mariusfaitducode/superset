/**
 * Switches the simulator app to another account in a few seconds, with no
 * .env edit and no Metro restart: mints a session and a one-time token for the
 * user against this checkout's dev database, then opens
 * `superset://dev-sign-in?token=` on the simulator. The development build
 * signs out and redeems it (screens/RootLayout/components/DevSignInLinkHandler).
 *
 * Run through eas-signin.sh, which loads the root .env first.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { auth } from "@superset/auth/server";
import { db } from "@superset/db/client";
import {
	mintOneTimeToken,
	mintSessionForUser,
} from "../../../packages/auth/src/cloud-session";

const LOCAL_DATABASE_HOSTS = new Set([
	"localhost",
	"127.0.0.1",
	"::1",
	"db.localtest.me",
]);
const REDEEM_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 250;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sessionFile = join(mobileRoot, ".env.eas-simulator");

const secrets = new Set<string>();

function fail(message: string): never {
	let safe = message.split("\nparams:")[0] ?? "";
	for (const secret of secrets) safe = safe.replaceAll(secret, "<secret>");
	console.error(`eas-signin: ${safe}`);
	process.exit(1);
}

async function neonApi<T>(path: string): Promise<T> {
	const response = await fetch(`https://console.neon.tech/api/v2${path}`, {
		headers: { authorization: `Bearer ${process.env.NEON_API_KEY}` },
	});
	if (!response.ok) fail(`Neon API ${path} returned ${response.status}`);
	return (await response.json()) as T;
}

async function assertDevDatabase(): Promise<void> {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		fail("DATABASE_URL is not set. Run apps/mobile/scripts/eas-signin.sh.");
	}
	const host = new URL(databaseUrl).hostname;
	if (LOCAL_DATABASE_HOSTS.has(host)) return;

	const endpointId = /^(ep-[a-z0-9-]+?)(?:-pooler)?\./.exec(host)?.[1];
	const projectId = process.env.NEON_PROJECT_ID;
	if (!endpointId || !projectId || !process.env.NEON_API_KEY) {
		fail(
			"DATABASE_URL is neither local nor a Neon branch this script can check. Refusing.",
		);
	}
	const { endpoint } = await neonApi<{ endpoint: { branch_id: string } }>(
		`/projects/${projectId}/endpoints/${endpointId}`,
	);
	const { branch } = await neonApi<{
		branch: { name: string; default: boolean; protected: boolean };
	}>(`/projects/${projectId}/branches/${endpoint.branch_id}`);
	if (branch.default || branch.protected) {
		fail(
			`DATABASE_URL is Neon branch "${branch.name}", the default or a protected branch. Refusing.`,
		);
	}
}

function readSessionEnv(): Record<string, string> {
	if (!existsSync(sessionFile)) return {};
	const vars: Record<string, string> = {};
	for (const line of readFileSync(sessionFile, "utf8").split("\n")) {
		const match = /^([A-Z0-9_]+)='?(.*?)'?$/.exec(line.trim());
		if (match?.[1] && match[2] !== undefined) vars[match[1]] = match[2];
	}
	return vars;
}

function agentDevice(args: string[]): string | null {
	const result = spawnSync("agent-device", args, {
		cwd: mobileRoot,
		env: { ...process.env, ...readSessionEnv() },
		encoding: "utf8",
	});
	if (result.error) {
		return `could not run agent-device (${result.error.message}). Install it with "npm install -g agent-device".`;
	}
	if (result.status !== 0) {
		return `agent-device ${args[0]} failed:\n${result.stderr}${result.stdout}`;
	}
	return null;
}

async function waitForRedeem(identifier: string): Promise<boolean> {
	const { internalAdapter } = await auth.$context;
	const deadline = Date.now() + REDEEM_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (!(await internalAdapter.findVerificationValue(identifier))) return true;
		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}
	return false;
}

async function main(): Promise<void> {
	const who = process.argv[2];
	if (!who) fail("usage: apps/mobile/scripts/eas-signin.sh <email-or-user-id>");

	await assertDevDatabase();

	const user = await db.query.users.findFirst({
		where: (users, { eq }) =>
			UUID.test(who) ? eq(users.id, who) : eq(users.email, who),
		columns: { id: true, email: true, lastActiveOrganizationId: true },
	});
	if (!user) fail(`no user ${who} in this database`);

	const membership = await db.query.members.findFirst({
		where: (members, { eq }) => eq(members.userId, user.id),
		orderBy: (members, { asc }) => asc(members.createdAt),
		columns: { organizationId: true },
	});
	const session = await mintSessionForUser(
		user.id,
		user.lastActiveOrganizationId ?? membership?.organizationId,
	);
	if (!session) fail(`no user ${who} in this database`);
	secrets.add(session.token);
	const token = await mintOneTimeToken(auth, session);
	secrets.add(token);
	const identifier = `one-time-token:${token}`;

	const openError = agentDevice([
		"open",
		`superset://dev-sign-in?token=${token}`,
	]);
	const redeemed = !openError && (await waitForRedeem(identifier));
	// agent-device prints the last opened URL in every snapshot.
	agentDevice(["open", "superset://"]);

	if (redeemed) {
		console.log(`eas-signin: signed in as ${user.email}`);
		return;
	}
	const { internalAdapter } = await auth.$context;
	await internalAdapter.deleteVerificationByIdentifier(identifier);
	await internalAdapter.deleteSession(session.token);
	fail(
		openError ??
			`the app did not redeem the token in ${REDEEM_TIMEOUT_MS / 1000} s. Is a development build open and connected to Metro?`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((error: unknown) => {
		fail(error instanceof Error ? error.message : String(error));
	});
