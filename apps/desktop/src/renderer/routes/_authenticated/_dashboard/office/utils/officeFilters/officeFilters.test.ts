import { describe, expect, test } from "bun:test";
import {
	type FilterableAgent,
	facetCounts,
	isFiltering,
	matchesOfficeFilter,
	type OfficeFilter,
	UNKNOWN_MODEL,
} from "./officeFilters";

const none: OfficeFilter = {
	states: [],
	projects: [],
	projectStatuses: [],
	focusOnly: false,
	hosts: [],
	models: [],
	withChildren: false,
};

const agents: FilterableAgent[] = [
	{
		state: "waiting",
		projectId: "a",
		projectStatus: "inProgress",
		focused: true,
		hostId: "mac",
		model: "Opus 5.5",
		children: 0,
	},
	{
		state: "working",
		projectId: "a",
		projectStatus: "inProgress",
		focused: false,
		hostId: "tour",
		model: "Sonnet 4.5",
		children: 2,
	},
	{
		state: "done",
		projectId: "b",
		projectStatus: "done",
		focused: false,
		hostId: "mac",
		model: UNKNOWN_MODEL,
		children: 0,
	},
	{
		state: "todos",
		projectId: "other",
		projectStatus: "none",
		focused: true,
		hostId: "tour",
		model: "Opus 5.5",
		children: 1,
	},
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

	test("the stats strip filters by host, model and running children", () => {
		expect(shown({ hosts: ["tour"] })).toEqual(["working", "todos"]);
		expect(shown({ models: ["Opus 5.5"] })).toEqual(["waiting", "todos"]);
		expect(shown({ models: [UNKNOWN_MODEL] })).toEqual(["done"]);
		expect(shown({ withChildren: true })).toEqual(["working", "todos"]);
		expect(shown({ hosts: ["tour"], states: ["todos"] })).toEqual(["todos"]);
		expect(isFiltering({ ...none, hosts: ["mac"] })).toBe(true);
		expect(isFiltering({ ...none, withChildren: true })).toBe(true);
		expect(isFiltering(none)).toBe(false);
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
