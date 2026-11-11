// Directories (repo-relative) that must contain no hardcoded user-facing JSX
// text — every string in them goes through Lingui. Add a directory here once
// it is fully converted. This list only grows; removing an entry is a
// regression, the same ratchet contract as the no-*-blocking tests.
export const ENFORCED_DIRS: readonly string[] = [
	"packages/panes/src/react/components/Workspace/components/TabBar/components/TabItem",
	"packages/i18n/src",
	"apps/web/src/app/account-pending-deletion",
	// automations is temporarily un-enforced: the trigger-fidelity work
	// rewrote most of its copy, and converting the new strings is deferred to
	// a dedicated i18n pass. Re-add once that lands.
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/components",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/hosts",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/new-workspace",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/pages",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/plugins",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/project",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/pull-requests",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/tasks",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/v2-workspaces",
	"apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal",
	"apps/desktop/src/renderer/routes/_authenticated/components/SetUpOverSshDialog",
	// settings — everything except `project/` ($projectId), the v1 counterpart
	// of v2-project that dies with the v1 sunset.
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/account",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/agents",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/api-keys",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/appearance",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/behavior",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/billing",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/browser",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/components",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/experimental",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/git",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/hooks",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/hosts",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/integrations",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/keyboard",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/links",
	// settings/models is absent, not un-enforced: the Models page and the
	// provider chain behind it were deleted, so the directory no longer exists.
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/members",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/organization",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/permissions",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/presets",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/projects",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/ringtones",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/security",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/team",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/teams",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/terminal",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/usage",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/utils",
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/settings/v2-project",
	// batch 3: v2-workspace, shared renderer components, palette, auth routes
	"apps/desktop/src/renderer/routes/_authenticated/_dashboard/v2-workspace",
	"apps/desktop/src/renderer/commandPalette",
	"apps/desktop/src/renderer/components",
	"apps/desktop/src/renderer/react-query",
	"apps/desktop/src/renderer/routes/create-organization",
	"apps/desktop/src/renderer/routes/sign-in",
	// batch 5: the Expo mobile app (routing, screens, shared components)
	"apps/mobile/app",
	"apps/mobile/screens",
	"apps/mobile/components",
	// batch 5: the shared composer package. `packages/ui/src` is converted too
	// but stays out: its `open-in-chat` provider logos carry brand names
	// ("GitHub", "OpenAI", …) as SVG <title> text, which the glossary keeps
	// untranslated and this scan cannot tell apart from prose.
	"packages/chat-ui/src",
	// batch 5: marketing routes that are fully converted. The component
	// directories stay out — their mockups deliberately render fake CLI output
	// and brand names, which the scanner cannot tell from real copy.
	"apps/marketing/src/app/[lang]/careers",
	"apps/marketing/src/app/[lang]/contact",
	"apps/marketing/src/app/[lang]/enterprise",
	"apps/marketing/src/app/[lang]/mcp-install",
	"apps/marketing/src/app/[lang]/pricing",
	"apps/marketing/src/app/[lang]/roadmap",
	"apps/marketing/src/app/[lang]/stats",
];
