import { Trans } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { LuRefreshCw, LuWorkflow } from "react-icons/lu";
import { PageHeader } from "renderer/routes/_authenticated/_dashboard/components/PageHeader";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import {
	buildThemeMessage,
	parseRelaisMessage,
	RELAIS_ORIGIN,
} from "../../utils/relais-bridge";

const INSTALL_COMMAND =
	"cp ~/CodeProjects/relais/com.marius.relais.plist ~/Library/LaunchAgents/ && launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.marius.relais.plist";

type Reachability = "checking" | "up" | "down";

async function isRelaisUp(): Promise<boolean> {
	try {
		// Opaque response: it only tells that something answered on the port.
		await fetch(`${RELAIS_ORIGIN}/api/state`, {
			mode: "no-cors",
			cache: "no-store",
		});
		return true;
	} catch {
		return false;
	}
}

export function RelaisView() {
	const navigate = useNavigate();
	const frameRef = useRef<HTMLIFrameElement>(null);
	const [reachability, setReachability] = useState<Reachability>("checking");

	const check = useCallback(async () => {
		setReachability("checking");
		setReachability((await isRelaisUp()) ? "up" : "down");
	}, []);

	useEffect(() => {
		void check();
	}, [check]);

	const postTheme = useCallback(() => {
		frameRef.current?.contentWindow?.postMessage(
			buildThemeMessage(document.documentElement),
			RELAIS_ORIGIN,
		);
	}, []);

	useEffect(() => {
		const observer = new MutationObserver(postTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style"],
		});
		return () => observer.disconnect();
	}, [postTheme]);

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			const request = parseRelaisMessage(
				event,
				frameRef.current?.contentWindow,
			);
			if (!request) return;
			if (request.type === "relais:ready") postTheme();
			else void navigateToV2Workspace(request.workspaceId, navigate);
		};
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [navigate, postTheme]);

	return (
		<div className="flex h-full w-full flex-1 flex-col overflow-hidden">
			<PageHeader />
			{reachability === "up" ? (
				<iframe
					ref={frameRef}
					src={`${RELAIS_ORIGIN}/`}
					title="Relais"
					onLoad={postTheme}
					className="min-h-0 w-full flex-1 border-0 bg-background"
				/>
			) : (
				<div className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 px-8 pt-16">
					<LuWorkflow className="size-6 text-muted-foreground" />
					<h1 className="font-semibold text-xl tracking-tight">
						<Trans>Local automations</Trans>
					</h1>
					{reachability === "checking" ? (
						<p className="text-muted-foreground text-sm">
							<Trans>Connecting to Relais…</Trans>
						</p>
					) : (
						<>
							<p className="text-muted-foreground text-sm">
								<Trans>
									Relais is not running on this Mac. Start it once and it comes
									back at every login:
								</Trans>
							</p>
							<code className="w-full select-all break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
								{INSTALL_COMMAND}
							</code>
							<Button variant="outline" size="sm" onClick={() => void check()}>
								<LuRefreshCw className="size-3.5" />
								<Trans>Retry</Trans>
							</Button>
						</>
					)}
				</div>
			)}
		</div>
	);
}
