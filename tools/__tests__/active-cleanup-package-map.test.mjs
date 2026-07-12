import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
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

function validatePackageMap(packageMap, expectedOpenIssueIds = null) {
    const assignedIssueIds = new Set();
    const expectedIssueIdSet = expectedOpenIssueIds === null
        ? null
        : new Set(expectedOpenIssueIds);
    const totals = {
        total_open: 0,
        older_live_non_review: 0,
        fresh_review: 0,
        fresh_non_review: 0,
    };

    assert.equal(packageMap.package_count, packageMap.packages.length);
    assert.deepEqual(packageMap.validation, {
        every_open_issue_assigned_once: true,
        no_open_issue_unassigned: true,
        no_issue_multiply_assigned: true,
        no_reconciled_closed_issue_included: true,
    });
    assert.equal(
        Array.isArray(packageMap.validation_details.stale_review_issue_ids_removed),
        true,
        'validation_details.stale_review_issue_ids_removed must be present'
    );

    const packageOrders = [];
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

        assert.equal(
            Number.isInteger(packageEntry.recommended_execution_order),
            true,
            `${packageEntry.package_id} recommended_execution_order must be an integer`
        );
        packageOrders.push(packageEntry.recommended_execution_order);
        assert.match(
            packageEntry.checklist_tokens.work_item,
            new RegExp(`^P${packageEntry.recommended_execution_order}-W\\d+$`),
            `${packageEntry.package_id} work_item checklist token must match recommended_execution_order`
        );
        assert.equal(
            packageEntry.checklist_tokens.priority_exit,
            `P${packageEntry.recommended_execution_order}-EXIT`,
            `${packageEntry.package_id} priority_exit checklist token must match recommended_execution_order`
        );
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
        assert.deepEqual(
            (packageEntry.includes_detectors ?? []).toSorted(),
            Object.keys(actual.by_detector).sort(),
            `${packageEntry.package_id} includes_detectors must match issue detector prefixes`
        );

        for (const key of Object.keys(totals)) {
            totals[key] += expectedCounts[key];
        }
    }

    assert.deepEqual(
        [...packageOrders].sort((a, b) => a - b),
        Array.from({ length: packageMap.package_count }, (_value, index) => index + 1),
        'recommended_execution_order values must be contiguous with package_count'
    );
    assert.deepEqual(packageMap.verified_counts, totals);
    assert.equal(packageMap.validation_details.total_open_issues, totals.total_open);
    assert.equal(packageMap.validation_details.assigned_open_issues, totals.total_open);
    assert.equal(packageMap.validation_details.assigned_open_issues, assignedIssueIds.size);
    if (expectedIssueIdSet !== null) {
        assert.deepEqual(
            [...assignedIssueIds].sort(),
            [...expectedIssueIdSet].sort(),
            'assigned issue ids must match the expected open issue universe'
        );
    }
    assert.deepEqual(packageMap.validation_details.unassigned_issue_ids, []);
    assert.deepEqual(packageMap.validation_details.duplicate_assignments, []);
    assert.deepEqual(packageMap.validation_details.closed_audit_ids_included, []);
    for (const issueId of packageMap.validation_details.stale_review_issue_ids_removed ?? []) {
        assert.equal(
            assignedIssueIds.has(issueId),
            false,
            `stale review issue ${issueId} must not be assigned to an active package`
        );
    }
}

test('active cleanup package map count metadata matches package issue membership', () => {
    validatePackageMap(readPackageMap());
});

function clonePackageMap(packageMap) {
    return JSON.parse(JSON.stringify(packageMap));
}

function collectAssignedIssueIds(packageMap) {
    return packageMap.packages.flatMap((packageEntry) => packageEntry.includes_issue_ids ?? []);
}

function recalculateFixtureMetadata(packageMap) {
    const totals = {
        total_open: 0,
        older_live_non_review: 0,
        fresh_review: 0,
        fresh_non_review: 0,
    };

    for (const packageEntry of packageMap.packages) {
        const actual = countPackageIssues(packageEntry);
        const counts = {
            total_open: actual.total_open,
            older_live_non_review: actual.older_live_non_review,
            fresh_review: actual.fresh_review,
            fresh_non_review: actual.fresh_non_review,
        };
        packageEntry.includes_review_issue_ids = actual.review_issue_ids;
        packageEntry.includes_fresh_non_review_issue_ids = actual.fresh_non_review_issue_ids;
        packageEntry.includes_detectors = Object.keys(actual.by_detector).toSorted();
        packageEntry.estimated_backlog_size = { ...counts };
        packageEntry.verified_package_size = {
            ...packageEntry.verified_package_size,
            ...counts,
            by_detector: actual.by_detector,
        };

        for (const key of Object.keys(totals)) {
            totals[key] += counts[key];
        }
    }

    packageMap.verified_counts = totals;
    packageMap.validation_details.total_open_issues = totals.total_open;
    packageMap.validation_details.assigned_open_issues = new Set(collectAssignedIssueIds(packageMap)).size;
}

