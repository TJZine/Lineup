import { chmodSync, rmSync } from 'node:fs';
import path from 'node:path';

import type { VerifyDocsTestContext } from './verifyDocsTestHelpers';
import { registerVerifyDocsActivePlanChecklistAssertions } from './verifyDocs.activePlanChecklistAssertions';
import { registerVerifyDocsRequiredFilesAssertions } from './verifyDocs.requiredFilesAssertions';
import { registerVerifyDocsRoleRoutingAssertions } from './verifyDocs.roleRoutingAssertions';

describe('verify-docs', () => {
    const tempRoots: string[] = [];
    const context: VerifyDocsTestContext = { tempRoots };

    afterEach(() => {
        for (const tempRoot of tempRoots.splice(0)) {
            chmodSync(path.join(tempRoot, 'docs/AGENTIC_DEV_WORKFLOW.md'), 0o644);
            rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    registerVerifyDocsRequiredFilesAssertions(context);
    registerVerifyDocsRoleRoutingAssertions(context);
    registerVerifyDocsActivePlanChecklistAssertions(context);
});
