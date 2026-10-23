import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type {
	AgentResourcesSnapshot,
	AgentSessionView,
	ClosedSessionEntry,
} from "../../types";
import { AgentResourcesPanel } from "./AgentResourcesPanel";

const MB = 1024 ** 2;
const GB = 1024 ** 3;
const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-10-22T10:00:00Z");

function session(
	title: string,
	workspaceLabel: string,
	overrides: Partial<AgentSessionView>,
): AgentSessionView {
	return {
		pid: 1000,
		sessionId: `${title}-0000-0000`,
		cwd: `/Users/me/worktrees/${title}`,
		name: null,
		status: "idle",
		waitingFor: null,
		startedAt: NOW - 72 * HOUR,
		lastHumanAt: NOW - HOUR,
		cpu: 0.2,
		memory: 320 * MB,
		processCount: 4,
		terminalId: `term-${title}`,
		workspaceId: `ws-${title}`,
		title,
		workspaceLabel,
		...overrides,
	};
}

const SESSIONS: AgentSessionView[] = [
	session("Fix login redirect", "web / fix-login", {
		status: "busy",
		cpu: 38,
		memory: 1.2 * GB,
		processCount: 11,
		lastHumanAt: NOW - 4 * 60 * 1000,
	}),
	session("Release notes for 2.4", "api / release-2-4", {
		status: "waiting",
		waitingFor: "permission prompt",
		lastHumanAt: NOW - 25 * 60 * 1000,
		memory: 410 * MB,
	}),
	session("Migrate billing tables", "api / billing", {
		lastHumanAt: NOW - 3 * HOUR,
		memory: 520 * MB,
		processCount: 6,
	}),
	session("Flaky e2e on CI", "web / e2e-flake", {
		status: "shell",
		cpu: 92,
		lastHumanAt: NOW - 40 * 60 * 1000,
		memory: 880 * MB,
		processCount: 14,
	}),
	session("Onboarding copy review", "docs / onboarding", {
		lastHumanAt: NOW - 31 * HOUR,
		memory: 290 * MB,
	}),
	session("Spike: vector search", "api / spike-vectors", {
		lastHumanAt: NOW - 4 * 24 * HOUR,
		memory: 610 * MB,
		processCount: 7,
	}),
	session("Explore old logs", "infra / logs", {
		lastHumanAt: null,
		startedAt: NOW - 9 * 24 * HOUR,
		memory: 180 * MB,
		processCount: 2,
		terminalId: null,
		workspaceId: null,
		workspaceLabel: "logs",
	}),
];

const SNAPSHOT: AgentResourcesSnapshot = {
	machine: {
		totalMemory: 16 * GB,
		usedMemory: 14.8 * GB,
		swapTotal: 16 * GB,
		swapUsed: 13.9 * GB,
		pressure: "warn",
		loadAverage1m: 18.4,
		cpuCoreCount: 10,
		docker: { memoryLimit: 8 * GB, memoryUsed: 2.1 * GB },
	},
	sessions: SESSIONS,
	orphans: [
		{
			pid: 71603,
			name: "node",
			command: "node node_modules/.bin/vite --port 5173",
			cwd: "/Users/me/worktrees/web-redesign",
			startedAt: NOW - 2 * 24 * HOUR,
			cpu: 0.4,
			memory: 380 * MB,
			processCount: 3,
		},
		{
			pid: 68704,
			name: "chrome-headless-shell",
			command:
				"chrome-headless-shell --headless --remote-debugging-port=9222 --user-data-dir=/tmp/pw-profile",
			cwd: "/Users/me/worktrees/e2e-flake",
			startedAt: NOW - 6 * HOUR,
			cpu: 1.1,
			memory: 640 * MB,
			processCount: 8,
		},
	],
	collectedAt: NOW,
	collectMs: 74,
};

const CLOSED: ClosedSessionEntry[] = [
	{
		sessionId: "a1b2c3d4-0000",
		cwd: "/Users/me/worktrees/payments",
		title: "Stripe webhook retries",
		workspaceId: "ws-payments",
		closedAt: NOW - 20 * 60 * 1000,
		resumeCommand:
			"cd '/Users/me/worktrees/payments' && claude --resume a1b2c3d4-0000",
	},
	{
		sessionId: "e5f6a7b8-0000",
		cwd: "/Users/me/scratch",
		title: null,
		workspaceId: null,
		closedAt: NOW - 26 * HOUR,
		resumeCommand: "cd '/Users/me/scratch' && claude --resume e5f6a7b8-0000",
	},
];

const meta = {
	component: AgentResourcesPanel,
	decorators: [
		(Story) => (
			<div className="mx-auto max-w-5xl">
				<Story />
			</div>
		),
	],
	args: {
		snapshot: SNAPSHOT,
		sessions: SESSIONS,
		closedSessions: CLOSED,
		isClosing: false,
		killingPid: null,
		resumingSessionId: null,
		onCloseSessions: fn(),
		onOpenSession: fn(),
		onKillOrphan: fn(),
		onResume: fn(),
	},
} satisfies Meta<typeof AgentResourcesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Swap nearly full: the page says so first and offers the cleanup. */
export const MemoryTight: Story = {};

export const RoomForMore: Story = {
	args: {
		snapshot: {
			...SNAPSHOT,
			machine: {
				...SNAPSHOT.machine,
				usedMemory: 9.2 * GB,
				swapUsed: 1.1 * GB,
				pressure: "normal",
				loadAverage1m: 3.2,
				docker: { memoryLimit: 4 * GB, memoryUsed: null },
			},
			orphans: [],
		},
		sessions: SESSIONS.slice(0, 3),
		closedSessions: [],
	},
};

export const Critical: Story = {
	args: {
		snapshot: {
			...SNAPSHOT,
			machine: {
				...SNAPSHOT.machine,
				usedMemory: 15.7 * GB,
				swapUsed: 15.6 * GB,
				pressure: "critical",
				loadAverage1m: 41,
			},
		},
	},
};

export const NoAgents: Story = {
	args: {
		snapshot: { ...SNAPSHOT, sessions: [], orphans: [] },
		sessions: [],
		closedSessions: CLOSED,
	},
};
