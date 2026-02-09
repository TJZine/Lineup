import { fnv1a32Hex } from './hash';

export function sanitizeDomIdToken(value: string): string {
    const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '_');
    return sanitized || 'unknown';
}

export function buildDeterministicButtonIds(prefix: string, rawIds: string[]): string[] {
    const usedIds = new Set<string>();

    return rawIds.map((rawId) => {
        const sanitized = sanitizeDomIdToken(rawId);
        const baseId = `${prefix}${sanitized}`;
        if (!usedIds.has(baseId)) {
            usedIds.add(baseId);
            return baseId;
        }

        const hashedId = `${baseId}-${fnv1a32Hex(rawId)}`;
        if (!usedIds.has(hashedId)) {
            usedIds.add(hashedId);
            return hashedId;
        }

        let suffix = 2;
        let deduped = `${hashedId}-${suffix}`;
        while (usedIds.has(deduped)) {
            suffix += 1;
            deduped = `${hashedId}-${suffix}`;
        }
        usedIds.add(deduped);
        return deduped;
    });
}

