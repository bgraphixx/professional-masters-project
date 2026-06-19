---
name: NairaAI
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#3e4a3f'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#6d7a6f'
  outline-variant: '#bdcabc'
  surface-tint: '#006d3a'
  primary: '#006a39'
  on-primary: '#ffffff'
  primary-container: '#008649'
  on-primary-container: '#f6fff4'
  inverse-primary: '#64dd91'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#a23546'
  on-tertiary: '#ffffff'
  tertiary-container: '#c24d5e'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#82faab'
  primary-fixed-dim: '#64dd91'
  on-primary-fixed: '#00210e'
  on-primary-fixed-variant: '#00522b'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b8'
  on-tertiary-fixed: '#40000f'
  on-tertiary-fixed-variant: '#851f33'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  currency-display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 16px
---

## Brand & Style
The design system is rooted in **Modern Minimalism**, specifically tailored for the fintech sector. It prioritizes clarity, precision, and trust. The visual narrative is built on the "Utility-First" principle, where every aesthetic choice serves to make complex financial data more digestible. 

The personality is professional and calm, avoiding the "gamification" often found in consumer apps. It draws inspiration from high-end financial infrastructure tools, utilizing generous whitespace, a restricted color palette, and systematic information density to evoke a sense of security and institutional reliability.

## Colors
The color strategy employs a "High-Trust Green" as the primary driver, symbolizing growth and stability. 

- **Primary:** Used for main actions, active states, and positive financial trajectories.
- **Secondary/Accent:** Reserved for secondary interactive elements or to distinguish specific data categories (e.g., investment vs. savings).
- **Neutrals:** A scale of cool-toned greys (from `#F9FAFB` to `#111827`) is used to establish hierarchy and structure without adding visual noise.
- **Status:** Standardized semantic colors for immediate error recognition and success confirmation.

## Typography
This design system utilizes **Inter** for all primary UI text to ensure maximum legibility and a neutral, professional tone. **JetBrains Mono** is introduced as a secondary font for labels, transaction IDs, and specific numeric data to provide a "technical/precise" feel common in fintech.

- **Financial Data:** Large currency amounts should use `currency-display`. The Naira symbol (₦) should always match the weight and color of the accompanying digits.
- **Hierarchy:** Use font weight rather than size to create distinction where possible, keeping the interface clean and structured.

## Layout & Spacing
The layout relies on a **12-column fluid grid** for desktop and a **single-column fluid layout** for mobile. 

- **Spacing Rhythm:** Based on a 4px baseline grid. 
- **Internal Padding:** Use `md` (16px) for standard component internals and `lg` (24px) for card containers.
- **Breakpoints:** 
  - Mobile: 0 - 599px (16px margins)
  - Tablet: 600px - 1023px (24px margins)
  - Desktop: 1024px+ (Centrally aligned container, 1200px max-width).

## Elevation & Depth
The system uses **Tonal Layering** combined with **Ambient Shadows**. Instead of heavy shadows, we use subtle borders and slight offsets to define depth.

- **Level 0 (Background):** `#F9FAFB`.
- **Level 1 (Cards/Surface):** White background, 1px border (`#E5E7EB`), and a very soft 4px blur shadow with 2% opacity.
- **Level 2 (Overlays/Modals):** White background, 12px blur shadow with 8% opacity.
- **Interaction:** On hover, cards should transition from Level 1 to Level 2 to signify interactivity.

## Shapes
A **Rounded** shape language is applied consistently to soften the professional aesthetic. 

- **Standard Components:** Buttons and inputs use an 8px (`0.5rem`) radius.
- **Large Containers:** Cards and modals use a 16px (`1rem`) radius.
- **Small Elements:** Tooltips and tags use a 4px (`0.25rem`) radius.

## Components

### Buttons
- **Primary:** Deep Green background, White text. No border.
- **Secondary:** White background, 1px grey border (`#D1D5DB`), Dark text.
- **Ghost:** Transparent background, Primary color text.
- **Sizing:** 40px height for standard, 48px for large/mobile-primary.

### Inputs & Forms
- **Fields:** 1px border (`#D1D5DB`), 8px radius. Use `body-md` for text.
- **Focus State:** 2px border in Secondary Blue with a 3px soft blue outer glow.
- **Labels:** Use `label-sm` in medium grey (`#6B7280`) positioned above the field.

### Cards
- **Financial Cards:** White surface, 1px light border, `lg` (24px) padding. 
- **Transaction Lists:** Use flat rows with 1px bottom separators (`#F3F4F6`), avoiding individual boxes for each item to maintain a clean flow.

### Chips & Badges
- **Status Badges:** Use light background tints of the status colors (e.g., 10% opacity Green for "Success") with high-contrast bold text in the same hue. 
- **Currency Format:** Always include the ₦ symbol. Negative values in Red, Positive values in Green.