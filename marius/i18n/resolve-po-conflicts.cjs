// Resolves git merge conflicts in Lingui .po catalogs: keeps the entries of
// both sides, sorted like lingui.config's `orderBy: "message"`, so the file
// matches what `bun run check:i18n` extracts.
//
//   node marius/i18n/resolve-po-conflicts.cjs $(git diff --name-only --diff-filter=U -- '*.po')
const fs = require("node:fs");

const entryKey = (block) => {
	const lines = block.split("\n");
	const ctx = lines.find((l) => l.startsWith("msgctxt "));
	const i = lines.findIndex((l) => l.startsWith("msgid "));
	let id = JSON.parse(lines[i].slice("msgid ".length));
	for (let j = i + 1; j < lines.length && lines[j].startsWith('"'); j++) {
		id += JSON.parse(lines[j]);
	}
	return { id, key: `${ctx ?? ""}\u0000${id}` };
};

for (const file of process.argv.slice(2)) {
	const resolved = fs
		.readFileSync(file, "utf8")
		.replace(
			/<<<<<<< [^\n]*\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]*\n/g,
			(_, ours, theirs) => {
				// Both sides translated the same message differently: keep ours.
				if (!/^msgid /m.test(ours) && !/^msgid /m.test(theirs)) return ours;
				const entries = new Map();
				for (const block of `${ours}\n${theirs}`.split(/\n\s*\n/)) {
					const trimmed = block.trim();
					if (!trimmed) continue;
					const { id, key } = entryKey(trimmed);
					entries.set(key, { id, block: trimmed });
				}
				return `${[...entries.values()]
					.sort((a, b) => a.id.localeCompare(b.id))
					.map((e) => e.block)
					.join("\n\n")}\n`;
			},
		);
	if (/^(<<<<<<<|=======|>>>>>>>)/m.test(resolved)) {
		throw new Error(`conflict markers left in ${file}`);
	}
	fs.writeFileSync(file, resolved);
}