function createPackageEntry(packageId, order, issueIds) {
    const entry = {
        package_id: packageId,
        package_name: packageId,
        includes_issue_ids: issueIds,
        includes_review_issue_ids: issueIds.filter((issueId) => issueId.startsWith('review::')),
        includes_fresh_non_review_issue_ids: [],
        recommended_execution_order: order,
        estimated_backlog_size: {
            total_open: 0,
            older_live_non_review: 0,
            fresh_review: 0,
            fresh_non_review: 0,
        },
        checklist_tokens: {
            work_item: `P${order}-W1`,
            priority_exit: `P${order}-EXIT`,
        },
        verified_package_size: {
            package_name: packageId,
            total_open: 0,
            older_live_non_review: 0,
            fresh_review: 0,
            fresh_non_review: 0,
            by_detector: {},
        },
    };
    const actual = countPackageIssues(entry);
    entry.includes_detectors = Object.keys(actual.by_detector).toSorted();
    const counts = {
        total_open: actual.total_open,
        older_live_non_review: actual.older_live_non_review,
        fresh_review: actual.fresh_review,
        fresh_non_review: actual.fresh_non_review,
    };
    entry.estimated_backlog_size = { ...counts };
    entry.verified_package_size = {
        ...entry.verified_package_size,
        ...counts,
        by_detector: actual.by_detector,
    };
    return entry;
}

function createValidFixture() {
    const packages = [
        createPackageEntry('pkg_one', 1, [
            'review::.::holistic::type_safety::one',
            'smells::src/example.ts::magic_number',
        ]),
        createPackageEntry('pkg_two', 2, [
            'structural::src/other.ts',
        ]),
    ];
    return {
        package_count: packages.length,
        validation: {
            every_open_issue_assigned_once: true,
            no_open_issue_unassigned: true,
            no_issue_multiply_assigned: true,
            no_reconciled_closed_issue_included: true,
        },
        validation_details: {
            total_open_issues: 3,
            assigned_open_issues: 3,
            unassigned_issue_ids: [],
            duplicate_assignments: [],
            closed_audit_ids_included: [],
            stale_review_issue_ids_removed: [
                'review::.::holistic::type_safety::stale',
            ],
        },
        verified_counts: {
            total_open: 3,
            older_live_non_review: 2,
            fresh_review: 1,
            fresh_non_review: 0,
        },
        packages,
    };
}

test('active cleanup package map fixture is valid before mutation', () => {
    const fixture = createValidFixture();
    assert.doesNotThrow(() =>
        validatePackageMap(fixture, collectAssignedIssueIds(fixture))
    );
});

test('active cleanup package map verifier rejects malformed package maps', () => {
    const cases = [
        {
            name: 'self-consistent missing expected open issue',
            mutate: (fixture) => {
                fixture.packages[0].includes_issue_ids = fixture.packages[0].includes_issue_ids.filter(
                    (issueId) => issueId !== 'smells::src/example.ts::magic_number'
                );
                recalculateFixtureMetadata(fixture);
            },
        },
        {
            name: 'stale review id assigned to an active package',
            mutate: (fixture) => {
                const staleId = fixture.validation_details.stale_review_issue_ids_removed[0];
                fixture.packages[0].includes_issue_ids.push(staleId);
                fixture.packages[0].includes_review_issue_ids.push(staleId);
                fixture.packages[0].estimated_backlog_size.total_open += 1;
                fixture.packages[0].estimated_backlog_size.fresh_review += 1;
                fixture.packages[0].verified_package_size.total_open += 1;
                fixture.packages[0].verified_package_size.fresh_review += 1;
                fixture.packages[0].verified_package_size.by_detector.review += 1;
                fixture.verified_counts.total_open += 1;
                fixture.verified_counts.fresh_review += 1;
                fixture.validation_details.total_open_issues += 1;
                fixture.validation_details.assigned_open_issues += 1;
            },
        },
        {
            name: 'malformed verified counts',
            mutate: (fixture) => {
                fixture.verified_counts.total_open += 1;
                fixture.validation_details.total_open_issues += 1;
                fixture.validation_details.assigned_open_issues += 1;
            },
        },
        {
            name: 'duplicate issue assignment',
            mutate: (fixture) => {
                const duplicateId = fixture.packages[0].includes_issue_ids[0];
                fixture.packages[1].includes_issue_ids.push(duplicateId);
                recalculateFixtureMetadata(fixture);
            },
        },
        {
            name: 'package-count execution-order hole',
            mutate: (fixture) => {
                fixture.packages[1].recommended_execution_order = 3;
            },
        },
        {
            name: 'checklist token drift from execution order',
            mutate: (fixture) => {
                fixture.packages[1].checklist_tokens.priority_exit = 'P1-EXIT';
            },
        },
        {
            name: 'missing stale review metadata',
            mutate: (fixture) => {
                delete fixture.validation_details.stale_review_issue_ids_removed;
            },
        },
    ];

    for (const { name, mutate } of cases) {
        const fixture = clonePackageMap(createValidFixture());
        const expectedIssueIds = collectAssignedIssueIds(fixture);
        mutate(fixture);
        assert.throws(
            () => validatePackageMap(fixture, expectedIssueIds),
            undefined,
            name
        );
    }
});
