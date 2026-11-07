import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";

const HEAD = "b".repeat(40);
const commits = [
	{
		hash: "c".repeat(40),
		parents: ["a".repeat(40)],
		authorName: "Ada",
		authorEmail: "ada@x.dev",
		authoredAt: 1_790_000_200,
		subject: "feature work",
		refs: ["refs/heads/feature"],
	},
	{
		hash: HEAD,
		parents: ["a".repeat(40)],
		authorName: "Ada",
		authorEmail: "ada@x.dev",
		authoredAt: 1_790_000_100,
		subject: "main work",
		refs: ["HEAD", "refs/heads/main"],
	},
	{
		hash: "a".repeat(40),
		parents: [],
		authorName: "Ada",
		authorEmail: "ada@x.dev",
		authoredAt: 1_790_000_000,
		subject: "first commit",
		refs: [],
	},
];
const commitQuery = mock(async ({ hash }: { hash: string }) => ({
	hash,
	parents: ["a".repeat(40)],
	authorName: "Ada",
	authorEmail: "ada@x.dev",
	authoredAt: 1_790_000_100,
	committerName: "Ada",
	committerEmail: "ada@x.dev",
	committedAt: 1_790_000_100,
	message: "main work\n\nThe body",
	files: [
		{ path: "src/app.ts", status: "modified", additions: 3, deletions: 1 },
	],
}));

const realClient = { ...(await import("renderer/lib/host-service-client")) };
mock.module("renderer/lib/host-service-client", () => ({
	...realClient,
	getHostServiceClientByUrl: () => ({
		gitGraph: {
			overview: {
				query: async () => ({
					repoPath: "/repo",
					headBranch: "main",
					refs: [],
					worktrees: [],
					uncommittedCount: 2,
				}),
			},
			log: {
				query: async () => ({ commits, hasMore: false, durationMs: 1 }),
			},
			commit: { query: commitQuery },
		},
	}),
}));
const realTargets = {
	...(await import(
		"renderer/routes/_authenticated/_dashboard/hooks/useProjectQueryTargets"
	)),
};
mock.module(
	"renderer/routes/_authenticated/_dashboard/hooks/useProjectQueryTargets",
	() => ({
		...realTargets,
		useProjectQueryTargets: () => ({
			isReady: true,
			projects: [],
			targets: [
				{
					projectId: "p1",
					projectName: "repo",
					hostId: "h",
					hostUrl: "http://h",
				},
			],
		}),
	}),
);
const realWorkspaces = {
	...(await import(
		"renderer/routes/_authenticated/providers/HostWorkspacesProvider"
	)),
};
const workspaces: never[] = [];
mock.module(
	"renderer/routes/_authenticated/providers/HostWorkspacesProvider",
	() => ({ ...realWorkspaces, useHostWorkspaces: () => ({ workspaces }) }),
);
const realConversations = {
	...(await import("renderer/hooks/useAgentConversations")),
};
const conversations: never[] = [];
mock.module("renderer/hooks/useAgentConversations", () => ({
	...realConversations,
	useAgentConversations: () => conversations,
}));
const realRouter = { ...(await import("@tanstack/react-router")) };
mock.module("@tanstack/react-router", () => ({
	...realRouter,
	useNavigate: () => () => {},
}));

// happy-dom has no layout; give the scroll area a size so rows render.
const sizes = ["offsetHeight", "offsetWidth"] as const;
const original = sizes.map((key) =>
	Object.getOwnPropertyDescriptor(HTMLElement.prototype, key),
);
for (const key of sizes) {
	Object.defineProperty(HTMLElement.prototype, key, {
		configurable: true,
		get: () => 800,
	});
}

const { render, cleanup, fireEvent, waitFor } = await import(
	"@testing-library/react"
);
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
);
const { electronTrpc } = await import("renderer/lib/electron-trpc");
const { GitGraphView } = await import("./GitGraphView");

afterEach(cleanup);
afterAll(() => {
	// mock.module outlives this file in bun's single process: put the real
	// exports back so later test files don't render against these stubs.
	mock.module("renderer/lib/host-service-client", () => realClient);
	mock.module(
		"renderer/routes/_authenticated/_dashboard/hooks/useProjectQueryTargets",
		() => realTargets,
	);
	mock.module(
		"renderer/routes/_authenticated/providers/HostWorkspacesProvider",
		() => realWorkspaces,
	);
	mock.module("renderer/hooks/useAgentConversations", () => realConversations);
	mock.module("@tanstack/react-router", () => realRouter);
	sizes.forEach((key, index) => {
		const descriptor = original[index];
		if (descriptor)
			Object.defineProperty(HTMLElement.prototype, key, descriptor);
	});
});

function renderView() {
	const queryClient = new QueryClient();
	return render(
		<electronTrpc.Provider
			client={electronTrpc.createClient({ links: [] })}
			queryClient={queryClient}
		>
			<QueryClientProvider client={queryClient}>
				<GitGraphView />
			</QueryClientProvider>
		</electronTrpc.Provider>,
	);
}

describe("GitGraphView", () => {
	test("fills its flex row: with @container it would otherwise be 0px wide", () => {
		const view = renderView();
		const root = view.container.firstElementChild as HTMLElement;
		expect(root.className).toContain("@container");
		expect(root.className.split(" ")).toEqual(
			expect.arrayContaining(["flex-1", "w-full"]),
		);
	});

	test("shows the history with the uncommitted changes on top", async () => {
		const view = renderView();
		await waitFor(() =>
			expect(view.container.textContent).toContain("Uncommitted Changes (2)"),
		);
		const text = view.container.textContent ?? "";
		expect(text.indexOf("Uncommitted Changes")).toBeLessThan(
			text.indexOf("feature work"),
		);
		expect(text).toContain("main work");
		expect(text).toContain("first commit");
	});

	test("opens a commit's details under it and moves with the arrow keys", async () => {
		const view = renderView();
		const row = await view.findByText("main work");
		fireEvent.click(row);
		await view.findByText(/The body/);
		expect(view.getByText("app.ts")).toBeTruthy();
		expect(commitQuery).toHaveBeenLastCalledWith({
			projectId: "p1",
			hash: HEAD,
		});

		fireEvent.keyDown(row, { key: "ArrowDown" });
		await waitFor(() =>
			expect(commitQuery).toHaveBeenLastCalledWith({
				projectId: "p1",
				hash: "a".repeat(40),
			}),
		);

		fireEvent.keyDown(row, { key: "Escape" });
		await waitFor(() => expect(view.queryByText(/files changed/)).toBeNull());
	});
});
