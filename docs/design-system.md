# Vinyl Dashboard – Design System

This document defines the visual, behavioral, and architectural standards for all UI in the Vinyl Dashboard application. All components, layouts, and styles must follow these rules.

---

## 1. Principles

- Prioritize clarity, hierarchy, and legibility.
- UI supports content; color and motion remain minimal.
- Layering, elevation, and subtle motion communicate structure.
- Maintain consistent spacing, behavior, and component roles.
- Ensure responsive and adaptive layouts across all screen sizes.

---

## 2. Foundations

### 2.1 Color

- Use **semantic tokens only**. Never use raw hex values in components.
- Primary actions use `--color-primary`.
- All text and UI contrast must meet **WCAG AA**.

**Core semantic tokens:**

- Brand:  
  - `--color-primary`  
  - `--color-primary-soft`

- Surfaces:  
  - `--color-surface-default`  
  - `--color-surface-subtle`  
  - `--color-surface-elevated`

- Text:  
  - `--color-text-primary`  
  - `--color-text-secondary`  
  - `--color-text-muted`  
  - `--color-text-on-primary`

- Borders:  
  - `--color-border-subtle`  
  - `--color-border-strong`

- States:  
  - `--color-focus-ring`  
  - `--color-destructive`  
  - `--color-destructive-soft`  
  - `--color-success`  
  - `--color-warning`  
  - `--color-error-text`

Light and dark themes map different values to the same tokens.

---

### 2.2 Typography

**Font stack:**

- Primary: San Francisco  
- Fallbacks: Inter, Roboto, system-ui  

**Type roles:**

| Role     | Size | Line | Weight |
|----------|------|------|--------|
| Display  | 40px | 48px | 600 |
| H1       | 32px | 40px | 600 |
| H2       | 24px | 32px | 600 |
| H3       | 20px | 28px | 600 |
| Body     | 17px | 28px | 400 |
| Caption  | 13px | 20px | 400 |

Rules:

- Use **no more than two font weights per view**.
- Never mix multiple heading roles in the same small region.

---

### 2.3 Spacing

4px baseline grid using tokens only:

- `--space-xs` → 4px  
- `--space-sm` → 8px  
- `--space-md` → 16px  
- `--space-lg` → 24px  
- `--space-xl` → 32px  
- `--space-2xl` → 40px  

Rules:

- Default padding inside cards: `--space-md`
- Touch targets must be **≥ 44×44px**

---

### 2.4 Elevation

- `shadow-low` → cards, list items  
- `shadow-medium` → drawers, popovers  
- `shadow-high` → modals, alerts  

Avoid heavy or decorative shadows.

---

### 2.5 Motion

Timing tokens:

- Fast: 150ms  
- Medium: 300ms  
- Slow: 500ms  

Rules:

- Motion must clarify structure.
- No decorative animation.
- Respect `prefers-reduced-motion`.

---

## 3. Components

### 3.1 Buttons

Variants:

- Primary
- Secondary
- Tertiary (text-only)
- Destructive

Required states:

- Default
- Hover
- Pressed
- Focus
- Disabled
- Error (when applicable)

Rules:

- Consistent radius for all buttons.
- Minimum height: 44px.
- Primary uses `bg-primary`.
- Secondary uses surface + border.
- Destructive uses destructive tokens only.

---

### 3.2 Typography Components

- `Heading1`
- `Heading2`
- `BodyText`
- `Caption`

Avoid mixing too many text roles in a single region.

---

### 3.3 Cards

- Padding: `--space-md`
- Radius: 8–12px
- Elevation: `shadow-low`
- Surface: `bg-surface-elevated`

Rules:

- Group related content.
- Cards are **not clickable by default** unless explicitly designed to be.

---

### 3.4 Forms

Components:

- TextInput
- Select
- Checkbox
- Radio
- Switch
- TextArea

Rules:

- Labels must always be visible.
- Semantic error states required.
- Adequate vertical spacing between fields.
- All inputs must have visible focus states.

---

### 3.5 Navigation

Elements:

- Header
- Tabs or Sidebar
- Breadcrumbs

Rules:

- Minimal vertical space.
- Clear active state.
- Responsive behavior required.

---

## 4. Layout

Grid system:

- 4 columns → mobile
- 8 columns → tablet
- 12 columns → desktop

Rules:

- Use consistent gutters.
- Maintain generous whitespace.
- Respect safe-area insets.

---

## 5. Theming

- **Light theme:** bright surfaces, high contrast, soft shadows.
- **Dark theme:** dark surfaces, same accent color, reduced reliance on shadows.
- Theme switching must use CSS variables or context.

---

## 6. Accessibility

Mandatory requirements:

- WCAG AA contrast.
- Touch targets ≥ 44px.
- Visible focus states.
- Respect reduced-motion preference.
- Support font scaling.
- Labels must be visible and descriptive.

---

## 7. Tailwind Rules

Only semantic utilities are allowed.

### Color

- `bg-primary`
- `bg-surfaceDefault`
- `bg-surfaceElevated`
- `textPrimary`
- `textSecondary`
- `text-onPrimary`
- `borderSubtle`

### Spacing

- `px-sm`, `px-md`, `px-lg`
- `gap-sm`, `gap-md`, `gap-lg`

### Elevation

- `shadow-low`
- `shadow-medium`
- `shadow-high`

### Typography

- `text-display`
- `text-heading1`
- `text-heading2`
- `text-body`
- `text-caption`

Raw hex colors, arbitrary spacing, and non-semantic utilities are not allowed.

---

## 8. Behavioral Requirements

All interactive components must define:

- Default
- Hover
- Pressed
- Focus
- Disabled
- Error (when relevant)

Rules:

- Only animate purposeful transitions (drawers, modals, view changes).
- Links must be clearly distinguishable.
- Do not link entire paragraphs.

---

## 9. Architectural Enforcement

- The design system applies to:
  - All React components
  - All layout logic
  - All documentation and UI examples
- Any new component must:
  - Follow token-based styling
  - Define all required interaction states
  - Respect accessibility rules

---

End of design system.