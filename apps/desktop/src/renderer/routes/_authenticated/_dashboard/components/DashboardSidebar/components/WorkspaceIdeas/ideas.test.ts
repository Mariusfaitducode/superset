import { describe, expect, test } from "bun:test";
import {
	type IdeaStatus,
	parseIdeaLines,
	sortIdeas,
	type WorkspaceIdea,
} from "./ideas";

const idea = (id: string, status: IdeaStatus, createdAt: number) =>
	({ id, status, createdAt }) as WorkspaceIdea;

describe("parseIdeaLines", () => {
	test("makes one idea per line, without bullets or numbers", () => {
		expect(
			parseIdeaLines(
				"- Dark mode\r\n\n* Export CSV\n  1. Shortcuts\n2) Undo\n• Sync\n- [ ] Tags\n[x] Done one\nplain - with dash",
			),
		).toEqual([
			"Dark mode",
			"Export CSV",
			"Shortcuts",
			"Undo",
			"Sync",
			"Tags",
			"Done one",
			"plain - with dash",
		]);
	});

	test("keeps a number that is part of the idea", () => {
		expect(parseIdeaLines("3D preview\n2026 roadmap")).toEqual([
			"3D preview",
			"2026 roadmap",
		]);
	});
});

describe("sortIdeas", () => {
	test("puts open and kept ideas before closed ones, oldest first", () => {
		const sorted = sortIdeas([
			idea("done", "done", 1),
			idea("kept", "kept", 3),
			idea("open", "open", 2),
			idea("dropped", "dropped", 0),
		]);
		expect(sorted.map((item) => item.id)).toEqual([
			"open",
			"kept",
			"dropped",
			"done",
		]);
	});
});
