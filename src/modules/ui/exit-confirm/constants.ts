export const EXIT_CONFIRM_CONTAINER_ID = 'exit-confirm-container' as const;

export const EXIT_CONFIRM_MODAL_ID = 'exit-confirm' as const;

export const EXIT_CONFIRM_ACTION_IDS = {
    cancel: 'exit-confirm-cancel',
    exit: 'exit-confirm-exit',
} as const;

export const EXIT_CONFIRM_FOCUSABLE_IDS = [
    EXIT_CONFIRM_ACTION_IDS.cancel,
    EXIT_CONFIRM_ACTION_IDS.exit,
] as const;

