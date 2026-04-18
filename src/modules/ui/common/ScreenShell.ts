import type { ScreenShellProps } from '../types/screen-shell';
import { createScreenShellView, type ScreenShellView } from './ScreenShellView';

type ScreenShellHandles = ScreenShellView;

export function createScreenShell(container: HTMLElement, props: ScreenShellProps): ScreenShellHandles {
    const shell = createScreenShellView(props);
    container.appendChild(shell.panelEl);
    return shell;
}
