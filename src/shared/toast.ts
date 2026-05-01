const TOAST_TYPES = ['info', 'success', 'warning', 'error'] as const;

export type ToastType = typeof TOAST_TYPES[number];

type ToastPayload = {
    message: string;
    type?: ToastType;
};

export type ToastInput = ToastPayload;

export function normalizeToastInput(input: ToastInput): { message: string; type: ToastType } {
    const message = input.message;
    const rawType = input.type;
    const type = rawType && TOAST_TYPES.includes(rawType) ? rawType : 'info';
    return { message, type };
}
