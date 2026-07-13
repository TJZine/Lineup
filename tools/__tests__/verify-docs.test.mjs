import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    hasExplicitOnlyPolicy,
    isValidMaxDepth,
    requiresExplicitInvocation,
} from '../verify-docs.mjs';

test('accepts only finite non-negative integer delegation depths no greater than one', () => {
    for (const value of [0, 1]) assert.equal(isValidMaxDepth(value), true, String(value));
    for (const value of [undefined, null, '1', -1, 0.5, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.equal(isValidMaxDepth(value), false, String(value));
    }
});

test('identifies explicit-only launcher names without maintaining an inventory', () => {
    assert.equal(requiresExplicitInvocation('lineup-feature-plan'), true);
    assert.equal(requiresExplicitInvocation('large-task-orchestration'), true);
    assert.equal(requiresExplicitInvocation('typescript-test-design'), false);
});

test('requires explicit-only launcher policy to be present and false', () => {
    assert.equal(hasExplicitOnlyPolicy('interface:\n  display_name: "Example"\n'), false);
    assert.equal(
        hasExplicitOnlyPolicy('policy:\n  allow_implicit_invocation: true\n'),
        false
    );
    assert.equal(
        hasExplicitOnlyPolicy('policy:\n  allow_implicit_invocation: false\n'),
        true
    );
});
