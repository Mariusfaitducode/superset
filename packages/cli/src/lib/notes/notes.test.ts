import { describe, expect, test } from "bun:test";
import { type Note, noteWorkspace, resolveNoteId } from "./notes";

const note = (id: string) => ({ id }) as Note;

describe("notes CLI helpers", () => {
	test("defaults to the workspace it runs in, the flag wins", () => {
		const env = { SUPERSET_WORKSPACE_ID: "ws" };
		expect(noteWorkspace(undefined, env)).toBe("ws");
		expect(noteWorkspace("other", env)).toBe("other");
		expect(() => noteWorkspace(undefined, {})).toThrow();
	});

	test("resolves an unambiguous short id", () => {
		const notes = [note("abc123"), note("abd456")];
		expect(resolveNoteId("abc", notes)).toBe("abc123");
		expect(() => resolveNoteId("ab", notes)).toThrow(/Several/);
		expect(() => resolveNoteId("zz", notes)).toThrow(/not found/);
	});
});
