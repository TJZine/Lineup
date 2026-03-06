# P4-W1 SettingsScreen State/View-Focus Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split `SettingsScreen` so a new `SettingsScreenStateController` owns settings-derived state, persistence reads/writes, and side effects, while `SettingsScreen` keeps only DOM rendering, dropdown lifecycle, pane transitions, and D-pad focus/navigation.

**Architecture:** Keep `SettingsScreen` exported from the same file and constructed the same way by the app shell. Introduce `src/modules/ui/settings/SettingsScreenStateController.ts` as the only new collaborator for this work unit; it returns fresh `SettingsCategoryConfig[]` snapshots and exposes no DOM or navigation logic. `SettingsScreen` will request fresh snapshots from the controller during initial render, category changes, screen show, and controller-driven invalidation after subtitle-mode changes.

**Tech Stack:** TypeScript, Jest with jsdom, Lineup settings UI primitives, `SettingsStore`, `ThemeManager`, shared subtitle-mode helpers, app-shell lazy screen registry.

---

## Required Skills

- `@writing-plans` for atomic execution steps, exact commands, and explicit handoff.
- `@frontend-design` to preserve the established visual language because this work is a refactor, not a redesign.
- `@ui-composition-patterns` because this screen owns TV focus, dropdown lifecycle, RAF-driven transitions, and cleanup.
- `@architecture-boundaries` because the split changes ownership boundaries inside a large UI class.
- `@persistence-boundaries` because settings persistence must stay inside `SettingsStore` and shared helpers.

## Locked Decisions

- Create exactly one new file: `src/modules/ui/settings/SettingsScreenStateController.ts`.
- Keep `SettingsScreen` in `src/modules/ui/settings/SettingsScreen.ts` and keep its constructor call sites unchanged.
- Do not modify `src/core/app-shell/AppLazyScreenRegistry.ts`.
- Do not modify `src/App.ts`.
- This is a pure refactor. Make zero intended visual changes.
- Do not edit any CSS, theme tokens, design docs, class names, DOM labels, DOM order, category order, control order, icons, copy, spacing, animation timing, or layout structure.
- Do not edit `_buildUI()`, `_renderActiveCategory()`, `_createCategoryButton()`, `_registerFocusables()`, `_unregisterFocusables()`, dropdown positioning, or RAF timing logic except for the minimum category-reload integration described below.
- Keep `_toggleMetadata`, `_selectMetadata`, `_inferToggleMetadata()`, `_inferSelectMetadata()`, and `_createItem()` in `SettingsScreen`. They remain part of the view/render path for this work unit.
- Keep `SettingsStore` as the storage boundary. Do not add new raw `localStorage` reads/writes to `SettingsScreen` or the controller except existing shared subtitle helpers.
- `SettingsScreenStateController` must not import navigation types, DOM helpers, dropdown helpers, or CSS files.
- `SettingsScreenStateController` must not mutate DOM directly.
- Subtitle-mode changes must invalidate state by rebuilding the active category; do not keep partial DOM patching for subtitle-dependent controls.
- Do not modify this plan file during implementation.
- Update `ARCHITECTURE_CLEANUP_CHECKLIST.md` only after all verification commands pass.

## Evidence To Preserve

- `SettingsScreen` is currently a single class at `src/modules/ui/settings/SettingsScreen.ts`.
- The current state/view mix happens inside `_buildCategories()` plus the persistence helper block near the bottom of that file.
- `SettingsScreen` currently rebuilds categories in three places:
  - `_buildUI()`
  - `_setActiveCategory()`
  - `show()`
- Existing tests already cover screen behavior at `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`.
- `SettingsScreen` has a limited impact radius through `src/core/app-shell/AppLazyScreenRegistry.ts` and `src/App.ts`.

## Reference Notes

