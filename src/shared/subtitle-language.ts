export interface SubtitleLanguageDefinition {
    code: string;
    label: string;
    aliases: readonly string[];
}

export const SUPPORTED_SUBTITLE_LANGUAGES = [
    { code: 'en', label: 'English', aliases: ['eng', 'english'] },
    { code: 'es', label: 'Spanish', aliases: ['spa', 'esp', 'spanish'] },
    { code: 'fr', label: 'French', aliases: ['fre', 'fra', 'french'] },
    { code: 'de', label: 'German', aliases: ['ger', 'deu', 'german'] },
    { code: 'it', label: 'Italian', aliases: ['ita', 'italian'] },
    { code: 'pt', label: 'Portuguese', aliases: ['por', 'portuguese'] },
    { code: 'ru', label: 'Russian', aliases: ['rus', 'russian'] },
    { code: 'ja', label: 'Japanese', aliases: ['jpn', 'japanese'] },
    { code: 'ko', label: 'Korean', aliases: ['kor', 'korean'] },
    { code: 'zh', label: 'Chinese', aliases: ['chi', 'zho', 'chinese'] },
] as const satisfies readonly SubtitleLanguageDefinition[];

const SUBTITLE_LANGUAGE_ALIAS_TO_CODE = new Map<string, string>(
    SUPPORTED_SUBTITLE_LANGUAGES.flatMap((language) => [
        [language.code, language.code] as const,
        [language.label.toLowerCase(), language.code] as const,
        ...language.aliases.map((alias) => [alias.toLowerCase(), language.code] as const),
    ])
);

export function normalizeSubtitleLanguage(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized.length === 0) {
        return null;
    }
    return SUBTITLE_LANGUAGE_ALIAS_TO_CODE.get(normalized) ?? normalized;
}
