import type { PlexHomeUser } from '../../plex/auth';

const SVG_NS = 'http://www.w3.org/2000/svg';

function createPersonGlyph(): SVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const head = document.createElementNS(SVG_NS, 'circle');
    head.setAttribute('cx', '32');
    head.setAttribute('cy', '23');
    head.setAttribute('r', '10');

    const shoulders = document.createElementNS(SVG_NS, 'path');
    shoulders.setAttribute('d', 'M11 55c2-12 10-18 21-18s19 6 21 18');
    svg.append(head, shoulders);
    return svg;
}

function createLockGlyph(): SVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const shackle = document.createElementNS(SVG_NS, 'path');
    shackle.setAttribute('d', 'M7 10V7a5 5 0 0 1 10 0v3');
    const body = document.createElementNS(SVG_NS, 'rect');
    body.setAttribute('x', '4');
    body.setAttribute('y', '10');
    body.setAttribute('width', '16');
    body.setAttribute('height', '12');
    body.setAttribute('rx', '2');
    svg.append(shackle, body);
    return svg;
}

export const renderProfilePinUserHeader = (container: HTMLElement, user: PlexHomeUser): void => {
    container.replaceChildren();

    const avatar = document.createElement('div');
    avatar.className = 'profile-pin-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.appendChild(createPersonGlyph());

    const lock = document.createElement('span');
    lock.className = 'profile-pin-lock-badge';
    lock.setAttribute('aria-hidden', 'true');
    lock.appendChild(createLockGlyph());
    avatar.appendChild(lock);

    const name = document.createElement('div');
    name.className = 'profile-pin-name';
    name.id = 'profile-pin-user-name';
    name.textContent = user.title;

    container.append(avatar, name);
};
