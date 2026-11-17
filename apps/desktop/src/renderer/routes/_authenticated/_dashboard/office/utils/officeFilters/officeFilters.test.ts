import { describe, expect, test } from "bun:test";
import {
	type FilterableAgent,
	facetCounts,
	matchesOfficeFilter,
	type OfficeFilter,
} from "./officeFilters";

const none: OfficeFilter = {
	states: [],
	projects: [],
	projectStatuses: [],
	focusOnly: false,
};

const agents: FilterableAgent[] = [
	{
		state: "waiting",
		projectId: "a",
		projectStatus: "inProgress",
		focused: true,
	},
	{
		state: "working",
		projectId: "a",
		projectStatus: "inProgress",
		focused: false,
	},
	{ state: "done", projectId: "b", projectStatus: "done", focused: false },
	{ state: "todos", projectId: "other", projectStatus: "none", focused: true },
];

const shown = (filter: Partial<OfficeFilter>) =>
	agents
		.filter((agent) => matchesOfficeFilter(agent, { ...none, ...filter }))
		.map((agent) => agent.state);

describe("office filters", () => {
	test("no filter keeps everyone", () => {
		expect(shown({})).toHaveLength(4);
	});

	test("states are a union, facets intersect", () => {
		expect(shown({ states: ["waiting", "done"] })).toEqual(["waiting", "done"]);
		expect(shown({ states: ["waiting", "done"], projects: ["b"] })).toEqual([
			"done",
		]);
		expect(shown({ projectStatuses: ["inProgress"] })).toEqual([
			"waiting",
			"working",
		]);
		expect(shown({ focusOnly: true })).toEqual(["waiting", "todos"]);
	});

	test("a chip counts what it would add, given the other facets", () => {
		const counts = facetCounts(agents, {
			...none,
			states: ["waiting"],
			projects: ["a"],
		});
		// States ignore the state filter but keep the project one.
		expect(counts.states.waiting).toBe(1);
		expect(counts.states.working).toBe(1);
		expect(counts.states.done).toBe(0);
		// Projects ignore the project filter but keep the state one.
		expect(counts.projects.get("a")).toBe(1);
		expect(counts.projects.get("b")).toBeUndefined();
		expect(counts.projectStatuses.get("inProgress")).toBe(1);
	});
});
