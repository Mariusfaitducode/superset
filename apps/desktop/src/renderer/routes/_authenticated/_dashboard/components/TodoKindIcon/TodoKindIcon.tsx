import type { IconType } from "react-icons";
import {
	LuCalendarDays,
	LuCode,
	LuContact,
	LuGitPullRequest,
	LuMail,
	LuMegaphone,
	LuMessageSquare,
} from "react-icons/lu";

// Keyed by string: a newer host can send kinds this build does not know.
const TODO_KIND_ICONS: Partial<Record<string, IconType>> = {
	code: LuCode,
	message: LuMessageSquare,
	review: LuGitPullRequest,
	mail: LuMail,
	contact: LuContact,
	post: LuMegaphone,
	meeting: LuCalendarDays,
};

/** A to-do's kind as an icon, or nothing for `other` and unknown kinds. */
export function TodoKindIcon({
	kind,
	className,
}: {
	kind: string;
	className?: string;
}) {
	const Icon = TODO_KIND_ICONS[kind];
	return Icon ? <Icon aria-hidden className={className} /> : null;
}
