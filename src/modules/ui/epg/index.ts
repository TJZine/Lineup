export { DeferredEPGComponent } from './component/DeferredEPGComponent';
export { EPGCoordinator } from './coordinator/EPGCoordinator';
export { EPGDebugRuntime } from './debug/EPGDebugRuntime';
export { CLASSIC_EPG_PIP_CLASS, buildEPGStartupConfig } from './startup/buildEPGStartupConfig';
export { withEpgVisibleRangeChangeBinding } from './component/EPGConfigBindings';
export { EPG_CONTAINER_ID } from './constants';

export type { IEPGComponent, IEPGReadinessPort } from './interfaces';
export type { IEPGDebugRuntime } from './debug/EPGDebugRuntime';
export type { EPGConfig, EPGUiStatus } from './types';
