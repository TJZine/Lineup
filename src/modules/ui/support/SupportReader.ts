import type { INavigationManager } from '../../navigation';

const MODAL_ID = 'settings-support-reader';
const BODY_ID = 'support-reader-body';
const CLOSE_ID = 'support-reader-close';

/** Local text reader shared by the report and packaged notices. */
export class SupportReader {
    private root: HTMLElement | null = null;
    private invokerId: string | null = null;
    private navOwner: INavigationManager | null = null;
    private readonly modalCloseHandler = ({ modalId }: { modalId: string }): void => {
        if (modalId === MODAL_ID) this.finishClose(false);
    };

    constructor(
        private readonly host: HTMLElement,
        private readonly getNavigation: () => INavigationManager | null,
        private readonly restore: (id: string | null) => void
    ) {}

    public open(title: string, text: string, invokerId: string): boolean {
        if (this.root) this.close();
        const nav = this.getNavigation();
        if (!nav || nav.isModalOpen()) return false;

        const root = document.createElement('section');
        root.className = 'support-reader';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', title);
        const heading = document.createElement('h2');
        heading.textContent = title;
        const body = document.createElement('pre');
        body.className = 'support-reader-body';
        body.id = BODY_ID;
        body.tabIndex = 0;
        body.textContent = text;
        const close = document.createElement('button');
        close.id = CLOSE_ID;
        close.textContent = 'Back to Support';
        close.addEventListener('click', () => this.close());
        root.append(heading, body, close);
        this.host.append(root);
        this.root = root;
        this.invokerId = invokerId;
        this.navOwner = nav;

        nav.on('modalClose', this.modalCloseHandler);
        nav.registerFocusable({ id: body.id, element: body,
            neighbors: { right: close.id },
            onSelect: () => { body.scrollTop += body.clientHeight * 0.8; },
        });
        nav.registerFocusable({ id: close.id, element: close,
            neighbors: { left: body.id }, onSelect: () => this.close(),
        });
        nav.openModal(MODAL_ID, [body.id, close.id], {
            dismissOnBack: true,
            blocksBackgroundCommands: true,
        });
        if (!nav.isModalOpen(MODAL_ID)) {
            this.finishClose(false);
            return false;
        }
        nav.setFocus(body.id);
        body.focus();
        body.addEventListener('keydown', (event) => {
            const down = event.key === 'ArrowDown' || event.key === 'PageDown' || event.keyCode === 40;
            const up = event.key === 'ArrowUp' || event.key === 'PageUp' || event.keyCode === 38;
            if (down || up) {
                event.preventDefault();
                event.stopPropagation();
                body.scrollTop += down ? 80 : -80;
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.close();
            }
        });
        return true;
    }

    public close(): void {
        this.finishClose(true);
    }

    private finishClose(closeModal: boolean): void {
        if (!this.root) return;
        const nav = this.navOwner;
        nav?.off('modalClose', this.modalCloseHandler);
        nav?.unregisterFocusable(BODY_ID);
        nav?.unregisterFocusable(CLOSE_ID);
        this.root.remove();
        this.root = null;
        this.navOwner = null;
        const invokerId = this.invokerId;
        this.invokerId = null;
        if (closeModal && nav?.isModalOpen(MODAL_ID)) nav.closeModal(MODAL_ID);
        this.restore(invokerId);
    }
}
