import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import type { CSSProperties } from "react";
import { LuWorkflow } from "react-icons/lu";

/** A workflow run's name, phase and size, over its meeting table. */
export function OfficeWorkflowLabel({
	name,
	phase,
	agents,
	style,
}: {
	name: string | null;
	phase: string | null;
	agents: number;
	style: CSSProperties;
}) {
	const { t } = useLingui();
	const count = t({
		message: plural(agents, { one: "# agent", other: "# agents" }),
	});
	return (
		<div
			className="pointer-events-none absolute flex items-center gap-1 overflow-hidden px-1.5 font-mono text-[10px] leading-none text-[#1d1a24]"
			style={style}
		>
			<LuWorkflow className="size-3 shrink-0" aria-hidden />
			<span className="min-w-0 truncate font-bold">{name ?? t`Workflow`}</span>
			{phase && <span className="min-w-0 truncate opacity-70">· {phase}</span>}
			<span className="ml-auto shrink-0 opacity-70">{count}</span>
		</div>
	);
}