- 2026-03-05, Context7 `/mdn/content`: `requestAnimationFrame()` returns an ID that should be passed to `cancelAnimationFrame()`. Keep the existing `number | null` frame-id pattern and preserve hide/destroy cleanup.
- 2026-03-05, Context7 `/jestjs/jest`: `jest.spyOn()` preserves the original implementation unless mocked and should be restored with `jest.restoreAllMocks()`. Follow that pattern in the new controller tests.
- 2026-03-05, local design source of truth: `docs/design/ui-design-language.md` and the repo-local skill `ui-composition-patterns` require preserving D-pad focusability, explicit focus ownership, cleanup, and the current visual language for non-redesign work.

## Allowed File Changes

Only these files may change in the implementation pass:

- `src/modules/ui/settings/SettingsScreen.ts`
- `src/modules/ui/settings/SettingsScreenStateController.ts`
- `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
- `src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts`
- `ARCHITECTURE_CLEANUP_CHECKLIST.md`

If any other file seems to require changes, stop and investigate before continuing.

## Control Ownership Map

Copy the current labels, descriptions, IDs, options, and category order exactly. Only move ownership.

| Control ID | Category | Read source | Write / side effect owner |
| --- | --- | --- | --- |
| `settings-dts-passthrough` | `audio_subtitles` | `settingsStore.readToggleSetting('dtsPassthrough')` | `settingsStore.writeToggleSetting('dtsPassthrough', value)` |
| `settings-direct-play-audio-fallback` | `audio_subtitles` | `settingsStore.readToggleSetting('directPlayAudioFallback')` | `settingsStore.writeToggleSetting('directPlayAudioFallback', value)` |
| `settings-subtitle-mode` | `audio_subtitles` | `getSubtitleMode()` converted to select index | `setSubtitleMode(mode)`, then `onSubtitleModeChange(mode)`, then `onStateInvalidated()` |
| `settings-subtitle-language` | `audio_subtitles` | `settingsStore.readSubtitleLanguageValue(SUBTITLE_LANGUAGE_OPTIONS)` | `settingsStore.writeSubtitleLanguageValue(value, SUBTITLE_LANGUAGE_OPTIONS)` |
| `settings-subtitles-prefer-forced` | `audio_subtitles` | `settingsStore.readToggleSetting('subtitlePreferForced')` | `settingsStore.writeToggleSetting('subtitlePreferForced', value)` |
| `settings-keep-playing` | `playback_hdr` | `settingsStore.readToggleSetting('keepPlayingInSettings')` | `settingsStore.writeToggleSetting('keepPlayingInSettings', value)` |
| `settings-hdr10-fallback-mode` | `playback_hdr` | `settingsStore.readHdr10FallbackModeValue()` | `settingsStore.writeHdr10FallbackModeValue(value as 0 | 1 | 2)` |
| `settings-transcode-quality` | `playback_hdr` | `settingsStore.readTranscodeQualityValue(TRANSCODE_QUALITY_OPTIONS)` | `settingsStore.writeTranscodeQualityValue(value, TRANSCODE_QUALITY_OPTIONS)` |
| `settings-transcode-compat` | `playback_hdr` | `settingsStore.readToggleSetting('transcodeCompat')` | `settingsStore.writeToggleSetting('transcodeCompat', value)` |
| `settings-guide-category-colors` | `appearance` | `settingsStore.readToggleSetting('guideCategoryColors')` | write toggle, then `onGuideSettingChange({ key: 'categoryColors', enabled: value })` |
| `settings-guide-library-tabs` | `appearance` | `settingsStore.readToggleSetting('epgLibraryTabsEnabled')` | write toggle, then `onGuideSettingChange({ key: 'libraryTabs', enabled: value })` |
| `settings-epg-now-watching` | `appearance` | `settingsStore.readToggleSetting('epgNowWatchingEnabled')` | write toggle, then `onGuideSettingChange({ key: 'nowWatchingBanner', enabled: value })` |
| `settings-epg-aggressive-preload` | `appearance` | `settingsStore.readToggleSetting('epgAggressivePreloadEnabled')` | write toggle, then `onGuideSettingChange({ key: 'aggressivePreload', enabled: value })` |
| `settings-epg-density` | `appearance` | `settingsStore.readEpgGuideDensityValue()` | `settingsStore.writeEpgGuideDensityValue(value)`, then `onGuideSettingChange({ key: 'guideDensity', density })` where `density` is `'wide'` for `1`, otherwise `'detailed'` |
| `settings-epg-layout-mode` | `appearance` | `settingsStore.readEpgLayoutModeValue()` | `settingsStore.writeEpgLayoutModeValue(value === 0 ? 0 : 1)`, then `onGuideSettingChange({ key: 'layoutMode', mode })` where `mode` is `'classic'` for `1`, otherwise `'overlay'` |
| `settings-epg-past-items` | `appearance` | `settingsStore.readEpgPastItemsWindowValue()` | `const stored = settingsStore.writeEpgPastItemsWindowValue(value)`, then `onGuideSettingChange({ key: 'pastItemsWindow', value: stored })` |
| `settings-epg-info-background-mode` | `appearance` | `settingsStore.readEpgInfoBackgroundModeValue()` | `const mode = settingsStore.writeEpgInfoBackgroundModeValue(value)`, then `onGuideSettingChange({ key: 'infoBackgroundMode', mode })` |
| `settings-theme` | `appearance` | `ThemeManager.getInstance().getTheme()` converted to select index | `ThemeManager.getInstance().setTheme(THEME_OPTIONS[value]?.theme ?? DEFAULT_THEME)` |
| `settings-cinematic-now-playing` | `appearance` | `settingsStore.readToggleSetting('cinematicNowPlaying')` | `settingsStore.writeToggleSetting('cinematicNowPlaying', value)` |
| `settings-prefer-clear-logos` | `appearance` | `settingsStore.readToggleSetting('preferClearLogos')` | `settingsStore.writeToggleSetting('preferClearLogos', value)` |
| `settings-now-playing-timeout` | `appearance` | `settingsStore.readClampedNowPlayingAutoHideValue(NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS, NOW_PLAYING_INFO_DEFAULTS.autoHideMs)` | `settingsStore.writeNowPlayingAutoHideValue(value)` |
| `settings-profile-picker-startup` | `account` | `settingsStore.readToggleSetting('showProfilePickerOnStartup')` | `settingsStore.writeToggleSetting('showProfilePickerOnStartup', value)` |
| `settings-debug-logging` | `developer` | `settingsStore.readToggleSetting('debugLogging')` | write toggle, then `dispatchDebugLoggingChanged(value)` |
| `settings-subtitle-debug-logging` | `developer` | `settingsStore.readToggleSetting('subtitleDebugLogging')` | `settingsStore.writeToggleSetting('subtitleDebugLogging', value)` |

## Task 0: Create The Dedicated Worktree And Baseline

**Files:**
- Modify: none

**Step 1: Create the dedicated worktree and branch**

Run:

```bash
git worktree add ../Lineup-p4-w1-settings-screen-state-view-focus-split -b codex/p4-w1-settings-screen-state-view-focus-split
```

Expected: a new sibling directory is created and Git checks out branch `codex/p4-w1-settings-screen-state-view-focus-split`.

**Step 2: Move into the worktree**

Run:

```bash
cd ../Lineup-p4-w1-settings-screen-state-view-focus-split
```

Expected: all remaining commands in this plan run from the worktree root.

**Step 3: Confirm the branch and starting status**

Run:

```bash
git status --short --branch
```

Expected: output starts with `## codex/p4-w1-settings-screen-state-view-focus-split` and shows no tracked changes.

