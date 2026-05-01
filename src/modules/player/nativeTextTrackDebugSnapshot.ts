type NativeTextTrackDebugSnapshot = Array<Record<string, unknown>>;

export function snapshotNativeTextTracks(
    videoElement: HTMLVideoElement | null
): NativeTextTrackDebugSnapshot {
    if (!videoElement) return [];
    const list = videoElement.textTracks;
    const result: NativeTextTrackDebugSnapshot = [];
    for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t) continue;
        result.push({
            id: t.id,
            kind: t.kind,
            label: t.label,
            language: t.language,
            mode: t.mode,
            cuesLength: t.cues?.length ?? null,
            activeCuesLength: t.activeCues?.length ?? null,
        });
    }
    return result;
}
