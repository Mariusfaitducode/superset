import { describe, expect, test } from "bun:test";
import { formatReplyTime } from "./formatReplyTime";

describe("formatReplyTime", () => {
	test("uses minutes under an hour and hours above", () => {
		expect(formatReplyTime(null)).toBe("–");
		expect(formatReplyTime(330)).toBe("5.5m");
		expect(formatReplyTime(5400)).toBe("1.5h");
	});
});
