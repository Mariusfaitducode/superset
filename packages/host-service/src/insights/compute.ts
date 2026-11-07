import {
	attributeCwd,
	type CwdLabel,
} from "../trpc/router/usage/history/aggregate";
import { type InsightEvent, MESSAGE_FLAGS } from "./classify";
import type { TranscriptCache } from "./scan";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const SLOT_MS = 10 * MINUTE_MS;
/** Past this, a session that stopped is no longer waiting on anyone. */
const WAIT_LIMIT_MS = 3 * HOUR_MS;
/** A longer gap is a night or a break, not a reply time. */
const REPLY_LIMIT_MS = 4 * HOUR_MS;
const DAYTIME_START_HOUR = 8;
const DAYTIME_END_HOUR = 20;
/** Sessions run headless by automations; nobody types in them. */
const AUTOMATION_ENTRYPOINT = "sdk-cli";

const ACTIVITY_KINDS = new Set<InsightEvent[1]>([
	"assistant",
	"stop",
	"human",
	"interrupt",
	"tool_result",
]);

export interface InsightsDay {
	/** Local calendar day, `YYYY-MM-DD`. */
	day: string;
	workingDay: boolean;
	messages: number;
	goAheads: number;
	statusChecks: number;
	corrections: number;
	pasted: number;
	/** Replies in daytime (8h–20h) after a gap under 4 h. */
	replies: number;
	replyMedianSec: number | null;
	liveSessions: number;
	meanWorking: number | null;
	peakWorking: number;
	meanWaiting: number | null;
	peakWaiting: number;
}

export interface InsightsWeek {
	/** Monday of the week, `YYYY-MM-DD`. */
	weekStart: string;
	workingDays: number;
	messages: number;
	messagesPerWorkingDay: number | null;
	replies: number;
	replyMedianSec: number | null;
	goAheadShare: number | null;
	statusCheckShare: number | null;
	correctionShare: number | null;
	pastedShare: number | null;
	liveSessionsPerWorkingDay: number | null;
	meanWorking: number | null;
	peakWorking: number;
	meanWaiting: number | null;
	peakWaiting: number;
}

export interface InsightsProject {
	name: string;
	messages: number;
	share: number;
}

/** Filled by the Desk once agent reports exist on this host. */
export interface DeskInsights {
	reportsPerDay: number;
	medianWaitSec: number | null;
	answeredPerBatch: number | null;
}

export interface InsightsSummary {
	generatedAt: number;
	timeZone: string;
	/** False while the first scan of a large transcript tree is still catching up. */
	complete: boolean;
	from: string;
	to: string;
	days: InsightsDay[];
	weeks: InsightsWeek[];
	projects: InsightsProject[];
	totals: { messages: number; sessions: number; duplicatesDropped: number };
	desk: DeskInsights | null;
}

export interface ComputeOptions {
	days: number;
	timeZone: string;
	nowMs: number;
	cwdLabels?: CwdLabel[];
	complete?: boolean;
}

interface LocalTime {
	localMs: number;
	day: string;
	hour: number;
	weekday: number;
	slot: number;
}

/** Local wall-clock reads for one time zone, with the zone offset looked up once per UTC hour. */
function localClock(timeZone: string): (ms: number) => LocalTime {
	const format = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	const offsets = new Map<number, number>();
	const offsetAt = (ms: number): number => {
		const hourStart = Math.floor(ms / HOUR_MS) * HOUR_MS;
		let offset = offsets.get(hourStart);
		if (offset === undefined) {
			const parts: Record<string, number> = {};
			for (const part of format.formatToParts(hourStart)) {
				if (part.type !== "literal") parts[part.type] = Number(part.value);
			}
			const wallAsUtc = Date.UTC(
				parts.year ?? 1970,
				(parts.month ?? 1) - 1,
				parts.day ?? 1,
				parts.hour ?? 0,
				parts.minute ?? 0,
				parts.second ?? 0,
			);
			offset = wallAsUtc - hourStart;
			offsets.set(hourStart, offset);
		}
		return offset;
	};
	return (ms) => {
		const local = ms + offsetAt(ms);
		const date = new Date(local);
		return {
			localMs: local,
			day: date.toISOString().slice(0, 10),
			hour: date.getUTCHours(),
			weekday: date.getUTCDay(),
			slot: Math.floor(local / SLOT_MS),
		};
	};
}

