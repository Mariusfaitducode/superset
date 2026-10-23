import { cn } from "@superset/ui/utils";
import type { IconType } from "react-icons";
import {
	LuCircleCheck,
	LuListChecks,
	LuOctagonAlert,
	LuPenLine,
	LuSignpost,
} from "react-icons/lu";
import type { DeskGroup } from "renderer/routes/_authenticated/_dashboard/hooks/useDeskQueue";

const ICONS: Record<DeskGroup, { icon: IconType; className: string }> = {
	decision: { icon: LuSignpost, className: "text-violet-500" },
	draft: { icon: LuPenLine, className: "text-sky-500" },
	blocked: { icon: LuOctagonAlert, className: "text-red-500" },
	done: { icon: LuCircleCheck, className: "text-green-500" },
	todo: { icon: LuListChecks, className: "text-muted-foreground" },
};

/** What a Desk item waits on, in the colors of the agent status dots. */
export function ReportKindIcon({
	kind,
	className,
}: {
	kind: DeskGroup;
	className?: string;
}) {
	const { icon: Icon, className: color } = ICONS[kind];
	return <Icon aria-hidden className={cn("shrink-0", color, className)} />;
}
