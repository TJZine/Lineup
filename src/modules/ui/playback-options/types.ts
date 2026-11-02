export type PlaybackOptionsSectionId = 'subtitles' | 'audio';

export interface PlaybackOptionsItem {
    id: string;
    label: string;
    meta?: string;
    state?: string;
    selected?: boolean;
    disabled?: boolean;
    blocked?: boolean;
    onSelect: () => void;
    onBlockedSelect?: () => void;
}

export interface PlaybackOptionsSection {
    title: string;
    options: PlaybackOptionsItem[];
    helperText?: string;
    emptyMessage?: string;
    modeOptions?: PlaybackOptionsItem[];
}

export interface PlaybackOptionsViewModel {
    title: string;
    subtitles: PlaybackOptionsSection;
    audio: PlaybackOptionsSection;
}