function isWorkingWeekday(weekday: number): boolean {
	return weekday >= 1 && weekday <= 5;
}

function shiftDay(day: string, deltaDays: number): string {
	return new Date(Date.parse(`${day}T00:00:00Z`) + deltaDays * DAY_MS)
		.toISOString()
		.slice(0, 10);
}

function weekdayOf(day: string): number {
	return new Date(`${day}T00:00:00Z`).getUTCDay();
}

function mondayOf(day: string): string {
	return shiftDay(day, -((weekdayOf(day) + 6) % 7));
}

/** Upper median, like the analysis scripts, so the numbers line up with theirs. */
export function median(values: number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function mean(sum: number, count: number): number | null {
	return count > 0 ? sum / count : null;
}

interface Session {
	id: string;
	events: InsightEvent[];
	entrypoint: string | null;
	cwdCounts: Map<string, number>;
	size: number;
}

function eventKey(event: InsightEvent): string {
	return `${event[0]}|${event[1]}|${event[2] ?? ""}|${event[3] ?? ""}`;
}

/**
 * Resumed sessions copy earlier events into a new file. Each copy goes to
 * the session holding the most events, so it is counted once.
 */
function collectSessions(cache: TranscriptCache): {
	sessions: Session[];
	duplicatesDropped: number;
} {
	const byId = new Map<string, Session>();
	for (const entry of Object.values(cache.files)) {
		let session = byId.get(entry.sessionId);
		if (!session) {
			session = {
				id: entry.sessionId,
				events: [],
				entrypoint: entry.entrypoint,
				cwdCounts: new Map(),
				size: 0,
			};
			byId.set(entry.sessionId, session);
		}
		session.entrypoint ??= entry.entrypoint;
		session.size += entry.events.length;
		for (const [cwd, count] of Object.entries(entry.cwdCounts)) {
			session.cwdCounts.set(cwd, (session.cwdCounts.get(cwd) ?? 0) + count);
		}
	}

	const owner = new Map<string, Session>();
	for (const entry of Object.values(cache.files)) {
		const session = byId.get(entry.sessionId);
		if (!session) continue;
		for (const event of entry.events) {
			const key = eventKey(event);
			const current = owner.get(key);
			if (!current || session.size > current.size) owner.set(key, session);
		}
	}

	let duplicatesDropped = 0;
	for (const entry of Object.values(cache.files)) {
		const session = byId.get(entry.sessionId);
		if (!session) continue;
		for (const event of entry.events) {
			if (owner.get(eventKey(event)) !== session) {
				duplicatesDropped++;
				continue;
			}
			session.events.push(event);
		}
	}
	for (const session of byId.values()) {
		session.events.sort((a, b) => a[0] - b[0]);
	}
	return { sessions: [...byId.values()], duplicatesDropped };
}

function projectOf(
	session: Session,
	labelsByLength: CwdLabel[],
): string | null {
	let mainCwd: string | null = null;
	let mainCount = 0;
	for (const [cwd, count] of session.cwdCounts) {
		if (count > mainCount) {
			mainCwd = cwd;
			mainCount = count;
		}
	}
	if (!mainCwd) return null;
	const attributed = attributeCwd(mainCwd, labelsByLength);
	return attributed.group ?? attributed.label;
}

interface DayAccumulator {
	messages: number;
	goAheads: number;
	statusChecks: number;
	corrections: number;
	pasted: number;
	replyGapsSec: number[];
	sessions: Set<string>;
	slots: number;
	workingSum: number;
	waitingSum: number;
	peakWorking: number;
	peakWaiting: number;
}

function emptyDay(): DayAccumulator {
	return {
		messages: 0,
		goAheads: 0,
		statusChecks: 0,
		corrections: 0,
		pasted: 0,
		replyGapsSec: [],
		sessions: new Set(),
		slots: 0,
		workingSum: 0,
		waitingSum: 0,
		peakWorking: 0,
		peakWaiting: 0,
	};
}

function share(count: number, total: number): number | null {
	return total > 0 ? count / total : null;
}

/**
 * The analysis scripts' metrics over the cached transcript events: what the
 * user typed, how fast they replied, how many agents ran or waited at once.
 */
export function computeInsights(
	cache: TranscriptCache,
	options: ComputeOptions,
): InsightsSummary {
	const clock = localClock(options.timeZone);
	const to = clock(options.nowMs).day;
	const from = shiftDay(to, -(options.days - 1));
	const dayList: string[] = [];
	for (let day = from; day <= to; day = shiftDay(day, 1)) dayList.push(day);
	const days = new Map(dayList.map((day) => [day, emptyDay()]));
	const labelsByLength = [...(options.cwdLabels ?? [])].sort(
		(a, b) => b.prefix.length - a.prefix.length,
	);

	const { sessions, duplicatesDropped } = collectSessions(cache);
	const projectMessages = new Map<string, number>();
	const activeSessions = new Set<string>();
	const working = new Map<number, Set<string>>();
	const waiting = new Map<number, Set<string>>();
	let totalMessages = 0;

	for (const session of sessions) {
		if (session.entrypoint === AUTOMATION_ENTRYPOINT) continue;
		const project = projectOf(session, labelsByLength);

		let lastActivity: number | null = null;
		let seenHuman = false;
		const events = session.events;
		for (let index = 0; index < events.length; index++) {
			const event = events[index] as InsightEvent;
			const [ms, kind] = event;
			const local = clock(ms);
			const day = days.get(local.day);

			if (kind === "human") {
				const flags = Number(event[3] ?? 0);
				const isFirst = !seenHuman;
				seenHuman = true;
				const gapMs = lastActivity === null ? null : ms - lastActivity;
				if (day && !(flags & MESSAGE_FLAGS.agentWritten)) {
					day.messages++;
					totalMessages++;
					if (flags & MESSAGE_FLAGS.goAhead) day.goAheads++;
					if (flags & MESSAGE_FLAGS.statusCheck) day.statusChecks++;
					if (flags & MESSAGE_FLAGS.correction) day.corrections++;
					if (flags & MESSAGE_FLAGS.pasted) day.pasted++;
					if (project) {
						projectMessages.set(
							project,
							(projectMessages.get(project) ?? 0) + 1,
						);
					}
					if (
						!isFirst &&
						gapMs !== null &&
						gapMs < REPLY_LIMIT_MS &&
						local.hour >= DAYTIME_START_HOUR &&
						local.hour < DAYTIME_END_HOUR
					) {
						day.replyGapsSec.push(gapMs / 1000);
					}
				}
			}

			if (kind === "assistant") {
				if (day) {
					day.sessions.add(session.id);
					activeSessions.add(session.id);
				}
				let slot = working.get(local.slot);
				if (!slot) {
					slot = new Set();
					working.set(local.slot, slot);
				}
				slot.add(session.id);
			}

			const next = events[index + 1];
			if (kind === "stop" && next) {
				const untilLocal =
					Math.min(next[0], ms + WAIT_LIMIT_MS) + (local.localMs - ms);
				for (let key = local.slot + 1; key * SLOT_MS < untilLocal; key++) {
					let slot = waiting.get(key);
					if (!slot) {
						slot = new Set();
						waiting.set(key, slot);
					}
					slot.add(session.id);
				}
			}

			if (ACTIVITY_KINDS.has(kind)) lastActivity = ms;
		}
	}

	const slotKeys = new Set([...working.keys(), ...waiting.keys()]);
	for (const key of slotKeys) {
		const wall = new Date(key * SLOT_MS);
		const day = days.get(wall.toISOString().slice(0, 10));
		const hour = wall.getUTCHours();
		if (!day || hour < DAYTIME_START_HOUR || hour >= DAYTIME_END_HOUR) continue;
		const workers = working.get(key) ?? new Set<string>();
		let waiters = 0;
		for (const id of waiting.get(key) ?? []) if (!workers.has(id)) waiters++;
		day.slots++;
		day.workingSum += workers.size;
		day.waitingSum += waiters;
		day.peakWorking = Math.max(day.peakWorking, workers.size);
		day.peakWaiting = Math.max(day.peakWaiting, waiters);
	}

	const dayRows: InsightsDay[] = dayList.map((day) => {
		const acc = days.get(day) ?? emptyDay();
		return {
			day,
			workingDay: isWorkingWeekday(weekdayOf(day)),
			messages: acc.messages,
			goAheads: acc.goAheads,
			statusChecks: acc.statusChecks,
			corrections: acc.corrections,
			pasted: acc.pasted,
			replies: acc.replyGapsSec.length,
			replyMedianSec: median(acc.replyGapsSec),
			liveSessions: acc.sessions.size,
			meanWorking: mean(acc.workingSum, acc.slots),
			peakWorking: acc.peakWorking,
			meanWaiting: mean(acc.waitingSum, acc.slots),
			peakWaiting: acc.peakWaiting,
		};
	});

	const weeks = new Map<string, string[]>();
	for (const day of dayList) {
		const monday = mondayOf(day);
		weeks.set(monday, [...(weeks.get(monday) ?? []), day]);
	}
	const weekRows: InsightsWeek[] = [...weeks].map(([weekStart, weekDays]) => {
		const accs = weekDays.map((day) => days.get(day) ?? emptyDay());
		const working = weekDays
			.map((day, index) => ({ day, acc: accs[index] as DayAccumulator }))
			.filter(({ day }) => isWorkingWeekday(weekdayOf(day)))
			.map(({ acc }) => acc);
		const sum = (pick: (acc: DayAccumulator) => number, list = accs) =>
			list.reduce((total, acc) => total + pick(acc), 0);
		const messages = sum((acc) => acc.messages);
		const gaps = accs.flatMap((acc) => acc.replyGapsSec);
		const slots = sum((acc) => acc.slots, working);
		return {
			weekStart,
			workingDays: working.length,
			messages,
			messagesPerWorkingDay:
				working.length > 0 ? messages / working.length : null,
			replies: gaps.length,
			replyMedianSec: median(gaps),
			goAheadShare: share(
				sum((acc) => acc.goAheads),
				messages,
			),
			statusCheckShare: share(
				sum((acc) => acc.statusChecks),
				messages,
			),
			correctionShare: share(
				sum((acc) => acc.corrections),
				messages,
			),
			pastedShare: share(
				sum((acc) => acc.pasted),
				messages,
			),
			liveSessionsPerWorkingDay: mean(
				sum((acc) => acc.sessions.size, working),
				working.length,
			),
			meanWorking: mean(
				sum((acc) => acc.workingSum, working),
				slots,
			),
			peakWorking: Math.max(0, ...working.map((acc) => acc.peakWorking)),
			meanWaiting: mean(
				sum((acc) => acc.waitingSum, working),
				slots,
			),
			peakWaiting: Math.max(0, ...working.map((acc) => acc.peakWaiting)),
		};
	});

	const projects = [...projectMessages]
		.map(([name, messages]) => ({
			name,
			messages,
			share: messages / Math.max(1, totalMessages),
		}))
		.sort((a, b) => b.messages - a.messages);

	return {
		generatedAt: options.nowMs,
		timeZone: options.timeZone,
		complete: options.complete ?? true,
		from,
		to,
		days: dayRows,
		weeks: weekRows,
		projects,
		totals: {
			messages: totalMessages,
			sessions: activeSessions.size,
			duplicatesDropped,
		},
		desk: null,
	};
}
