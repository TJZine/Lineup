import { fetchWithTimeout } from '../../shared/fetchWithTimeout';
import type { StreamDecision, HlsOptions } from '../contracts/types';

interface UniversalTranscodeDecisionClientConfig {
    getAuthHeaders: () => Record<string, string>;
    getTranscodeUrl: (itemKey: string, options: HlsOptions) => string;
    throwIfAuthFailure: (response: Response) => void;
}

export class UniversalTranscodeDecisionClient {
    constructor(private readonly _config: UniversalTranscodeDecisionClientConfig) { }

    async fetchDecision(
        itemKey: string,
        request: NonNullable<StreamDecision['transcodeRequest']>
    ): Promise<NonNullable<StreamDecision['serverDecision']>> {
        const startUrl = this._config.getTranscodeUrl(
            itemKey,
            this._toHlsOptions(request)
        );

        const response = await fetchWithTimeout({
            url: this._toDecisionUrl(startUrl),
            init: { method: 'GET', headers: this._config.getAuthHeaders() },
            timeoutMs: 4000,
        });
        this._config.throwIfAuthFailure(response);
        if (!response.ok) {
            throw new Error(`PMS decision request failed: ${response.status}`);
        }

        const raw = await response.text();
        return { fetchedAt: Date.now(), ...this._parseResponse(raw) };
    }

    private _toHlsOptions(
        request: NonNullable<StreamDecision['transcodeRequest']>
    ): HlsOptions {
        const hlsOptions: HlsOptions = {
            sessionId: request.sessionId,
            maxBitrate: request.maxBitrate,
        };
        if (typeof request.mediaIndex === 'number') {
            hlsOptions.mediaIndex = request.mediaIndex;
        }
        if (typeof request.partIndex === 'number') {
            hlsOptions.partIndex = request.partIndex;
        }
        if (typeof request.audioStreamId === 'string') {
            hlsOptions.audioStreamId = request.audioStreamId;
        }
        if (typeof request.subtitleStreamId === 'string') {
            hlsOptions.subtitleStreamId = request.subtitleStreamId;
        }
        if (request.subtitleMode === 'burn') {
            hlsOptions.subtitleMode = 'burn';
        }
        if (request.hideDolbyVision === true) {
            hlsOptions.hideDolbyVision = true;
        }
        return hlsOptions;
    }

    private _toDecisionUrl(startUrl: string): string {
        const url = new URL(startUrl);
        url.pathname = '/video/:/transcode/universal/decision';
        return url.toString();
    }

    private _parseResponse(
        raw: string
    ): Omit<NonNullable<StreamDecision['serverDecision']>, 'fetchedAt'> {
        try {
            if (typeof DOMParser !== 'undefined') {
                const doc = new DOMParser().parseFromString(raw, 'text/xml');
                if (doc.querySelector('parsererror')) {
                    throw new Error('Invalid universal transcode decision XML');
                }
                const container = doc.querySelector('MediaContainer');
                const transcode = doc.querySelector('TranscodeSession');

                const decisionCode =
                    container?.getAttribute('decisionCode') ??
                    transcode?.getAttribute('decisionCode') ??
                    undefined;
                const decisionText =
                    container?.getAttribute('decisionText') ??
                    container?.getAttribute('generalDecisionText') ??
                    transcode?.getAttribute('decisionText') ??
                    undefined;

                const videoDecision =
                    transcode?.getAttribute('videoDecision') ??
                    container?.getAttribute('videoDecision') ??
                    undefined;
                const audioDecision =
                    transcode?.getAttribute('audioDecision') ??
                    container?.getAttribute('audioDecision') ??
                    undefined;
                const subtitleDecision =
                    transcode?.getAttribute('subtitleDecision') ??
                    container?.getAttribute('subtitleDecision') ??
                    undefined;

                const result: Record<string, string> = {};
                if (decisionCode) result.decisionCode = decisionCode;
                if (decisionText) result.decisionText = decisionText;
                if (videoDecision) result.videoDecision = videoDecision;
                if (audioDecision) result.audioDecision = audioDecision;
                if (subtitleDecision) result.subtitleDecision = subtitleDecision;
                return result as Omit<NonNullable<StreamDecision['serverDecision']>, 'fetchedAt'>;
            }
        } catch {
            // Fall through to lightweight attribute parsing.
        }

        type DecisionAttributeName =
            | 'decisionCode'
            | 'generalDecisionCode'
            | 'decisionText'
            | 'generalDecisionText'
            | 'videoDecision'
            | 'audioDecision'
            | 'subtitleDecision';

        const attr = (name: DecisionAttributeName): string | undefined => {
            const marker = `${name}="`;
            const markerStart = raw.indexOf(marker);
            if (markerStart < 0) {
                return undefined;
            }

            const valueStart = markerStart + marker.length;
            const valueEnd = raw.indexOf('"', valueStart);
            if (valueEnd < 0) {
                return undefined;
            }

            return raw.slice(valueStart, valueEnd);
        };
        const decisionCode = attr('decisionCode') ?? attr('generalDecisionCode');
        const decisionText = attr('decisionText') ?? attr('generalDecisionText');
        const videoDecision = attr('videoDecision');
        const audioDecision = attr('audioDecision');
        const subtitleDecision = attr('subtitleDecision');

        const result: Record<string, string> = {};
        if (decisionCode) result.decisionCode = decisionCode;
        if (decisionText) result.decisionText = decisionText;
        if (videoDecision) result.videoDecision = videoDecision;
        if (audioDecision) result.audioDecision = audioDecision;
        if (subtitleDecision) result.subtitleDecision = subtitleDecision;
        return result as Omit<NonNullable<StreamDecision['serverDecision']>, 'fetchedAt'>;
    }
}
