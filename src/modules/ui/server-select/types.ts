export type ServerSelectHealthRecord = {
    status?: string;
    type?: string;
    latencyMs?: number;
    testedAt?: number;
};

export type ServerSelectDisplayState = {
    selectedServerId: string | null;
    serverHealth: Record<string, ServerSelectHealthRecord | undefined>;
};
