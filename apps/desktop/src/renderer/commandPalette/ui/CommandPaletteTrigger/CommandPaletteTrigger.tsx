import { useHotkey } from "renderer/hotkeys";
import { useCommandContext } from "../../core/ContextProvider";
import { useFrameStackStore } from "../../core/frames";
import { useCheckResourcesHotkey } from "../../hooks/useCheckResourcesHotkey";
import { conversationSwitcherCommand } from "../../modules/navigation/commands";

export function CommandPaletteTrigger() {
	const setOpen = useFrameStackStore((s) => s.setOpen);
	const reset = useFrameStackStore((s) => s.reset);
	const pushFrame = useFrameStackStore((s) => s.pushFrame);
	const context = useCommandContext();
	useHotkey("OPEN_COMMAND_PALETTE", () => setOpen(true));
	useHotkey("OPEN_CONVERSATION_SWITCHER", () => {
		if (!conversationSwitcherCommand.when?.(context)) return;
		reset();
		pushFrame(conversationSwitcherCommand);
		setOpen(true);
	});

	useCheckResourcesHotkey(() => {
		setOpen(false);
		reset();
	});

	return null;
}
