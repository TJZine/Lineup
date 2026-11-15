/** Grid gap support does not imply flex gap support on the oldest supported webOS engine. */
export function installLayoutCapabilities(): void {
    const probe = document.createElement('div');
    probe.style.display = 'flex';
    probe.style.flexDirection = 'column';
    probe.style.rowGap = '1px';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.appendChild(document.createElement('div'));
    probe.appendChild(document.createElement('div'));
    document.body.appendChild(probe);

    try {
        document.documentElement.classList.toggle('no-flex-gap', probe.scrollHeight !== 1);
    } finally {
        probe.remove();
    }
}
