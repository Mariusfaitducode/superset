import { useEffect } from "react";
import { buildAppearanceVars } from "./appearance";
import { useSidebarPreferencesStore } from "./store";

/** Writes the sidebar's CSS variables on the document, so every state dot follows them. */
export function useApplySidebarAppearance() {
	useEffect(() => {
		const apply = (
			state: ReturnType<typeof useSidebarPreferencesStore.getState>,
		) => {
			const root = document.documentElement;
			for (const [name, value] of Object.entries(buildAppearanceVars(state))) {
				root.style.setProperty(name, value);
			}
		};
		apply(useSidebarPreferencesStore.getState());
		return useSidebarPreferencesStore.subscribe(apply);
	}, []);
}
