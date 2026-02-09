export function fnv1a32Uint(input: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

export function fnv1a32Hex(input: string): string {
    return fnv1a32Uint(input).toString(16).padStart(8, '0');
}