**Step 4: Run the existing screen test as the baseline**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/settings/__tests__/SettingsScreen.test.ts
```

Expected: PASS before any edits.

## Task 1: Add The Failing Tests First

**Files:**
- Create: `src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts`
- Modify: `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`

**Step 1: Create the controller test file with shared cleanup**

Create `src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts` with this exact test harness first:

```ts
/**
 * @jest-environment jsdom
 */

import { SettingsScreenStateController } from '../SettingsScreenStateController';
import { SettingsStore } from '../SettingsStore';
import { SETTINGS_STORAGE_KEYS } from '../constants';
import { ThemeManager } from '../../theme';
import * as ConfigEvents from '../../../../config/events';
import { getSubtitleMode } from '../../../../shared/subtitle-mode';

beforeEach(() => {
    localStorage.clear();
    ThemeManager.__resetForTests();
    jest.restoreAllMocks();
});
```

**Step 2: Add the category snapshot test**

Add one test named exactly:

```ts
it('builds the current settings categories from persisted state', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');
    localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_MODE, 'off');
    localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, 'es');
    localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_PREFER_FORCED, '1');

    const controller = new SettingsScreenStateController({ settingsStore: new SettingsStore() });
    const categories = controller.getCategories();

    expect(categories.map((category) => category.id)).toEqual([
        'audio_subtitles',
        'playback_hdr',
        'appearance',
        'account',
        'developer',
    ]);

    const audioCategory = categories.find((category) => category.id === 'audio_subtitles');
    const subtitleMode = audioCategory?.items.find((item) => item.id === 'settings-subtitle-mode');
    const subtitleLanguage = audioCategory?.items.find((item) => item.id === 'settings-subtitle-language');
    const preferForced = audioCategory?.items.find((item) => item.id === 'settings-subtitles-prefer-forced');

    expect(subtitleMode?.value).toBe(0);
    expect(subtitleLanguage?.value).toBe(2);
    expect(subtitleLanguage?.disabled).toBe(true);
    expect(preferForced?.disabled).toBe(true);
});
```

**Step 3: Add the subtitle-mode callback test**

Add one test named exactly:

```ts
it('writes subtitle mode, emits subtitle callback, and invalidates state', () => {
    const onSubtitleModeChange = jest.fn();
    const onStateInvalidated = jest.fn();

    const controller = new SettingsScreenStateController({
        settingsStore: new SettingsStore(),
        onSubtitleModeChange,
        onStateInvalidated,
    });

    const categories = controller.getCategories();
    const audioCategory = categories.find((category) => category.id === 'audio_subtitles');
    const subtitleMode = audioCategory?.items.find((item) => item.id === 'settings-subtitle-mode');

    if (!subtitleMode || !('onChange' in subtitleMode)) {
        throw new Error('Subtitle mode item not found');
    }

    subtitleMode.onChange(0);

    expect(getSubtitleMode()).toBe('off');
    expect(onSubtitleModeChange).toHaveBeenCalledWith('off');
    expect(onStateInvalidated).toHaveBeenCalledTimes(1);
});
```

**Step 4: Add the guide-setting callback test**

Add one test named exactly:

```ts
it('writes layout mode and emits the guide layout change', () => {
    const settingsStore = new SettingsStore();
    const writeSpy = jest.spyOn(settingsStore, 'writeEpgLayoutModeValue');
    const onGuideSettingChange = jest.fn();

    const controller = new SettingsScreenStateController({
        settingsStore,
        onGuideSettingChange,
    });

    const categories = controller.getCategories();
    const appearanceCategory = categories.find((category) => category.id === 'appearance');
    const layoutMode = appearanceCategory?.items.find((item) => item.id === 'settings-epg-layout-mode');

    if (!layoutMode || !('onChange' in layoutMode)) {
        throw new Error('Guide layout item not found');
    }

    layoutMode.onChange(0);

    expect(writeSpy).toHaveBeenCalledWith(0);
    expect(onGuideSettingChange).toHaveBeenCalledWith({ key: 'layoutMode', mode: 'overlay' });
});
```

**Step 5: Add the debug-logging side-effect test**

Add one test named exactly:

```ts
it('writes debug logging and dispatches the shared debug event', () => {
    const settingsStore = new SettingsStore();
    const writeSpy = jest.spyOn(settingsStore, 'writeToggleSetting');
    const dispatchSpy = jest.spyOn(ConfigEvents, 'dispatchDebugLoggingChanged');

    const controller = new SettingsScreenStateController({ settingsStore });
    const categories = controller.getCategories();
    const developerCategory = categories.find((category) => category.id === 'developer');
    const debugLogging = developerCategory?.items.find((item) => item.id === 'settings-debug-logging');

    if (!debugLogging || !('onChange' in debugLogging)) {
        throw new Error('Debug logging item not found');
    }

    debugLogging.onChange(true);

    expect(writeSpy).toHaveBeenCalledWith('debugLogging', true);
    expect(dispatchSpy).toHaveBeenCalledWith(true);
});
```

**Step 6: Delete the two exact state-ownership tests from `SettingsScreen.test.ts`**

Delete these tests by exact name:

- `uses injected SettingsStore without changing visible settings behavior`
- `refresh delegates settings-debug-logging toggle reads to SettingsStore.readToggleSetting`

Do not delete any other tests from that file.

**Step 7: Add the new screen-level rerender/focus test**

Add one test named exactly:

```ts
it('rerenders subtitle-dependent controls and preserves focus after subtitle mode changes', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_MODE, 'direct');

    const { container, nav, screen } = createScreen(jest.fn());
    screen.show();
    activateCategory(container, 'audio_subtitles');

    nav.setFocus('settings-subtitle-mode');
    nav.focusables.get('settings-subtitle-mode')?.onSelect?.();
    nav.focusables.get('settings-dropdown-option-0')?.onSelect?.();

    const subtitleLanguage = container.querySelector('#settings-subtitle-language') as HTMLButtonElement | null;
    const preferForced = container.querySelector('#settings-subtitles-prefer-forced') as HTMLButtonElement | null;

    expect(subtitleLanguage?.disabled).toBe(true);
    expect(preferForced?.disabled).toBe(true);
    expect(nav.getFocusedElement()?.id).toBe('settings-subtitle-mode');
});
```

This test must use the public UI path above. Do not call private methods.

**Step 8: Run only the new controller test file**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts
```

