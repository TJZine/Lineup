export type MockTextTrackInput = {
    id: string;
    kind: TextTrackKind;
    label: string;
    language: string;
    mode: TextTrackMode;
    cuesLength?: number | null;
    activeCuesLength?: number | null;
};

export function installMockTextTracks(
    video: HTMLVideoElement,
    tracks: MockTextTrackInput[]
): void {
    const mockTextTracks: Record<number, unknown> & {
        length: number;
        item: (index: number) => TextTrack | null;
    } = {
        length: tracks.length,
        item: jest.fn((index: number) => (mockTextTracks[index] as TextTrack | undefined) ?? null),
    };

    tracks.forEach((track, index) => {
        mockTextTracks[index] = {
            id: track.id,
            kind: track.kind,
            label: track.label,
            language: track.language,
            mode: track.mode,
            cues: track.cuesLength === null
                ? null
                : { length: track.cuesLength ?? 0 },
            activeCues: track.activeCuesLength === null
                ? null
                : { length: track.activeCuesLength ?? 0 },
        };
    });

    Object.defineProperty(video, 'textTracks', {
        get: (): TextTrackList => mockTextTracks as unknown as TextTrackList,
        configurable: true,
    });
}
