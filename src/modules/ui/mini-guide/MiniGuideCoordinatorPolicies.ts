export const shouldApplyMiniGuideRowUpdate = (args: {
    expectedToken: number;
    currentToken: number;
    overlayVisible: boolean;
    currentRowChannelId: string | null;
    nextRowChannelId: string;
}): boolean => {
    if (!args.overlayVisible) {
        return false;
    }
    if (args.expectedToken !== args.currentToken) {
        return false;
    }
    if (!args.currentRowChannelId) {
        return false;
    }
    return args.currentRowChannelId === args.nextRowChannelId;
};
