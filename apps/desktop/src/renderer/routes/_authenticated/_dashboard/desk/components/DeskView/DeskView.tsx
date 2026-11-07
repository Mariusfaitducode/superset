import { useLingui } from "@lingui/react/macro";
import { Kbd } from "@superset/ui/kbd";
import { useEffect, useRef, useState } from "react";
import { LuInbox } from "react-icons/lu";
import { PageHeader } from "renderer/routes/_authenticated/_dashboard/components/PageHeader";
import {
	DESK_SECTIONS,
	type DeskSection,
	useDeskQueue,
} from "renderer/routes/_authenticated/_dashboard/hooks/useDeskQueue";
import { DeskCard, type DeskCardHandle } from "./components/DeskCard";
import { useConversationTitles } from "./hooks/useConversationTitles";
import { useDeskActions } from "./hooks/useDeskActions";

function isTyping(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable ||
			["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
	);
}

/**
 * Needs you: everything waiting on the user, in one list sorted by urgency
 * (agents stopped on them, reports, to-dos, PRs to review), cleared from the
 * keyboard: j/k to move, 1-9 to pick an option, r to answer, a for the
 * row's main action, x to dismiss, Enter to open.
 */
export function DeskView() {
	const { t } = useLingui();
	const items = useDeskQueue();
	const titles = useConversationTitles(items);
	const actions = useDeskActions();
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const cards = useRef(new Map<string, DeskCardHandle>());

	const pageTitle = t({ message: "Needs you", context: "desk page" });
	const sectionLabel: Record<DeskSection, string> = {
		now: t({ message: "Now", context: "desk section" }),
		next: t({ message: "Next", context: "desk section" }),
	};

	// When the selected row leaves the list, select the row now in its place.
	const lastIndex = useRef(0);
	const foundIndex = items.findIndex((item) => item.key === selectedKey);
	const selectedIndex =
		foundIndex >= 0
			? foundIndex
			: Math.min(lastIndex.current, Math.max(0, items.length - 1));
	lastIndex.current = selectedIndex;
	const selected = items[selectedIndex];

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isTyping(event.target) || !selected) return;
			const handle = cards.current.get(selected.key);
			const move = (by: number) => {
				const next = items[selectedIndex + by];
				if (next) setSelectedKey(next.key);
			};
			if (event.key === "j" || event.key === "ArrowDown") move(1);
			else if (event.key === "k" || event.key === "ArrowUp") move(-1);
			else if (event.key === "Enter") actions.open(selected);
			else if (event.key === "r") handle?.focusReply();
			else if (event.key === "a") handle?.primary();
			else if (event.key === "x") handle?.dismiss();
			else if (/^[1-9]$/.test(event.key)) {
				handle?.pickOption(Number(event.key) - 1);
			} else return;
			event.preventDefault();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [actions, items, selected, selectedIndex]);

	return (
		<div className="flex h-full w-full flex-1 flex-col overflow-hidden">
			<PageHeader
				start={
					<h1 className="text-sm font-medium">
						{pageTitle}
						{items.length > 0 && (
							<span className="ml-2 text-muted-foreground tabular-nums">
								{items.length}
							</span>
						)}
					</h1>
				}
				end={
					<span className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
						<Kbd>J</Kbd>
						<Kbd>K</Kbd>
						{t`move`}
						<Kbd>A</Kbd>
						{t`act`}
						<Kbd>R</Kbd>
						{t`answer`}
						<Kbd>1-9</Kbd>
						{t`option`}
						<Kbd>X</Kbd>
						{t`dismiss`}
						<Kbd>↵</Kbd>
						{t`open`}
					</span>
				}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto">
				{items.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
						<LuInbox className="size-8" />
						<p className="text-sm">{t`Nothing waits on you.`}</p>
						<p className="max-w-sm text-center text-xs">
							{t`Agents stopped on a question, their hand-overs (superset report), your to-dos and the PRs you were asked to review all land here.`}
						</p>
					</div>
				) : (
					<div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-4">
						{DESK_SECTIONS.map((section) => {
							const sectionItems = items.filter(
								(item) => item.section === section,
							);
							if (sectionItems.length === 0) return null;
							return (
								<section key={section} className="flex flex-col gap-1.5">
									<h2 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
										{sectionLabel[section]}
										<span className="tabular-nums">{sectionItems.length}</span>
									</h2>
									{sectionItems.map((item) => (
										<DeskCard
											key={item.key}
											ref={(handle) => {
												if (handle) cards.current.set(item.key, handle);
												else cards.current.delete(item.key);
											}}
											item={item}
											conversationTitle={
												item.source === "pr"
													? null
													: (titles.get(item.terminalId) ?? null)
											}
											selected={item.key === selected?.key}
											onSelect={() => setSelectedKey(item.key)}
											actions={actions}
										/>
									))}
								</section>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
