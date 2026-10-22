import { msg } from "@lingui/core/macro";
import { i18n } from "@superset/i18n";
import type {
	MyPullRequestAgeFilter,
	MyPullRequestRole,
	MyPullRequestStateFilter,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/filterMyPullRequests";
import type {
	MyPullRequestAction,
	MyPullRequestWhy,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/prioritizeMyPullRequests";

export function actionLabels(): Record<
	MyPullRequestAction,
	{ title: string; hint: string }
> {
	return {
		pinned: {
			title: i18n._(msg`Pinned`),
			hint: i18n._(msg`Pinned by you, last pinned first`),
		},
		review: {
			title: i18n._(msg`Review`),
			hint: i18n._(msg`Someone is waiting on your review, longest wait first`),
		},
		fix: {
			title: i18n._(msg`Fix`),
			hint: i18n._(
				msg`Your PRs blocked on you: changes requested, then CI, then conflicts`,
			),
		},
		merge: {
			title: i18n._(msg`Merge`),
			hint: i18n._(msg`Approved and green, oldest first`),
		},
		finish: { title: i18n._(msg`Finish`), hint: i18n._(msg`Your drafts`) },
		wait: {
			title: i18n._(msg`Waiting on others`),
			hint: i18n._(msg`Waiting on reviewers or CI, longest wait first`),
		},
		follow: {
			title: i18n._(msg`Following`),
			hint: i18n._(
				msg`Other people's PRs you take part in, latest activity first`,
			),
		},
		later: { title: i18n._(msg`Later`), hint: i18n._(msg`Moved down by you`) },
	};
}

export function roleLabels(): Record<MyPullRequestRole, string> {
	return {
		author: i18n._(msg`Author`),
		reviewer: i18n._(msg`Reviewer`),
		involved: i18n._(msg`Involved`),
	};
}

export function stateLabels(): Record<MyPullRequestStateFilter, string> {
	return {
		"review-requested": i18n._(msg`Review requested`),
		"ci-failing": i18n._(msg`CI failing`),
		conflicts: i18n._(msg`Conflicts`),
		"changes-requested": i18n._(msg`Changes requested`),
		"ready-to-merge": i18n._(msg`Ready to merge`),
		draft: i18n._(msg`Draft`),
	};
}

export function ageLabels(): Record<MyPullRequestAgeFilter, string> {
	return {
		any: i18n._(msg`Any age`),
		day: i18n._(msg`Older than a day`),
		week: i18n._(msg`Older than a week`),
		month: i18n._(msg`Older than a month`),
	};
}

function names(logins: string[]): string {
	return logins.map((login) => `@${login}`).join(", ");
}

export function whyLabel(why: MyPullRequestWhy): string {
	switch (why.kind) {
		case "review": {
			const author = why.author ? `@${why.author}` : i18n._(msg`The author`);
			return i18n._(msg`${author} waits for your review`);
		}
		case "changes-requested": {
			if (why.by.length === 0) return i18n._(msg`Changes requested`);
			const by = names(why.by);
			return i18n._(msg`Changes requested by ${by}`);
		}
		case "ci-failing": {
			const { failed, total } = why;
			return i18n._(msg`CI failing (${failed}/${total})`);
		}
		case "conflicts":
			return i18n._(msg`Conflicts with the base branch`);
		case "ready":
			return i18n._(msg`Approved and green`);
		case "draft":
			return i18n._(msg`Draft`);
		case "waiting-review": {
			if (why.reviewers.length === 0) return i18n._(msg`No reviewer requested`);
			const reviewers = names(why.reviewers);
			return i18n._(msg`Waiting on ${reviewers}`);
		}
		case "ci-running":
			return i18n._(msg`CI running`);
		case "following":
			switch (why.viewerReview) {
				case "APPROVED":
					return i18n._(msg`You approved`);
				case "CHANGES_REQUESTED":
					return i18n._(msg`You asked for changes`);
				case "COMMENTED":
					return i18n._(msg`You reviewed`);
				default:
					return i18n._(msg`You are involved`);
			}
		case "unknown":
			return i18n._(msg`Details did not load`);
	}
}