Expected: FAIL because `SettingsScreenStateController` does not exist yet.

**Step 9: Run only the updated screen test file**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/settings/__tests__/SettingsScreen.test.ts
```

Expected: FAIL because the new rerender/focus assertion is not implemented yet.

## Task 2: Create The Controller Skeleton And Shared Helpers

**Files:**
- Create: `src/modules/ui/settings/SettingsScreenStateController.ts`

**Step 1: Create the file with the exact public surface**

Create this file with this exact top-level shape first:

```ts
import { DEFAULT_THEME, THEME_OPTIONS } from './theme';
import type { GuideSettingChange, SettingsCategoryConfig } from './types';
import { SettingsStore } from './SettingsStore';
import { ThemeManager } from '../theme';
import { getSubtitleMode, setSubtitleMode, type SubtitleMode } from '../../../shared/subtitle-mode';
import { dispatchDebugLoggingChanged } from '../../../config/events';
import { TRANSCODE_QUALITY_OPTIONS } from '../../../config/transcodeQuality';
import { NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS, NOW_PLAYING_INFO_DEFAULTS } from '../now-playing-info';

export interface SettingsScreenStateControllerOptions {
    settingsStore?: SettingsStore;
    onSubtitleModeChange?: (mode: SubtitleMode) => void;
    onGuideSettingChange?: (change: GuideSettingChange) => void;
    onStateInvalidated?: () => void;
}

