import { Trans, useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import { Skeleton } from "@superset/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@superset/ui/tabs";
import { useState } from "react";
import { LuRefreshCw } from "react-icons/lu";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { PageHeader } from "renderer/routes/_authenticated/_dashboard/components/PageHeader";
import { useLocalHostService } from "renderer/routes/_authenticated/providers/LocalHostServiceProvider/LocalHostServiceProvider";
import { InsightsDailyChart } from "./components/InsightsDailyChart";
import { InsightsProjects } from "./components/InsightsProjects";
import { InsightsSection } from "./components/InsightsSection";
import { InsightsTiles } from "./components/InsightsTiles";
import { InsightsWeekTable } from "./components/InsightsWeekTable";
import { RANGE_DAYS } from "./constants";
import { useHostInsights } from "./hooks/useHostInsights";

/** Is the Desk working? How the user drives their agents, week after week. */
export function InsightsView() {
	const { t } = useLingui();
	const { formatNumber } = useFormat();
	const { activeHostUrl } = useLocalHostService();
	const [days, setDays] = useState<number>(RANGE_DAYS[0]);
	const query = useHostInsights(activeHostUrl, days);
	const summary = query.data ?? null;

	return (
		<div className="flex h-full w-full flex-1 flex-col overflow-hidden">
			<PageHeader />
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 pt-4 pb-12">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<h1 className="text-lg font-semibold">
							<Trans>Insights</Trans>
						</h1>
						{query.isFetching && summary && (
							<output className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
								<LuRefreshCw className="size-3 animate-spin" aria-hidden />
								{summary.complete ? (
									<Trans>Reading new transcript lines…</Trans>
								) : (
									<Trans>
										First scan of your transcripts, numbers are partial…
									</Trans>
								)}
							</output>
						)}
						<Tabs
							className="ml-auto"
							value={String(days)}
							onValueChange={(value) => setDays(Number(value))}
						>
							<TabsList className="h-7">
								{RANGE_DAYS.map((option) => (
									<TabsTrigger
										key={option}
										value={String(option)}
										className="h-5 px-2 text-[11px]"
									>
										{t({ message: `${formatNumber(option / 7)} weeks` })}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</div>

					{!summary ? (
						query.isError ? (
							<p className="text-sm text-muted-foreground">
								{isMissingProcedureError(query.error) ? (
									<Trans>
										This host runs an older Superset. Update the app to see
										insights.
									</Trans>
								) : (
									<Trans>Couldn't read the transcripts on this host.</Trans>
								)}
							</p>
						) : (
							<div className="grid grid-cols-2 gap-2 md:grid-cols-4">
								{["a", "b", "c", "d"].map((key) => (
									<Skeleton key={key} className="h-[70px] w-full" />
								))}
							</div>
						)
					) : (
						<>
							<p className="text-[11px] text-muted-foreground">
								<Trans>
									From your Claude Code transcripts on this machine. Automations
									and prompts written by agents are left out.
								</Trans>
							</p>
							<InsightsTiles summary={summary} />
							<InsightsSection title={<Trans>Per day</Trans>}>
								<InsightsDailyChart summary={summary} />
							</InsightsSection>
							<InsightsSection title={<Trans>Per week</Trans>}>
								<InsightsWeekTable summary={summary} />
							</InsightsSection>
							{summary.projects.length > 0 && (
								<InsightsSection
									title={<Trans>Your messages per project</Trans>}
								>
									<InsightsProjects summary={summary} />
								</InsightsSection>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}
