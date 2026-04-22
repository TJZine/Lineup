import { DeveloperSettingsStore } from '../settings/DeveloperSettingsStore';
import { safeStringifyForLog } from '../../utils/redact';

type SubtitleDebugSettingsReader = Pick<
    DeveloperSettingsStore,
    'readSubtitleDebugLoggingEnabledAndClean'
>;

type SubtitleDebugContext = Record<string, unknown>;

type SubtitleDebugContextInput = SubtitleDebugContext | (() => SubtitleDebugContext);

export type SubtitleDebugSink = (scope: string, event: string, payload: string) => void;

export interface SubtitleDebugLoggerOptions {
    scope: string;
    sink?: SubtitleDebugSink;
    settingsReader?: SubtitleDebugSettingsReader;
}

function defaultSink(scope: string, event: string, payload: string): void {
    console.warn('subtitle_debug', scope, event, payload);
}

export class SubtitleDebugLogger {
    private readonly _scope: string;
    private readonly _sink: SubtitleDebugSink;
    private readonly _settingsReader: SubtitleDebugSettingsReader;

    constructor(options: SubtitleDebugLoggerOptions) {
        this._scope = options.scope;
        this._sink = options.sink ?? defaultSink;
        this._settingsReader = options.settingsReader ?? new DeveloperSettingsStore();
    }

    isEnabled(): boolean {
        try {
            return this._settingsReader.readSubtitleDebugLoggingEnabledAndClean(false);
        } catch {
            return false;
        }
    }

    log(event: string, context: SubtitleDebugContextInput): void {
        try {
            if (!this.isEnabled()) {
                return;
            }

            const resolvedContext = typeof context === 'function' ? context() : context;
            this._sink(this._scope, event, safeStringifyForLog(resolvedContext));
        } catch {
            // Ignore logging failures.
        }
    }
}