export class SettingsScreenStateController {
    public constructor(options: SettingsScreenStateControllerOptions = {}) {}
    public getCategories(): SettingsCategoryConfig[] {
        return [];
    }
}
```

**Step 2: Move the state-owned constants into the controller file**

Move these exact constants out of `SettingsScreen.ts` and into the new controller file:

- `SUBTITLE_LANGUAGE_OPTIONS`
- `SUBTITLE_MODE_OPTIONS`
- `EPG_PAST_ITEMS_OPTIONS`
- `DEFAULT_THEME_VALUE`

Delete the old copies from `SettingsScreen.ts` in the same step so there is only one source of truth.

**Step 3: Add the private fields and constructor assignments**

Use this exact field set:

```ts
private readonly _settingsStore: SettingsStore;
private readonly _onSubtitleModeChange: ((mode: SubtitleMode) => void) | null;
private readonly _onGuideSettingChange: ((change: GuideSettingChange) => void) | null;
private readonly _onStateInvalidated: (() => void) | null;
```

Set them in the constructor with `new SettingsStore()` as the default.

**Step 4: Add the subtitle and theme helper methods**

Add these helper method names to the controller and make each one a direct move or thin wrapper around the existing state logic:

- `_getThemeIndex(theme: (typeof THEME_OPTIONS)[number]['theme']): number`
- `_subtitleModeToValue(mode: SubtitleMode): number`
- `_valueToSubtitleMode(value: number): SubtitleMode`
- `_readSubtitleModeValue(): number`
- `_readSubtitleLanguageValue(): number`
- `_writeSubtitleLanguageValue(value: number): void`

**Step 5: Add the transcode helper methods**

Add these helper methods next:

- `_readTranscodeQualityValue(): number`
- `_writeTranscodeQualityValue(value: number): void`

**Step 6: Add the EPG wrapper methods**

Add these helper methods next:

- `_readEpgLayoutModeValue(): 0 | 1`
- `_writeEpgLayoutModeValue(value: number): void`
- `_readEpgGuideDensityValue(): 0 | 1`
- `_writeEpgGuideDensityValue(value: number): void`
- `_readEpgPastItemsWindowValue(): number`
- `_writeEpgPastItemsWindowValue(value: number): 'auto' | '0' | '15' | '30'`
- `_readEpgInfoBackgroundModeValue(): 0 | 1 | 2`
- `_writeEpgInfoBackgroundModeValue(value: number): 0 | 1 | 2`

These must call through to `SettingsStore`. Do not add new storage parsing logic.

**Step 7: Add the now-playing wrapper method**

Add this final wrapper:

- `_readClampedNowPlayingAutoHide(): number`

This must also call through to `SettingsStore`.

**Step 8: Re-run the controller tests**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts
```

