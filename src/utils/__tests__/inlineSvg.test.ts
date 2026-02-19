/**
 * @jest-environment jsdom
 */

import { setTrustedInlineSvg } from '../inlineSvg';

describe('setTrustedInlineSvg', () => {
    it('renders a simple svg element into the container', () => {
        const container = document.createElement('span');
        setTrustedInlineSvg(container, '<svg viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>');
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
    });

    it('clears the container when markup is empty or whitespace', () => {
        const container = document.createElement('span');
        container.textContent = 'x';
        setTrustedInlineSvg(container, '');
        expect(container.childNodes.length).toBe(0);

        container.textContent = 'x';
        setTrustedInlineSvg(container, '   ');
        expect(container.childNodes.length).toBe(0);
    });

    it('rejects svg markup containing <script>', () => {
        const container = document.createElement('span');
        container.textContent = 'x';
        setTrustedInlineSvg(container, '<svg><script>alert(1)</script></svg>');
        expect(container.querySelector('svg')).toBeNull();
        expect(container.childNodes.length).toBe(0);
    });

    it('rejects svg markup containing <foreignObject>', () => {
        const container = document.createElement('span');
        setTrustedInlineSvg(container, '<svg><foreignObject></foreignObject></svg>');
        expect(container.querySelector('svg')).toBeNull();
        expect(container.childNodes.length).toBe(0);
    });

    it('rejects svg markup containing <iframe> or <object>', () => {
        const container = document.createElement('span');
        setTrustedInlineSvg(container, '<svg><iframe></iframe></svg>');
        expect(container.querySelector('svg')).toBeNull();
        expect(container.childNodes.length).toBe(0);

        setTrustedInlineSvg(container, '<svg><object></object></svg>');
        expect(container.querySelector('svg')).toBeNull();
        expect(container.childNodes.length).toBe(0);
    });

    it('rejects svg markup with event handler attributes', () => {
        const container = document.createElement('span');
        setTrustedInlineSvg(container, '<svg onload="alert(1)"></svg>');
        expect(container.querySelector('svg')).toBeNull();
        expect(container.childNodes.length).toBe(0);
    });

    it('rejects svg markup with javascript: URIs', () => {
        const container = document.createElement('span');
        setTrustedInlineSvg(container, '<svg><a href="javascript:alert(1)">x</a></svg>');
        expect(container.querySelector('svg')).toBeNull();
        expect(container.childNodes.length).toBe(0);
    });

    it('rejects svg markup with data: URIs', () => {
        const container = document.createElement('span');
        setTrustedInlineSvg(container, '<svg><a href="data:text/html;base64,PHg+PC94Pg==">x</a></svg>');
        expect(container.querySelector('svg')).toBeNull();
        expect(container.childNodes.length).toBe(0);
    });

    it('rejects xlink:href and src javascript: URIs', () => {
        const container = document.createElement('span');
        setTrustedInlineSvg(
            container,
            '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="javascript:alert(1)">x</a></svg>'
        );
        expect(container.querySelector('svg')).toBeNull();
        expect(container.childNodes.length).toBe(0);

        setTrustedInlineSvg(container, '<svg><image src="javascript:alert(1)"></image></svg>');
        expect(container.querySelector('svg')).toBeNull();
        expect(container.childNodes.length).toBe(0);
    });
});
