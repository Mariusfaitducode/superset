import { useLingui } from "@lingui/react/macro";
import { useEffect, useRef } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import type { TrackedTask } from "../../utils/task-monitor";
import { endedSince } from "../../utils/task-monitor";

/**
 * A macOS notification when a tracked task fails, always; when one ends
 * well, only if the app is in the background, since the button already
 * shows it otherwise. Clicking it opens the conversation.
 */
export function useTaskNotifications(byHost: Map<string, TrackedTask[]>) {
	const { t } = useLingui();
	const showNative = electronTrpc.notifications.showNative.useMutation();
	const seen = useRef(new Map<string, Map<string, TrackedTask["status"]>>());
	const notify = showNative.mutate;

	useEffect(() => {
		for (const [hostUrl, tasks] of byHost) {
			const previous = seen.current.get(hostUrl) ?? null;
			const ended = endedSince(previous, tasks);
			seen.current.set(
				hostUrl,
				new Map(tasks.map((task) => [task.id, task.status])),
			);
			const background = !document.hasFocus();
			for (const task of tasks) {
				const failed = ended.failed.includes(task.id);
				const done = ended.done.includes(task.id) && background;
				if (!failed && !done) continue;
				notify({
					title: failed
						? t`Task failed: ${task.title}`
						: t`Task done: ${task.title}`,
					body: (failed ? task.failReason : task.notes.at(-1)?.text) ?? "",
					clickTarget: {
						workspaceId: task.workspaceId,
						source: { type: "terminal", id: task.liveTerminalId },
					},
				});
			}
		}
	}, [byHost, notify, t]);
}
