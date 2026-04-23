# Private Probe Owner Notes

| Key | Owner | Rationale | Revisit Trigger | Cleanup Lane |
| --- | --- | --- | --- | --- |
| `src/modules/navigation/__tests__/NavigationManager.test.ts\|nav\|_focusManager` | `src/modules/navigation/__tests__/NavigationManager.test.ts` | The suite still inspects the private focus-manager seam to confirm focus handoff side effects. | Remove when focus transitions are asserted through public navigation state or DOM-visible focus behavior. | `T5-W2` |
| `src/modules/ui/epg/__tests__/EPGScheduleCacheStore.test.ts\|store\|_loadedRangeKeyByChannel` | `src/modules/ui/epg/__tests__/EPGScheduleCacheStore.test.ts` | Cache-coverage assertions still read the private loaded-range map directly. | Remove when cache-hit/miss behavior is proven through public store outputs rather than internal map state. | `T5-W2` |
