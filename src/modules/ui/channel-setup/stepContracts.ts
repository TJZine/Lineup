export interface StepRenderContext {
    contentEl: HTMLElement;
    stepEl: HTMLElement;
    statusEl: HTMLElement;
    detailEl: HTMLElement;
    errorEl: HTMLElement;
}

export interface StrategyStepDropdownConfig {
    anchorId: string;
    options: Array<{ label: string; value: string }>;
    currentValue: string;
    onSelect: (value: string) => void;
}
