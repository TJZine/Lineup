import { throwIfEpgRefreshAborted } from './EPGRefreshAbort';
import type { RefreshSession } from './EPGScheduleRefreshRuntimeTypes';

export function assertEpgRefreshSessionCurrent(session: RefreshSession): void {
    throwIfEpgRefreshAborted(session.signal ?? null);
    session.operation.assertCurrent();
}

export function runIfEpgRefreshCurrent<T>(session: RefreshSession, action: () => T): T {
    assertEpgRefreshSessionCurrent(session);
    const result = action();
    assertEpgRefreshSessionCurrent(session);
    return result;
}