Expected: FAIL on assertions, not on missing-module or TypeScript compile errors.

## Task 3: Implement `getCategories()` One Category At A Time

**Files:**
- Modify: `src/modules/ui/settings/SettingsScreenStateController.ts`

**Step 1: Implement the `audio_subtitles` category**

Inside `getCategories()`, compute the current subtitle-mode select value, the current subtitle mode, and `subtitlesEnabled = mode !== 'off'`. Then return the `audio_subtitles` category using the exact control IDs and ownership listed in the control map.

For the subtitle-mode `onChange`, use this exact order:

```ts
const mode = this._valueToSubtitleMode(value);
setSubtitleMode(mode);
this._onSubtitleModeChange?.(mode);
this._onStateInvalidated?.();
```

Do not call DOM methods from this callback.

**Step 2: Implement the `playback_hdr` category**

Add the `playback_hdr` category with these exact controls:

- `settings-keep-playing`
- `settings-hdr10-fallback-mode`
- `settings-transcode-quality`
- `settings-transcode-compat`

Copy the existing labels, descriptions, and option order exactly from `SettingsScreen.ts`.

**Step 3: Implement the `appearance` toggle controls**

Add these exact controls first:

- `settings-guide-category-colors`
- `settings-guide-library-tabs`
- `settings-epg-now-watching`
- `settings-epg-aggressive-preload`

For each control, write the toggle first and then emit the exact `onGuideSettingChange(...)` payload from the control map.

**Step 4: Implement the `appearance` guide select controls**

Add these exact controls next:

- `settings-epg-density`
- `settings-epg-layout-mode`
- `settings-epg-past-items`
- `settings-epg-info-background-mode`

For each guide-affecting control, write the value first and then emit the exact `onGuideSettingChange(...)` payload from the control map.

**Step 5: Finish the remaining `appearance` controls**

Add these remaining `appearance` controls:

- `settings-theme`
- `settings-cinematic-now-playing`
- `settings-prefer-clear-logos`
- `settings-now-playing-timeout`

For `settings-theme`, use `ThemeManager.getInstance().getTheme()` for the current value and `ThemeManager.getInstance().setTheme(...)` for writes.

**Step 6: Implement the `account` category**

Add this exact control:

- `settings-profile-picker-startup`

**Step 7: Implement the `developer` category**

Add these exact controls:

- `settings-debug-logging`
- `settings-subtitle-debug-logging`

For `settings-debug-logging`, call `dispatchDebugLoggingChanged(value)` immediately after the toggle write.

