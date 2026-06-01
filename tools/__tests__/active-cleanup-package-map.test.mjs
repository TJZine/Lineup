import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const PACKAGE_MAP_PATH = path.join(REPO_ROOT, 'docs/architecture/active-cleanup-package-map.json');

function readPackageMap() {
    return JSON.parse(readFileSync(PACKAGE_MAP_PATH, 'utf8'));
}

function countPackageIssues(packageEntry) {
    const issueIds = packageEntry.includes_issue_ids ?? [];
    const reviewIssueIds = issueIds.filter((issueId) => issueId.startsWith('review::'));
    const freshNonReviewIssueIds = packageEntry.includes_fresh_non_review_issue_ids ?? [];
    const byDetector = {};

    for (const issueId of issueIds) {
        const detector = issueId.split('::')[0];
        byDetector[detector] = (byDetector[detector] ?? 0) + 1;
    }

    return {
        total_open: issueIds.length,
        older_live_non_review: issueIds.length - reviewIssueIds.length - freshNonReviewIssueIds.length,
        fresh_review: reviewIssueIds.length,
        fresh_non_review: freshNonReviewIssueIds.length,
        by_detector: byDetector,
        review_issue_ids: reviewIssueIds,
        fresh_non_review_issue_ids: freshNonReviewIssueIds,
    };
}

test('active cleanup package map count metadata matches package issue membership', () => {
    const packageMap = readPackageMap();
    const assignedIssueIds = new Set();
    const totals = {
        total_open: 0,
        older_live_non_review: 0,
        fresh_review: 0,
        fresh_non_review: 0,
    };

    assert.equal(packageMap.package_count, packageMap.packages.length);

    for (const packageEntry of packageMap.packages) {
        const actual = countPackageIssues(packageEntry);
        const issueIds = packageEntry.includes_issue_ids ?? [];
        const duplicateIds = issueIds.filter((issueId) => {
            if (assignedIssueIds.has(issueId)) {
                return true;
            }
            assignedIssueIds.add(issueId);
            return false;
        });

        assert.deepEqual(duplicateIds, [], `${packageEntry.package_id} must not duplicate issue ids`);
        assert.deepEqual(
            [...(packageEntry.includes_review_issue_ids ?? [])].sort(),
            [...actual.review_issue_ids].sort(),
            `${packageEntry.package_id} includes_review_issue_ids must match review issue ids`
        );
        assert.deepEqual(
            [...actual.fresh_non_review_issue_ids].sort(),
            [...new Set(actual.fresh_non_review_issue_ids)].sort(),
            `${packageEntry.package_id} includes_fresh_non_review_issue_ids must not contain duplicates`
        );
        for (const issueId of actual.fresh_non_review_issue_ids) {
            assert.ok(
                issueIds.includes(issueId),
                `${packageEntry.package_id} fresh non-review issue ${issueId} must be in includes_issue_ids`
            );
            assert.ok(
                !issueId.startsWith('review::'),
                `${packageEntry.package_id} fresh non-review issue ${issueId} must not be a review issue`
            );
        }

        const expectedCounts = {
            total_open: actual.total_open,
            older_live_non_review: actual.older_live_non_review,
            fresh_review: actual.fresh_review,
            fresh_non_review: actual.fresh_non_review,
        };
        assert.deepEqual(
            packageEntry.estimated_backlog_size,
            expectedCounts,
            `${packageEntry.package_id} estimated_backlog_size must match issue membership`
        );
        assert.deepEqual(
            {
                total_open: packageEntry.verified_package_size.total_open,
                older_live_non_review: packageEntry.verified_package_size.older_live_non_review,
                fresh_review: packageEntry.verified_package_size.fresh_review,
                fresh_non_review: packageEntry.verified_package_size.fresh_non_review,
            },
            expectedCounts,
            `${packageEntry.package_id} verified_package_size must match issue membership`
        );
        assert.deepEqual(
            packageEntry.verified_package_size.by_detector,
            actual.by_detector,
            `${packageEntry.package_id} verified by_detector must match issue id detector prefixes`
        );

        for (const key of Object.keys(totals)) {
            totals[key] += expectedCounts[key];
        }
    }

    assert.deepEqual(packageMap.verified_counts, totals);
    assert.equal(packageMap.validation_details.total_open_issues, totals.total_open);
    assert.equal(packageMap.validation_details.assigned_open_issues, totals.total_open);
    assert.deepEqual(packageMap.validation_details.duplicate_assignments, []);
});
