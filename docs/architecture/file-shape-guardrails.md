# Production File-Shape Guardrails

This document owns the current production file-shape guardrail for Lineup.

The mechanical check is `npm run verify:maintainability`, which is also enforced through `npm run verify:architecture` and therefore through `npm run verify`.

## Policy

- Count production files under `src/**` with `.ts`, `.tsx`, `.css`, and `.html` extensions.
- Exclude tests via `__tests__` path segments and `*.test.*` filenames.
- Count `src/**/build/**` as production source unless a separate source-backed review proves a path is generated.
- Production files over 500 lines require an allowlist row below.
- Production files over 800 lines require an explicit decomposition or revisit trigger.
- Allowlisted files must not grow beyond their recorded baseline without same-change review of the rationale and trigger.
- Remove the row when an allowlisted file shrinks to 500 lines or fewer.

## Allowlist

The table below is parsed by `tools/verify-maintainability.mjs`. Keep the marker comments and column names intact.

Regenerate candidate rows with:

```bash
node tools/verify-maintainability.mjs --print-allowlist
```

Do not update this table as routine bookkeeping. A baseline increase is an architecture exception that needs the same change to explain why growth is necessary and what decomposition or revisit condition remains.

<!-- file-shape-guardrails:start -->
| Path | Baseline lines | Rationale | Growth/decomposition trigger |
| --- | ---: | --- | --- |
| `src/core/channel-setup/planning/ChannelSetupFacetLibraryExecutor.ts` | 516 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/core/channel-setup/planning/ChannelSetupPlanner.ts` | 741 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/core/channel-setup/planning/ChannelSetupStrategyBuilders.ts` | 705 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/core/channel-tuning/ChannelTuningCoordinator.ts` | 670 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/core/initialization/InitializationCoordinator.ts` | 754 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/core/orchestrator/AppOrchestrator.ts` | 1884 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/core/orchestrator/assembly/OrchestratorCoordinatorBuilders.ts` | 755 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/navigation/manager/NavigationManager.ts` | 688 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/player/PlaybackRecoveryManager.ts` | 723 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/player/SubtitleManager.ts` | 641 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/player/VideoPlayer.ts` | 998 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/plex/auth/PlexAuth.ts` | 727 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/plex/discovery/PlexServerDiscovery.ts` | 572 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/plex/library/PlexLibrary.ts` | 1301 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/plex/stream/resolver/PlexStreamResolver.ts` | 573 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/scheduler/channel-manager/ChannelManager.ts` | 930 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/auth/AuthScreen.ts` | 604 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/channel-setup/ChannelSetupSessionRuntime.ts` | 582 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/channel-setup/steps/StrategyStepController.ts` | 668 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/channel-setup/steps/StrategyStepInteractionController.ts` | 773 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/epg/component/EPGComponent.ts` | 720 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/epg/coordinator/EPGCoordinator.ts` | 561 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/epg/focus/EPGFocusNavigator.ts` | 663 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/epg/runtime/EPGScheduleRefreshRuntime.ts` | 881 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/epg/view/EPGCellRenderer.ts` | 580 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/epg/view/EPGInfoPanel.ts` | 889 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/epg/view/EPGVirtualizer.ts` | 937 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/mini-guide/MiniGuideCoordinator.ts` | 501 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/now-playing-info/NowPlayingInfoCoordinator.ts` | 580 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/now-playing-info/NowPlayingInfoOverlay.ts` | 633 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/playback-options/PlaybackOptionsCoordinator.ts` | 554 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/player-osd/PlayerOsdCoordinator.ts` | 594 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/profile-select/ProfileSelectScreen.ts` | 910 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
| `src/modules/ui/server-select/ServerSelectRuntimeCoordinator.ts` | 506 | Accepted current production hotspot baseline; no routine line growth is allowed. | Revisit/decomposition trigger: any net line growth, ownership expansion, or adjacent owner extraction touching this file. |
<!-- file-shape-guardrails:end -->
