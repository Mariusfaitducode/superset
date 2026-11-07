import { cn } from "@superset/ui/utils";
import type { IconType } from "react-icons";
import {
	LuCircleAlert,
	LuCircleCheck,
	LuGitPullRequest,
	LuHand,
	LuListChecks,
	LuMessageSquareDot,
	LuOctagonAlert,
	LuPenLine,
	LuSignpost,
} from "react-icons/lu";
import type { DeskKind } from "renderer/routes/_authenticated/_dashboard/hooks/useDeskQueue";

const ICONS: Record<DeskKind, { icon: IconType; className: string }> = {
	request: { icon: LuHand, className: "text-amber-500" },
	failed: { icon: LuCircleAlert, className: "text-red-500" },
	unseen: { icon: LuMessageSquareDot, className: "text-green-500" },
	decision: { icon: LuSignpost, className: "text-violet-500" },
	draft: { icon: LuPenLine, className: "text-sky-500" },
	blocked: { icon: LuOctagonAlert, className: "text-red-500" },
	done: { icon: LuCircleCheck, className: "text-green-500" },
	todo: { icon: LuListChecks, className: "text-muted-foreground" },
	pr: { icon: LuGitPullRequest, className: "text-muted-foreground" },
};

/** What a Desk item waits on, in the colors of the agent status dots. */
export function ReportKindIcon({
	kind,
	className,
}: {
	kind: DeskKind;
	className?: string;
}) {
	const { icon: Icon, className: color } = ICONS[kind];
	return <Icon aria-hidden className={cn("shrink-0", color, className)} />;
}
