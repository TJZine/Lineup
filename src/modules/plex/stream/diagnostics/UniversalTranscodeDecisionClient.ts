import { readBoundedResponseText } from '../../shared/boundedResponseText';
import { fetchWithTimeoutAndConsume } from '../../shared/fetchWithTimeout';
import type { StreamDecision, HlsOptions } from '../contracts/types';

type ParsedStreamDecision = NonNullable<NonNullable<StreamDecision['serverDecision']>['streams']>[number];
type ParsedServerDecision = Omit<NonNullable<StreamDecision['serverDecision']>, 'fetchedAt'>;

interface LightweightXmlElement {
    name: string;
    attributes: ReadonlyMap<string, string>;
    children: LightweightXmlElement[];
}

const UNIVERSAL_DECISION_MAX_RESPONSE_BYTES = 1024 * 1024;

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

        return fetchWithTimeoutAndConsume({
            url: this._toDecisionUrl(startUrl),
            init: { method: 'GET', headers: this._config.getAuthHeaders() },
            timeoutMs: 4000,
            consume: async (response, signal) => {
                this._config.throwIfAuthFailure(response);
                if (!response.ok) {
                    throw new Error(`PMS decision request failed: ${response.status}`);
                }

                const raw = await readBoundedResponseText(response, {
                    maxBytes: UNIVERSAL_DECISION_MAX_RESPONSE_BYTES,
                    signal,
                });
                return { fetchedAt: Date.now(), ...this._parseResponse(raw) };
            },
        });
    }

    private _toHlsOptions(
        request: NonNullable<StreamDecision['transcodeRequest']>
    ): HlsOptions {
        const hlsOptions: HlsOptions = {
            sessionId: request.sessionId,
            startOffsetMs: request.startOffsetMs,
            transcodeCompatMode: request.transcodeCompatMode,
            transcodeQuality: request.transcodeQuality,
        };
        if (typeof request.maxBitrate === 'number') {
            hlsOptions.maxBitrate = request.maxBitrate;
        }
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
    ): ParsedServerDecision {
        const Parser = globalThis.DOMParser;
        if (typeof Parser !== 'function') {
            return this._parseResponseWithoutDom(raw);
        }

        let doc: Document;
        try {
            doc = new Parser().parseFromString(raw, 'text/xml');
        } catch {
            return this._parseResponseWithoutDom(raw);
        }

        let invalidDocument: boolean;
        try {
            invalidDocument = this._hasParserError(doc) || doc.documentElement?.localName !== 'MediaContainer';
        } catch {
            invalidDocument = true;
        }
        if (invalidDocument) {
            throw this._invalidXmlError();
        }

        try {
            const container = doc.documentElement;
            const transcode = container.querySelector('TranscodeSession');
            const streams = transcode
                ? Array.from(transcode.querySelectorAll('Stream'))
                    .map((stream) => this._parseStreamDecisionElement(stream))
                    .filter((stream): stream is ParsedStreamDecision => stream !== null)
                : [];
            return this._buildParsedDecision(
                (name) => container.getAttribute(name) ?? undefined,
                (name) => transcode?.getAttribute(name) ?? undefined,
                streams
            );
        } catch {
            throw this._invalidXmlError();
        }
    }

    private _parseStreamDecisionElement(
        stream: Element
    ): ParsedStreamDecision | null {
        const id = stream.getAttribute('id') ?? undefined;
        const rawStreamType = stream.getAttribute('streamType');
        const streamType = rawStreamType === '1' || rawStreamType === '2' || rawStreamType === '3'
            ? Number(rawStreamType) as 1 | 2 | 3
            : undefined;
        const decision = stream.getAttribute('decision') ?? undefined;
        if (!id && streamType === undefined && !decision) {
            return null;
        }
        return {
            ...(id ? { id } : {}),
            ...(streamType !== undefined ? { streamType } : {}),
            ...(decision ? { decision } : {}),
        };
    }

    private _parseResponseWithoutDom(raw: string): ParsedServerDecision {
        const container = this._parseCompleteXml(raw);
        if (!container || container.name !== 'MediaContainer') {
            throw this._invalidXmlError();
        }

        const transcode = this._findFirstElement(container, 'TranscodeSession');
        const streams = transcode
            ? this._findElements(transcode, 'Stream')
                .map((stream) => this._parseStreamDecisionAttributes(stream.attributes))
                .filter((stream): stream is ParsedStreamDecision => stream !== null)
            : [];
        return this._buildParsedDecision(
            (name) => container.attributes.get(name),
            (name) => transcode?.attributes.get(name),
            streams
        );
    }

    private _hasParserError(doc: Document): boolean {
        const parserErrorNamespace = 'http://www.mozilla.org/newlayout/xml/parsererror.xml';
        if (!doc || !doc.documentElement) {
            return true;
        }
        return doc.documentElement.localName === 'parsererror' ||
            doc.documentElement.namespaceURI === parserErrorNamespace ||
            doc.getElementsByTagNameNS(parserErrorNamespace, 'parsererror').length > 0;
    }

    private _buildParsedDecision(
        containerAttribute: (name: string) => string | undefined,
        transcodeAttribute: (name: string) => string | undefined,
        streams: ParsedStreamDecision[]
    ): ParsedServerDecision {
        const decisionCode = containerAttribute('decisionCode') ??
            containerAttribute('generalDecisionCode') ?? transcodeAttribute('decisionCode');
        const decisionText = containerAttribute('decisionText') ??
            containerAttribute('generalDecisionText') ?? transcodeAttribute('decisionText');
        const videoDecision = transcodeAttribute('videoDecision') ?? containerAttribute('videoDecision');
        const audioDecision = transcodeAttribute('audioDecision') ?? containerAttribute('audioDecision');
        const subtitleDecision = transcodeAttribute('subtitleDecision') ?? containerAttribute('subtitleDecision');
        const result: ParsedServerDecision = {};
        if (decisionCode) result.decisionCode = decisionCode;
        if (decisionText) result.decisionText = decisionText;
        if (videoDecision) result.videoDecision = videoDecision;
        if (audioDecision) result.audioDecision = audioDecision;
        if (subtitleDecision) result.subtitleDecision = subtitleDecision;
        if (streams.length > 0) result.streams = streams;
        return result;
    }

    private _parseStreamDecisionAttributes(
        attributes: ReadonlyMap<string, string>
    ): ParsedStreamDecision | null {
        const id = attributes.get('id');
        const rawStreamType = attributes.get('streamType');
        const streamType = rawStreamType === '1' || rawStreamType === '2' || rawStreamType === '3'
            ? Number(rawStreamType) as 1 | 2 | 3
            : undefined;
        const decision = attributes.get('decision');
        if (!id && streamType === undefined && !decision) {
            return null;
        }
        return {
            ...(id ? { id } : {}),
            ...(streamType !== undefined ? { streamType } : {}),
            ...(decision ? { decision } : {}),
        };
    }

    private _parseCompleteXml(raw: string): LightweightXmlElement | null {
        const source = raw.trim();
        const tokenPattern = /<\?[^<>]*\?>|<!--[^]*?-->|<\/?([A-Za-z_][\w:.-]*)([^<>]*)>/g;
        const roots: LightweightXmlElement[] = [];
        const stack: LightweightXmlElement[] = [];
        let cursor = 0;
        let match: RegExpExecArray | null;

        while ((match = tokenPattern.exec(source)) !== null) {
            const gap = source.slice(cursor, match.index);
            if (gap.includes('<') || gap.includes('>')) return null;
            if (stack.length === 0 && gap.trim() !== '') return null;
            cursor = tokenPattern.lastIndex;
            const token = match[0];
            if (token.startsWith('<?') || token.startsWith('<!--')) continue;

            const name = match[1];
            if (!name) return null;
            if (token.startsWith('</')) {
                if (match[2]?.trim() !== '' || stack.at(-1)?.name !== name) return null;
                stack.pop();
                continue;
            }

            const selfClosing = /\/\s*>$/.test(token);
            const rawAttributes = (match[2] ?? '').replace(/\/\s*$/, '');
            const attributes = this._parseAttributes(rawAttributes);
            if (!attributes) return null;
            const element: LightweightXmlElement = { name, attributes, children: [] };
            const parent = stack.at(-1);
            if (parent) parent.children.push(element);
            else roots.push(element);
            if (!selfClosing) stack.push(element);
        }

        const tail = source.slice(cursor);
        if (tail.trim() !== '' || stack.length > 0 || roots.length !== 1) {
            return null;
        }
        return roots[0] ?? null;
    }

    private _parseAttributes(raw: string): ReadonlyMap<string, string> | null {
        const attributes = new Map<string, string>();
        const attributePattern = /\s+([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
        let cursor = 0;
        let match: RegExpExecArray | null;
        while ((match = attributePattern.exec(raw)) !== null) {
            if (raw.slice(cursor, match.index).trim() !== '') return null;
            const name = match[1];
            if (!name || attributes.has(name)) return null;
            const decodedValue = this._decodeXmlAttributeValue(match[2] ?? match[3] ?? '');
            if (decodedValue === null) return null;
            attributes.set(name, decodedValue);
            cursor = attributePattern.lastIndex;
        }
        return raw.slice(cursor).trim() === '' ? attributes : null;
    }

    private _decodeXmlAttributeValue(value: string): string | null {
        const referencePattern = /&([^&;]*);/g;
        let decoded = '';
        let cursor = 0;
        let match: RegExpExecArray | null;

        while ((match = referencePattern.exec(value)) !== null) {
            const literal = value.slice(cursor, match.index);
            if (literal.includes('&')) return null;
            const reference = match[1];
            if (!reference) return null;
            const replacement = reference.startsWith('#')
                ? this._decodeNumericCharacterReference(reference)
                : this._decodeNamedCharacterReference(reference);
            if (replacement === undefined || replacement === null) return null;
            decoded += literal + replacement;
            cursor = referencePattern.lastIndex;
        }

        const tail = value.slice(cursor);
        if (tail.includes('&')) return null;
        return decoded + tail;
    }

    private _decodeNamedCharacterReference(reference: string): string | undefined {
        switch (reference) {
            case 'amp': return '&';
            case 'lt': return '<';
            case 'gt': return '>';
            case 'quot': return '"';
            case 'apos': return "'";
            default: return undefined;
        }
    }

    private _decodeNumericCharacterReference(reference: string): string | null {
        const isHex = reference.startsWith('#x');
        const digits = reference.slice(isHex ? 2 : 1);
        const validDigits = isHex ? /^[0-9A-Fa-f]+$/.test(digits) : /^[0-9]+$/.test(digits);
        if (!validDigits) return null;

        const codePoint = Number.parseInt(digits, isHex ? 16 : 10);
        const validXmlCodePoint = codePoint === 0x9 || codePoint === 0xA || codePoint === 0xD ||
            (codePoint >= 0x20 && codePoint <= 0xD7FF) ||
            (codePoint >= 0xE000 && codePoint <= 0xFFFD) ||
            (codePoint >= 0x10000 && codePoint <= 0x10FFFF);
        return validXmlCodePoint ? String.fromCodePoint(codePoint) : null;
    }

    private _findFirstElement(
        root: LightweightXmlElement,
        name: string
    ): LightweightXmlElement | undefined {
        const pending = [...root.children].reverse();
        while (pending.length > 0) {
            const element = pending.pop();
            if (!element) continue;
            if (element.name === name) return element;
            for (let index = element.children.length - 1; index >= 0; index -= 1) {
                const child = element.children[index];
                if (child) pending.push(child);
            }
        }
        return undefined;
    }

    private _findElements(
        root: LightweightXmlElement,
        name: string
    ): LightweightXmlElement[] {
        const matches: LightweightXmlElement[] = [];
        const pending = [...root.children].reverse();
        while (pending.length > 0) {
            const element = pending.pop();
            if (!element) continue;
            if (element.name === name) matches.push(element);
            for (let index = element.children.length - 1; index >= 0; index -= 1) {
                const child = element.children[index];
                if (child) pending.push(child);
            }
        }
        return matches;
    }

    private _invalidXmlError(): Error {
        return new Error('Invalid universal transcode decision XML');
    }
}

export function isSubtitleBurnConfirmedByServerDecision(
    request: NonNullable<StreamDecision['transcodeRequest']>,
    serverDecision: NonNullable<StreamDecision['serverDecision']>
): boolean {
    if (request.subtitleMode !== 'burn' || !request.subtitleStreamId) {
        return false;
    }

    return getSubtitleStreamServerDecision(
        serverDecision,
        request.subtitleStreamId
    ) === 'burn';
}

export function getSubtitleStreamServerDecision(
    serverDecision: NonNullable<StreamDecision['serverDecision']> | null | undefined,
    subtitleStreamId: string | null | undefined
): string | null {
    if (!serverDecision || !subtitleStreamId) {
        return null;
    }

    const selectedSubtitleDecision = serverDecision.streams?.find((stream) =>
        stream.streamType === 3 &&
        stream.id === subtitleStreamId
    );
    return selectedSubtitleDecision?.decision ?? null;
}

export function applyServerDecisionToStreamDecision(
    decision: StreamDecision,
    serverDecision: NonNullable<StreamDecision['serverDecision']>
): void {
    decision.serverDecision = serverDecision;
    if (!decision.subtitleBurnIn || !decision.transcodeRequest) {
        return;
    }

    decision.subtitleBurnIn.confirmed = isSubtitleBurnConfirmedByServerDecision(
        decision.transcodeRequest,
        serverDecision
    );
}
