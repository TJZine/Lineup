import { createDropdownPopover } from '../common/CreateDropdownPopover';
import type { INavigationManager } from '../../navigation/contracts/interfaces';
import type { StrategyStepDropdownConfig } from './stepContracts';

type ActiveDropdown = { destroy: () => void; dismiss: () => void };

export class ChannelSetupDropdownController {
    private _activeDropdown: ActiveDropdown | null = null;
    private _pendingDeferredRender = false;

    hasActiveDropdown(): boolean {
        return this._activeDropdown !== null;
    }

    deferRender(): void {
        this._pendingDeferredRender = true;
    }

    close(): void {
        if (!this._activeDropdown) {
            return;
        }
        const dropdown = this._activeDropdown;
        this._activeDropdown = null;
        dropdown.destroy();
    }

    reset(): void {
        this.close();
        this._pendingDeferredRender = false;
    }

    flushDeferredRender(renderStep: () => void): void {
        if (!this._pendingDeferredRender) {
            return;
        }
        this._pendingDeferredRender = false;
        renderStep();
    }

    dismiss(renderStep: () => void): void {
        if (!this._activeDropdown) {
            return;
        }
        const dropdown = this._activeDropdown;
        try {
            dropdown.dismiss();
        } finally {
            if (this._activeDropdown === dropdown) {
                this._activeDropdown = null;
            }
        }
        this.flushDeferredRender(renderStep);
    }

    open(
        config: StrategyStepDropdownConfig,
        deps: {
            container: HTMLElement;
            nav: INavigationManager | null;
            setPreferredFocusId: (focusId: string | null) => void;
            renderStep: () => void;
        }
    ): void {
        this.close();
        const anchor = document.getElementById(config.anchorId);
        if (!(anchor instanceof HTMLElement)) {
            return;
        }
        this._activeDropdown = createDropdownPopover({
            anchor,
            container: deps.container,
            options: config.options,
            currentValue: config.currentValue,
            onSelect: (value) => {
                try {
                    config.onSelect(value);
                } finally {
                    this.close();
                    deps.setPreferredFocusId(config.anchorId);
                    this.flushDeferredRender(deps.renderStep);
                }
            },
            onDismiss: () => {
                deps.nav?.setFocus(config.anchorId);
            },
            nav: deps.nav,
            cssClass: 'setup-dropdown',
            optionCssClass: 'setup-dropdown-option',
        });
    }
}
