# Private Probe Owner Notes

| Key | Owner | Rationale | Revisit Trigger | Cleanup Lane |
| --- | --- | --- | --- | --- |
| `src/modules/ui/epg/__tests__/EPGScheduleCacheStore.test.ts\|store\|_loadedRangeKeyByChannel` | `src/modules/ui/epg/__tests__/EPGScheduleCacheStore.test.ts` | Cache-coverage assertions still read the private loaded-range map directly. | Remove when cache-hit/miss behavior is proven through public store outputs rather than internal map state. | `T5-W2` |
