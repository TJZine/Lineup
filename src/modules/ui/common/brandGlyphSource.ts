export type BrandGlyphVariant = 'monochrome' | 'color';

/**
 * Canonical Lineup glyph SVG source.
 * Keep this module as the single editable source of truth.
 * `assets/branding/lineup-glyph*.svg` mirror this markup for design/reference use.
 */
export const LINEUP_GLYPH_SOURCE_BY_VARIANT: Record<BrandGlyphVariant, string> = {
    monochrome: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" fill="none">
  <!-- Source of truth: src/modules/ui/common/brandGlyphSource.ts -->
  <!-- Lineup glyph — MONOCHROME, production-grade -->
  <!-- Uses currentColor — inherits text color from CSS -->

  <defs>
    <filter id="sh-back" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="3" dy="2.5" stdDeviation="3" flood-color="black" flood-opacity="0.8"/>
    </filter>
    <filter id="sh-mid" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="3.5" dy="2.5" stdDeviation="3.5" flood-color="black" flood-opacity="0.75"/>
    </filter>
    <filter id="sh-front" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="4" dy="3" stdDeviation="4" flood-color="black" flood-opacity="0.75"/>
    </filter>
  </defs>

  <g transform="translate(10, 12) skewY(-10)">
    <!-- Back card — deepest, peeks above and left -->
    <rect x="3" y="6" width="22" height="33" rx="5.5" fill="currentColor" opacity="0.3" filter="url(#sh-back)"/>
    <rect x="3" y="6" width="22" height="33" rx="5.5" fill="none"
          stroke="currentColor" stroke-width="0.8" stroke-opacity="0.2"/>

    <!-- Middle card — medium depth -->
    <rect x="11" y="11" width="23" height="34" rx="6" fill="currentColor" opacity="0.55" filter="url(#sh-mid)"/>
    <rect x="11" y="11" width="23" height="34" rx="6" fill="none"
          stroke="currentColor" stroke-width="0.8" stroke-opacity="0.25"/>

    <!-- Front card — full opacity -->
    <rect x="19" y="16" width="25" height="36" rx="6.5" fill="currentColor" opacity="1" filter="url(#sh-front)"/>

    <!-- Front card edge highlight -->
    <rect x="19" y="16" width="25" height="36" rx="6.5" fill="none"
          stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  </g>
</svg>`,
    color: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" fill="none">
  <!-- Source of truth: src/modules/ui/common/brandGlyphSource.ts -->
  <!-- Lineup glyph — FULL COLOR, production-grade -->

  <defs>
    <!-- Extrusion shadows applied to thickness plates -->
    <filter id="sh-back-col" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="2" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity="0.85"/>
    </filter>
    <filter id="sh-mid-col" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="2.5" dy="2.5" stdDeviation="3" flood-color="#000" flood-opacity="0.8"/>
    </filter>
    <filter id="sh-front-col" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="4" dy="3.5" stdDeviation="5" flood-color="#000" flood-opacity="0.85"/>
      <feDropShadow dx="1.5" dy="1.5" stdDeviation="1.5" flood-color="#000" flood-opacity="0.95"/>
    </filter>
    <filter id="rim-blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1"/>
    </filter>

    <radialGradient id="gold-face" cx="30%" cy="20%" r="80%" fx="20%" fy="10%">
      <stop offset="0%" stop-color="#ffea90"/>
      <stop offset="30%" stop-color="#e8b630"/>
      <stop offset="70%" stop-color="#a86815"/>
      <stop offset="100%" stop-color="#6a3504"/>
    </radialGradient>

    <linearGradient id="amber-rim" x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#fff0b0"/>
      <stop offset="15%" stop-color="#ffcf40"/>
      <stop offset="60%" stop-color="#d07508"/>
      <stop offset="100%" stop-color="#5a2a00"/>
    </linearGradient>

    <!-- Metallic sheen for mid and back plates -->
    <radialGradient id="steel-mid" cx="30%" cy="20%" r="80%" fx="20%" fy="10%">
      <stop offset="0%" stop-color="#7a7a7a"/>
      <stop offset="45%" stop-color="#4a4a4a"/>
      <stop offset="100%" stop-color="#2a2a2a"/>
    </radialGradient>
    <linearGradient id="steel-mid-rim" x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#a0a0a0"/>
      <stop offset="100%" stop-color="#202020"/>
    </linearGradient>

    <radialGradient id="steel-back" cx="30%" cy="20%" r="80%" fx="20%" fy="10%">
      <stop offset="0%" stop-color="#4a4a4a"/>
      <stop offset="50%" stop-color="#2a2a2a"/>
      <stop offset="100%" stop-color="#111"/>
    </radialGradient>
    <linearGradient id="steel-back-rim" x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#606060"/>
      <stop offset="100%" stop-color="#151515"/>
    </linearGradient>
  </defs>

  <g transform="translate(10, 12) skewY(-10)">
    <!-- BACK CARD -->
    <!-- Thickness extrusion with shadow -->
    <rect x="3.8" y="6.8" width="22" height="33" rx="5.5" fill="#0d0d0d" filter="url(#sh-back-col)"/>
    <!-- Face -->
    <rect x="3" y="6" width="22" height="33" rx="5.5" fill="url(#steel-back)"/>
    <rect x="3" y="6" width="22" height="33" rx="5.5" fill="none" stroke="url(#steel-back-rim)" stroke-width="0.8" stroke-opacity="0.9"/>
    
    <!-- MIDDLE CARD -->
    <!-- Thickness extrusion with shadow -->
    <rect x="12" y="12" width="23" height="34" rx="6" fill="#181818" filter="url(#sh-mid-col)"/>
    <!-- Face -->
    <rect x="11" y="11" width="23" height="34" rx="6" fill="url(#steel-mid)"/>
    <rect x="11" y="11" width="23" height="34" rx="6" fill="none" stroke="url(#steel-mid-rim)" stroke-width="0.8" stroke-opacity="0.95"/>
    
    <!-- FRONT CARD -->
    <!-- Thickness extrusion with shadow -->
    <rect x="20" y="17.2" width="25" height="36" rx="6.5" fill="#4a2200" filter="url(#sh-front-col)"/>
    <!-- Face -->
    <rect x="19" y="16" width="25" height="36" rx="6.5" fill="url(#gold-face)"/>
    
    <!-- Front card rim (thicker, brighter) -->
    <rect x="19" y="16" width="25" height="36" rx="6.5" fill="none" stroke="url(#amber-rim)" stroke-width="1.6" stroke-opacity="1"/>

    <!-- Inner ambient rim to give 3D top bevel look -->
    <rect x="20.5" y="17.5" width="22" height="33" rx="5" fill="none" stroke="#ffe5a0" stroke-width="0.8" stroke-opacity="0.45" filter="url(#rim-blur)"/>
  </g>
</svg>`,
};
