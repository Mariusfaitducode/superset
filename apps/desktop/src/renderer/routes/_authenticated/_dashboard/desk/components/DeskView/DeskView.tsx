import { useLingui } from "@lingui/react/macro";
import { Kbd } from "@superset/ui/kbd";
import { useEffect, useRef, useState } from "react";
import { LuInbox } from "react-icons/lu";
import { PageHeader } from "renderer/routes/_authenticated/_dashboard/components/PageHeader";
import { ReportKindIcon } from "renderer/routes/_authenticated/_dashboard/components/ReportKindIcon";
import {
	DESK_GROUPS,
	type DeskGroup,
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
 * Everything agents handed over to the user, across workspaces, cleared
 * from the keyboard: j/k to move, 1-9 to pick an option, r to answer, a to
 * approve or mark reviewed, x to dismiss, Enter to open the conversation.
 */
export function DeskView() {
	const { t } = useLingui();
	const items = useDeskQueue();
	const titles = useConversationTitles(items);
	const actions = useDeskActions();
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const cards = useRef(new Map<string, DeskCardHandle>());

	const groupLabel: Record<DeskGroup, string> = {
		decision: t`Decisions`,
		draft: t`Drafts to approve`,
		blocked: t`Blocked`,
		done: t`Ready for review`,
		todo: t`Agents' to-dos for you`,
	};

	const selectedIndex = Math.max(
		0,
		items.findIndex((item) => item.key === selectedKey),
	);
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
						{t`Desk`}
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
						<Kbd>1-9</Kbd>
						{t`option`}
						<Kbd>R</Kbd>
						{t`answer`}
						<Kbd>A</Kbd>
						{t`approve`}
						<Kbd>X</Kbd>
						{t`dismiss`}
					</span>
				}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto">
				{items.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
						<LuInbox className="size-8" />
						<p className="text-sm">{t`Nothing waits on you.`}</p>
						<p className="max-w-sm text-center text-xs">
							{t`Agents put their hand-overs here with superset report: work to review, decisions, drafts to approve, blockers.`}
						</p>
					</div>
				) : (
					<div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-4">
						{DESK_GROUPS.map((group) => {
							const groupItems = items.filter((item) => item.group === group);
							if (groupItems.length === 0) return null;
							return (
								<section key={group} className="flex flex-col gap-2">
									<h2 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
										<ReportKindIcon kind={group} className="size-3.5" />
										{groupLabel[group]}
										<span className="tabular-nums">{groupItems.length}</span>
									</h2>
									{groupItems.map((item) => (
										<DeskCard
											key={item.key}
											ref={(handle) => {
												if (handle) cards.current.set(item.key, handle);
												else cards.current.delete(item.key);
											}}
											item={item}
											conversationTitle={titles.get(item.terminalId) ?? null}
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
