import { Trans, useLingui } from "@lingui/react/macro";
import {
	ContextMenuCheckboxItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
} from "@superset/ui/context-menu";
import { toast } from "@superset/ui/sonner";
import { LuShieldCheck } from "react-icons/lu";
import { type GrantId, useHostGrants } from "./useHostGrants";

/** Context-menu entry to choose what the workspace's agents may do unasked. */
export function WorkspaceGrantsSubmenu({
	workspaceId,
	hostId,
}: {
	workspaceId: string;
	hostId: string;
}) {
	const { t } = useLingui();
	const { state, setGrants } = useHostGrants(hostId);
	if (!state) return null;
	const current = state.workspaces[workspaceId]?.grants ?? [];

	const grantLabel: Record<string, string> = {
		"push-own-branch": t`Push its own branch`,
		"open-draft-pr": t`Open a draft PR`,
		"mark-pr-ready": t`Mark its PR ready for review`,
		"reply-to-bots": t`Reply to review bots`,
		"post-github-comment": t`Post GitHub comments`,
		"slack-draft": t`Save Slack drafts`,
	};

	const toggle = (id: GrantId, checked: boolean) => {
		const next = checked
			? [...current, id]
			: current.filter((grant) => grant !== id);
		setGrants(workspaceId, next).catch(() =>
			toast.error(t`Could not change the agent permissions`),
		);
	};

	return (
		<ContextMenuSub>
			<ContextMenuSubTrigger>
				<LuShieldCheck className="size-4 mr-2" />
				<Trans>Agent permissions</Trans>
			</ContextMenuSubTrigger>
			<ContextMenuSubContent className="w-64">
				<ContextMenuLabel className="text-xs font-normal text-muted-foreground">
					<Trans>Agents here may, without asking:</Trans>
				</ContextMenuLabel>
				<ContextMenuSeparator />
				{state.available.map((grant) => (
					<ContextMenuCheckboxItem
						key={grant.id}
						checked={current.includes(grant.id)}
						onCheckedChange={(checked) => toggle(grant.id, checked === true)}
						onSelect={(event) => event.preventDefault()}
						title={grant.description}
					>
						{grantLabel[grant.id] ?? grant.id}
					</ContextMenuCheckboxItem>
				))}
			</ContextMenuSubContent>
		</ContextMenuSub>
	);
}
