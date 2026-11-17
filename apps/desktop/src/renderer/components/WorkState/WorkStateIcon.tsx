import { cn } from "@superset/ui/utils";
import type { IconType } from "react-icons";
import {
	LuCircleAlert,
	LuCircleCheckBig,
	LuCircleHelp,
	LuCirclePause,
	LuListTodo,
	LuLoaderCircle,
	LuMessageCircleQuestion,
} from "react-icons/lu";
import {
	type WorkState,
	type WorkStateCause,
	workStateColorVar,
} from "renderer/lib/agent-state";

export const WORK_STATE_ICON: Record<WorkState, IconType> = {
	waiting: LuMessageCircleQuestion,
	check: LuCircleHelp,
	working: LuLoaderCircle,
	todos: LuListTodo,
	resume: LuCirclePause,
	done: LuCircleCheckBig,
};

/** A work state's icon in its color; an error shows as an alert. */
export function WorkStateIcon({
	state,
	cause,
	className,
}: {
	state: WorkState;
	cause?: WorkStateCause;
	className?: string;
}) {
	const Icon = cause === "error" ? LuCircleAlert : WORK_STATE_ICON[state];
	return (
		<Icon
			aria-hidden
			className={cn(
				"size-3.5 shrink-0",
				state === "working" &&
					"motion-safe:animate-spin [animation-duration:2.5s]",
				className,
			)}
			style={{ color: workStateColorVar({ state, cause: cause ?? "running" }) }}
		/>
	);
}