**Step 8: Return the full category array in the exact existing order**

Return categories in this exact order only:

```ts
[
    audioSubtitlesCategory,
    playbackHdrCategory,
    appearanceCategory,
    accountCategory,
    developerCategory,
]
```

Do not sort dynamically. Do not build categories from multiple helper arrays in this work unit.

**Step 9: Run the controller tests**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts
```

Expected: PASS

**Step 10: Commit the controller extraction**

Run:

```bash
git add src/modules/ui/settings/SettingsScreenStateController.ts src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts
git commit -m "refactor: extract settings screen state controller"
```

Expected: commit succeeds with only the controller file and its test.

## Task 4: Refactor `SettingsScreen` To Use The Controller

**Files:**
- Modify: `src/modules/ui/settings/SettingsScreen.ts`
- Modify: `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`

**Step 1: Add the controller import and field**

Import `SettingsScreenStateController` and add this exact field:

```ts
private readonly _stateController: SettingsScreenStateController;
```

**Step 2: Instantiate the controller in the constructor**

Use this exact constructor wiring:

```ts
this._stateController = new SettingsScreenStateController({
    settingsStore: this._settingsStore,
    onSubtitleModeChange: (mode) => {
        this._onSubtitleModeChange?.(mode);
    },
    onGuideSettingChange: (change) => {
        this._onGuideSettingChange?.(change);
    },
    onStateInvalidated: () => {
        this._handleStateInvalidated();
    },
});
```

Do not change the public constructor signature.

**Step 3: Add the category reload helper**

Add this exact helper:

```ts
private _reloadCategoriesFromState(): void {
    this._categories = this._stateController.getCategories();
    if (!this._activeCategoryId || !this._categories.some((category) => category.id === this._activeCategoryId)) {
        this._activeCategoryId = this._categories[0]?.id ?? null;
    }
}
```

**Step 4: Replace all direct `_buildCategories()` calls**

Replace `_buildCategories()` with `_reloadCategoriesFromState()` in exactly these three locations:

- `_buildUI()`
- `_setActiveCategory()`
- `show()`

After this step, there must be no remaining call sites for `_buildCategories()`.

**Step 5: Add the state-invalidation rerender helper**

Add this exact method:

```ts
private _handleStateInvalidated(): void {
    const focusedId = this._getNavigation()?.getFocusedElement()?.id ?? null;
    this._closeDropdown();
    this._reloadCategoriesFromState();
    this._renderActiveCategory();
    if (this._container.classList.contains('visible')) {
        this._unregisterFocusables();
        this._registerFocusables(focusedId);
    }
}
```

**Step 6: Delete `_buildCategories()`**

Delete only `_buildCategories()` in this step.

**Step 7: Delete the EPG read/write helpers**

Delete these exact methods from `SettingsScreen.ts`:

- `_loadEpgLayoutModeValue`
- `_loadEpgGuideDensityValue`
- `_loadEpgPastItemsWindowValue`
- `_loadEpgInfoBackgroundModeValue`
- `_saveEpgLayoutModeValue`
- `_saveEpgGuideDensityValue`
- `_saveEpgPastItemsWindowValue`
- `_saveEpgInfoBackgroundModeValue`

**Step 8: Delete the subtitle, theme, and transcode helpers**

Delete these exact methods from `SettingsScreen.ts`:

- `_loadSubtitleLanguageValue`
- `_loadTranscodeQualityValue`
- `_saveTranscodeQualityValue`
- `_saveSubtitleLanguageValue`
- `_subtitleModeToValue`
- `_valueToSubtitleMode`
- `_loadSubtitleModeValue`
- `_saveSubtitleMode`
- `_getThemeIndex`

Delete these exact constants from `SettingsScreen.ts` because they now live in the controller:

- `SUBTITLE_LANGUAGE_OPTIONS`
- `SUBTITLE_MODE_OPTIONS`
- `EPG_PAST_ITEMS_OPTIONS`
- `DEFAULT_THEME_VALUE`

**Step 9: Delete the remaining state-refresh helpers**

Delete these exact methods from `SettingsScreen.ts`:

- `_notifyDebugLoggingChanged`
- `_refreshValues`
- `_updateSubtitleDependentControls`
- `_loadClampedNowPlayingAutoHide`

**Step 10: Remove unused imports**

Delete any imports that become unused after Steps 6 through 9.

Do not delete:

- `_toggleMetadata`
- `_selectMetadata`
- `TOGGLE_METADATA`
- `SELECT_METADATA`
- `_inferToggleMetadata()`
- `_inferSelectMetadata()`
- `_createItem()`

**Step 11: Remove the old `show()` refresh path**

Delete the `_refreshValues();` call from `show()`. The screen should now get fresh values by calling `_reloadCategoriesFromState()` before rendering.

**Step 12: Run the screen test file**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/settings/__tests__/SettingsScreen.test.ts
```

