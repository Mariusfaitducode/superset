import { afterEach, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { DashboardSidebarWorkspaceLeadIndicator } from "./DashboardSidebarWorkspaceLeadIndicator";

afterEach(cleanup);

function renderLead(
	props: Partial<Parameters<typeof DashboardSidebarWorkspaceLeadIndicator>[0]>,
) {
	return render(
		<DashboardSidebarWorkspaceLeadIndicator
			agentState="idle"
			isCreatePending={false}
			pullRequestState={null}
			{...props}
		/>,
	).container;
}

const leadOf = (container: HTMLElement) =>
	container.querySelector("[data-lead]")?.getAttribute("data-lead");

test("agent state outranks the pull request", () => {
	const working = renderLead({
		agentState: "working",
		pullRequestState: "open",
	});
	expect(leadOf(working)).toBe("working");
	cleanup();

	const needsYou = renderLead({
		agentState: "needsYou",
		pullRequestState: "open",
	});
	expect(leadOf(needsYou)).toBe("needsYou");
	expect(
		needsYou.querySelector(".bg-\\[var\\(--sb-state-needsYou\\)\\]"),
	).not.toBeNull();
});

test("an idle row shows its pull request state, else a quiet dot", () => {
	expect(
		renderLead({ pullRequestState: "merged" }).querySelector(
			".text-purple-500",
		),
	).not.toBeNull();
	cleanup();

	const idle = renderLead({});
	expect(idle.querySelector("svg")).toBeNull();
	expect(leadOf(idle)).toBe("idle");
});

test("a dead or unborn sandbox outranks the agent and the PR", () => {
	const failed = renderLead({
		sandboxStatus: "failed",
		agentState: "working",
		pullRequestState: "open",
	});
	expect(leadOf(failed)).toBe("failed");
	cleanup();

	const provisioning = renderLead({
		sandboxStatus: "provisioning",
		pullRequestState: "open",
	});
	expect(leadOf(provisioning)).toBe("creating");
});
