import { getConfig } from './config';
import { DataSource } from './dataSource';
import { fetchRepoPullRequestBadges, getCachedRepoPullRequestBadges } from './prStatusIntegration';
import { LaunchpadBucket, PullRequestBadgeInfo } from './types';

export interface LaunchpadPrItem {
	readonly repo: string;
	readonly branch: string;
	readonly badge: PullRequestBadgeInfo;
	readonly bucket: LaunchpadBucket | 'other';
}

/**
 * Classify a Pull Request badge into Launchpad action buckets (`mergeable`, `blocked`, `needsReview`, `followUp`, or `other` if stale).
 */
export function classifyPrForLaunchpad(
	badge: PullRequestBadgeInfo,
	currentUser: string,
	staleThresholdDays: number,
	nowMs: number = Date.now()
): LaunchpadBucket | 'other' {
	if (staleThresholdDays > 0 && typeof badge.updatedAt === 'string' && badge.updatedAt !== '') {
		const updated = Date.parse(badge.updatedAt);
		if (!Number.isNaN(updated) && (nowMs - updated) > staleThresholdDays * 86400000) {
			return 'other';
		}
	}
	if (badge.ciStatus === 'failure' || badge.reviewDecision === 'changes_requested' || badge.mergeable === false) {
		return 'blocked';
	}
	if (badge.state !== 'draft' && ((badge.mergeQueueState !== null && typeof badge.mergeQueueState !== 'undefined') || badge.reviewDecision === 'approved' || (badge.ciStatus === 'success' && badge.reviewDecision !== 'review_required'))) {
		return 'mergeable';
	}
	if (badge.state !== 'draft' && (badge.isRequestedReviewer || badge.reviewDecision === 'review_required' || (currentUser !== '' && typeof badge.author === 'string' && badge.author !== '' && badge.author.toLowerCase() !== currentUser.toLowerCase()))) {
		return 'needsReview';
	}
	return 'followUp';
}

export async function collectLaunchpadItems(
	dataSource: DataSource,
	repos: ReadonlyArray<string>,
	force: boolean = false
): Promise<{
	readonly items: LaunchpadPrItem[];
	readonly counts: { readonly mergeable: number; readonly blocked: number; readonly needsReview: number; readonly followUp: number; readonly other: number; readonly total: number };
}> {
	const cfg = getConfig().launchpadConfig;
	if (!getConfig().pullRequestStatusEnabled) {
		return { items: [], counts: { mergeable: 0, blocked: 0, needsReview: 0, followUp: 0, other: 0, total: 0 } };
	}
	const items: LaunchpadPrItem[] = [];
	for (const repo of repos) {
		const badges = force
			? await fetchRepoPullRequestBadges(dataSource, repo, true).catch(() => ({} as { [b: string]: PullRequestBadgeInfo }))
			: (getCachedRepoPullRequestBadges(repo) || await fetchRepoPullRequestBadges(dataSource, repo, false).catch(() => ({} as { [b: string]: PullRequestBadgeInfo })));
		for (const [branch, badge] of Object.entries(badges)) {
			const bucket = classifyPrForLaunchpad(badge, '', cfg.staleThresholdDays);
			items.push({ repo, branch, badge, bucket });
		}
	}
	const counts = {
		mergeable: items.filter((i) => i.bucket === 'mergeable').length,
		blocked: items.filter((i) => i.bucket === 'blocked').length,
		needsReview: items.filter((i) => i.bucket === 'needsReview').length,
		followUp: items.filter((i) => i.bucket === 'followUp').length,
		other: items.filter((i) => i.bucket === 'other').length,
		total: items.length
	};
	return { items, counts };
}
