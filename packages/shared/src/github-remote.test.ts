import { describe, expect, test } from "bun:test";
import { parseGitHubRemote } from "./github-remote";

const HUB = {
	provider: "github",
	owner: "spore-bio",
	name: "hub",
	url: "https://github.com/spore-bio/hub",
};

describe("parseGitHubRemote", () => {
	test.each([
		"git@github.com:spore-bio/hub.git",
		"ssh://git@github.com/spore-bio/hub.git",
		"https://github.com/spore-bio/hub.git",
		"https://github.com/spore-bio/hub",
		"https://github.com/spore-bio/hub/",
	])("parses %s", (url) => {
		expect(parseGitHubRemote(url)).toEqual(HUB);
	});

	test.each([
		"https://x-access-token:ghs_secret123@github.com/spore-bio/hub.git",
		"https://ghp_secret123@github.com/spore-bio/hub.git",
		"https://user:p%40ss@github.com/spore-bio/hub",
	])("parses a URL with credentials and drops them: %s", (url) => {
		const parsed = parseGitHubRemote(url);
		expect(parsed).toEqual(HUB);
		expect(JSON.stringify(parsed)).not.toContain("secret");
		expect(JSON.stringify(parsed)).not.toContain("@");
	});

	test.each([
		"https://gitlab.com/spore-bio/hub.git",
		"https://evil.com@github.com.evil.com/spore-bio/hub.git",
		"https://github.com@evil.com/spore-bio/hub.git",
		"/Users/marius/CodeProjects/hub",
	])("rejects %s", (url) => {
		expect(parseGitHubRemote(url)).toBeNull();
	});
});
