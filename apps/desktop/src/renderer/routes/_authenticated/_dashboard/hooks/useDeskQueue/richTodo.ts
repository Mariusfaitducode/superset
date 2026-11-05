export interface TodoStep {
	text: string;
	done: boolean;
}

export interface RichTodoFields {
	steps: TodoStep[];
	/** Whether the host says which steps are done. */
	tracksSteps: boolean;
	draft: string | null;
	recipient: string | null;
	channel: string | null;
}

const text = (value: unknown): string | null =>
	typeof value === "string" && value.trim() ? value : null;

/**
 * The fields newer hosts add to a to-do (steps, draft, recipient, channel),
 * read without trusting their shape: older hosts leave them out, and a step
 * may be plain text or `{ text, done }`.
 */
export function readRichTodo(todo: object): RichTodoFields {
	const fields = todo as Record<string, unknown>;
	const steps: TodoStep[] = [];
	let tracksSteps = false;
	if (Array.isArray(fields.steps)) {
		for (const step of fields.steps) {
			if (typeof step === "string") {
				if (step.trim()) steps.push({ text: step, done: false });
			} else if (step && typeof step === "object") {
				const entry = step as Record<string, unknown>;
				const stepText = text(entry.text);
				if (!stepText) continue;
				if (typeof entry.done === "boolean") tracksSteps = true;
				steps.push({ text: stepText, done: entry.done === true });
			}
		}
	}
	return {
		steps,
		tracksSteps,
		draft: text(fields.draft),
		recipient: text(fields.recipient),
		channel: text(fields.channel),
	};
}
