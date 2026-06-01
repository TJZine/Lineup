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
    const freshReview = issueIds.filter((issueId) => issueId.startsWith('review::')).length;
    return {
        total_open: issueIds.length,
        fresh_review: freshReview,
    };
}

test('active cleanup package map count metadata matches package issue membership', () => {
    const packageMap = readPackageMap();
    const totals = {
        total_open: 0,
        older_live_non_review: 0,
        fresh_review: 0,
        fresh_non_review: 0,
    };

    for (const packageEntry of packageMap.packages) {
        const actual = countPackageIssues(packageEntry);
        assert.equal(
            packageEntry.estimated_backlog_size.total_open,
            actual.total_open,
            `${packageEntry.package_id} estimated total_open must match includes_issue_ids`
        );
        assert.equal(
            packageEntry.estimated_backlog_size.fresh_review,
            actual.fresh_review,
            `${packageEntry.package_id} estimated fresh_review must match review issue ids`
        );
        assert.equal(
            packageEntry.verified_package_size.total_open,
            actual.total_open,
            `${packageEntry.package_id} verified total_open must match includes_issue_ids`
        );
        assert.equal(
            packageEntry.verified_package_size.fresh_review,
            actual.fresh_review,
            `${packageEntry.package_id} verified fresh_review must match review issue ids`
        );

        for (const key of Object.keys(totals)) {
            totals[key] += packageEntry.estimated_backlog_size[key];
        }
    }

    assert.deepEqual(packageMap.verified_counts, totals);
    assert.equal(packageMap.validation_details.total_open_issues, totals.total_open);
    assert.equal(packageMap.validation_details.assigned_open_issues, totals.total_open);
});
