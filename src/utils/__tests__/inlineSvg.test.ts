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
    });

    it('rejects svg markup with event handler attributes', () => {
        const container = document.createElement('span');
        setTrustedInlineSvg(container, '<svg onload="alert(1)"></svg>');
        expect(container.querySelector('svg')).toBeNull();
    });

    it('rejects svg markup with javascript: URIs', () => {
        const container = document.createElement('span');
        setTrustedInlineSvg(container, '<svg><a href="javascript:alert(1)">x</a></svg>');
        expect(container.querySelector('svg')).toBeNull();
    });
});

