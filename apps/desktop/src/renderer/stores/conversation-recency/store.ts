import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const MAX_REMEMBERED = 50;

interface ConversationRecencyState {
	/** Terminal ids of conversations, most recently on screen first. */
	recent: string[];
	touch: (terminalId: string) => void;
}

export const useConversationRecencyStore = create<ConversationRecencyState>()(
	devtools(
		persist(
			(set) => ({
				recent: [],
				touch: (terminalId) =>
					set((state) =>
						state.recent[0] === terminalId
							? state
							: {
									recent: [
										terminalId,
										...state.recent.filter((id) => id !== terminalId),
									].slice(0, MAX_REMEMBERED),
								},
					),
			}),
			{
				name: "conversation-recency-v1",
				version: 1,
				partialize: ({ recent }) => ({ recent }),
			},
		),
		{ name: "ConversationRecency" },
	),
);