Expected: PASS

**Step 13: Run both settings test files together**

Run:

```bash
npm test -- --runTestsByPath src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts src/modules/ui/settings/__tests__/SettingsScreen.test.ts
```

Expected: PASS

**Step 14: Commit the screen refactor**

Run:

```bash
git add src/modules/ui/settings/SettingsScreen.ts src/modules/ui/settings/__tests__/SettingsScreen.test.ts
git commit -m "refactor: keep settings screen focused on view and navigation"
```

Expected: commit succeeds with the screen file and updated screen test.

## Task 5: Verify, Update The Checklist, And Finalize

**Files:**
- Modify: `ARCHITECTURE_CLEANUP_CHECKLIST.md`

**Step 1: Run the required repo verification**

Run:

```bash
npm run verify
```

Expected:

- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm run lint:css` PASS
- `npm run test:all` PASS
- `npm run build` PASS

**Step 2: Confirm the work stayed within the allowed file set**

Run:

```bash
git diff --name-only HEAD~2..HEAD
```

Expected output contains only:

- `src/modules/ui/settings/SettingsScreen.ts`
- `src/modules/ui/settings/SettingsScreenStateController.ts`
- `src/modules/ui/settings/__tests__/SettingsScreen.test.ts`
- `src/modules/ui/settings/__tests__/SettingsScreenStateController.test.ts`

If any CSS file, theme file, design doc, or extra source file appears here, stop and fix that before continuing.

**Step 3: Update the checklist item**

In `ARCHITECTURE_CLEANUP_CHECKLIST.md`, change this line:

```md
- [ ] P4-W1 - Split `SettingsScreen` into storage/state ownership vs view/focus ownership
```

to this exact line:

```md
- [x] P4-W1 - Split `SettingsScreen` into storage/state ownership vs view/focus ownership (done 2026-03-05; plan: docs/plans/2026-03-05-p4-w1-settings-screen-state-view-focus-split-implementation.md)
```

Do not make this edit until Step 1 passed.

**Step 4: Commit the verified delivery**

Run:

```bash
git add ARCHITECTURE_CLEANUP_CHECKLIST.md
git commit -m "refactor: split settings screen state from view focus"
```

Expected: commit succeeds and contains only the checklist update because the code commits already happened in Task 3 and Task 4.

## Expected End State

- `SettingsScreen` no longer reads persisted settings directly and no longer owns theme/subtitle/debug side-effect logic.
- `SettingsScreenStateController` is the single owner of settings-derived category state for this screen.
- The screen still preserves the current DOM structure, class names, D-pad behavior, dropdown lifecycle, and RAF cleanup behavior.
- Subtitle-mode changes rebuild the active category and preserve focus on the active control.
- The implementation changes only the five allowed files listed above.
- `ARCHITECTURE_CLEANUP_CHECKLIST.md` is updated only after verification passes.

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-05-p4-w1-settings-screen-state-view-focus-split-implementation.md`.

Two execution options:

**1. Subagent-Driven (this session)** - Use `superpowers:subagent-driven-development`, dispatch a fresh subagent per task, and review after each task.

**2. Parallel Session (separate)** - Open a new session in the dedicated worktree above and use `superpowers:executing-plans` to execute this plan task-by-task.

Which approach?
