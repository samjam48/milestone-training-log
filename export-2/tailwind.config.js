/** @type {import('tailwindcss').Config} */
// =============================================================================
// Milestone — Tailwind Theme Configuration
// -----------------------------------------------------------------------------
// Design intent: clinical-but-warm, mobile-first, dark-default.
// Color is FUNCTIONAL, not decorative — every accent encodes a recovery state.
// State semantics map directly to the Daily Safety Score in DESIGN.md:
//   safe    -> Green   (no violations, no pain spike)
//   caution -> Amber   (rule warning, mild discomfort, "pushing it")
//   danger  -> Red     (rule violation, flare-up, "went too far")
//   info    -> Cyan    (suggestion / neutral system message)
// =============================================================================

module.exports = {
  content: ['./src/**/*.{ts,tsx,html}', './index.html'],
  darkMode: 'class', // dark is the canonical mode; .light is opt-in
  theme: {
    extend: {
      // -----------------------------------------------------------------------
      // COLORS
      // -----------------------------------------------------------------------
      // Surfaces are layered near-blacks with a faint cool tint (not pure #000)
      // so cards/sheets read as distinct planes without heavy borders.
      // OKLCH used so the chroma stays consistent across the state palette.
      // -----------------------------------------------------------------------
      colors: {
        // -- Surfaces (background depth scale) --
        bg: {
          DEFAULT: '#0A0C0F',   // app canvas
          raised:  '#11141A',   // card / sheet
          sunken:  '#070809',   // input wells, inset graphs
          overlay: '#1A1F27',   // modals, popovers
        },

        // -- Hairlines & dividers --
        border: {
          DEFAULT: '#1F242C',   // standard 1px card border
          strong:  '#2A313B',   // emphasized (selected, focus)
          subtle:  '#161A20',   // ultra-quiet section breaks
        },

        // -- Text --
        ink: {
          DEFAULT: '#E8ECF1',   // primary
          muted:   '#9099A6',   // secondary / labels
          faint:   '#5C6470',   // tertiary / metadata
          inverse: '#0A0C0F',   // on light accent fills
        },

        // -- State: Safe (clinical green, not festive) --
        safe: {
          DEFAULT: '#3DD68C',   // primary signal
          fg:      '#7FE8B3',   // text on dark surfaces
          bg:      '#0F2419',   // tinted card background
          border:  '#1F4D38',   // tinted border
          ring:    '#3DD68C40', // focus ring / progress fill alpha
        },

        // -- State: Caution (amber, pre-violation warning) --
        caution: {
          DEFAULT: '#F5B544',
          fg:      '#F9CB7C',
          bg:      '#2A1F0B',
          border:  '#5C4319',
          ring:    '#F5B54440',
        },

        // -- State: Danger (flare-up / hard rule violation) --
        danger: {
          DEFAULT: '#FF5A52',   // not pure red — slightly orange-shifted
          fg:      '#FF8780',
          bg:      '#2B1110',
          border:  '#5C2521',
          ring:    '#FF5A5240',
        },

        // -- Info / suggestion (neutral non-state accent) --
        info: {
          DEFAULT: '#5CC8E8',
          fg:      '#8FDAF0',
          bg:      '#0E2229',
          border:  '#1F4756',
          ring:    '#5CC8E840',
        },

        // -- Brand (used sparingly — wordmark, primary CTA highlight) --
        brand: {
          DEFAULT: '#E8ECF1',   // brand is monochrome; emphasis comes from weight not hue
          dim:     '#9099A6',
        },
      },

      // -----------------------------------------------------------------------
      // TYPOGRAPHY
      // -----------------------------------------------------------------------
      // Two families:
      //   sans   -> UI text (Inter Tight — tighter caps than Inter, reads
      //             confidently at small sizes on phone)
      //   metric -> tabular numerics for the big readouts (JetBrains Mono or
      //             a tabular-figures variant). Tabular figures make weekly
      //             progress numbers visually stable as they tick up.
      // -----------------------------------------------------------------------
      fontFamily: {
        sans:   ['"Inter Tight"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        metric: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        // Mobile-tuned scale. Big metrics get their own tokens so we don't
        // sprinkle ad-hoc px values across the app.
        'micro':   ['10px', { lineHeight: '14px', letterSpacing: '0.08em' }],
        'caption': ['11px', { lineHeight: '16px', letterSpacing: '0.04em' }],
        'label':   ['12px', { lineHeight: '16px', letterSpacing: '0.06em' }], // SECTION LABELS (uppercase)
        'body':    ['14px', { lineHeight: '20px' }],
        'body-lg': ['16px', { lineHeight: '22px' }],
        'title':   ['20px', { lineHeight: '26px', letterSpacing: '-0.01em' }],
        'heading': ['28px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
        'metric':  ['40px', { lineHeight: '40px', letterSpacing: '-0.03em' }], // dashboard numbers
        'hero':    ['56px', { lineHeight: '56px', letterSpacing: '-0.03em' }], // check-in slider value
      },

      fontWeight: {
        normal:   '400',
        medium:   '500',
        semibold: '600',
        bold:     '700',
      },

      // -----------------------------------------------------------------------
      // SPACING — 4px base grid. We don't extend much; default Tailwind covers it.
      // -----------------------------------------------------------------------
      spacing: {
        'safe-top':    'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'tabbar':      '72px', // bottom nav height (matches min hit target + label)
      },

      // -----------------------------------------------------------------------
      // RADII — generous on cards, sharp on small chips
      // -----------------------------------------------------------------------
      borderRadius: {
        'sm':   '6px',
        'md':   '10px',
        'lg':   '14px',
        'xl':   '20px',
        'pill': '999px',
      },

      // -----------------------------------------------------------------------
      // SHADOWS — restrained. Mostly inner glows on state cards.
      // -----------------------------------------------------------------------
      boxShadow: {
        'card':       '0 1px 0 0 rgba(255,255,255,0.02) inset',
        'sheet':      '0 -8px 32px rgba(0,0,0,0.6)',
        'focus-safe':    '0 0 0 2px #3DD68C40',
        'focus-caution': '0 0 0 2px #F5B54440',
        'focus-danger':  '0 0 0 2px #FF5A5240',
      },

      // -----------------------------------------------------------------------
      // MOTION
      // -----------------------------------------------------------------------
      transitionTimingFunction: {
        'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        'snap': '160ms',
      },
    },
  },
  plugins: [],
};
