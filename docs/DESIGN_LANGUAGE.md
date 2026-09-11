# Fesora Fast design language

Read this before making any UI change. This app should feel calm, deliberate, and quietly human — more like a well-made paper journal than a fitness dashboard.

## North star

Minimal, warm, and reassuring. Make one task obvious at a time. Use generous breathing room, plain language, and subtle feedback. Never use guilt, urgency, or visual noise around fasting progress.

## Colour

These values are taken from the supplied wireframes. Use semantic names rather than placing hex values in components.

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#EFECE5` | Warm app background and timer surfaces |
| `surface` | `#FFFFFF` | Sheets, cards, and elevated content |
| `ink` | `#1A1A1A` | Primary text, buttons, and borders |
| `muted` | `#6B665E` | Supporting copy |
| `subtle` | `#8A847A` | Labels and secondary metadata |
| `divider` | `#CFC9BF` | Dashed dividers and quiet structure |
| `accent` | `#C67139` | Active timer and the single important emphasis |
| `success` | `#7A8A5E` | Completed or healthy states |
| `danger` | `#8A5C39` | Destructive actions; text-only where possible |

Default to `canvas`, `surface`, and `ink`. Reserve `accent` for one focal point per view. Do not add gradients, neon, or status colours beyond these tokens.

### Dark mode

Include a **Dark mode** switch in Settings when Settings is built. It should be off by default and persist the user's choice. Dark mode is a quiet inversion, not a new visual identity: use a deep warm charcoal canvas, a slightly lighter charcoal surface, softened ivory text, muted warm grey dividers, and the same restrained terracotta and olive accents. Never use pure black or pure white in dark mode.

## Typography

Use the native system font for all functional UI: labels, body copy, buttons, timer numerals, and settings rows. It is crisp, accessible, and close to the wireframe.

Use **Architects Daughter** only as a sparing display accent: an optional empty-state sentence, a short encouragement, or a small handwritten annotation. Never use it for controls, long text, numbers, tab labels, or critical information. If the font has not loaded, fall back to the system font without blocking the screen.

| Role | Size | Weight / treatment |
| --- | --- | --- |
| Display | 30–32 | System semibold; Architect's Daughter optional for a short accent |
| Screen title | 24–28 | System medium or semibold |
| Section label | 12–13 | System medium, uppercase, tracking 0.12em–0.14em |
| Body / row | 15–16 | System regular |
| Metadata | 12–14 | System regular, `muted` or `subtle` |
| Timer | 48–64 | System regular, tabular numerals when available |

## Layout and components

- Use a 4-point spacing rhythm. Default screen padding: 16px. Major section gaps: 24px.
- Prefer a single vertical column. Avoid dense dashboards and more than one primary action per screen.
- Cards are rare; use flat layouts with dashed dividers (`divider`) first. When a card is needed, use `surface`, no shadow, and a 16px corner radius.
- Use 999px rounded buttons for primary and secondary actions. Primary: `ink` background with white label. Secondary: transparent `surface` with a 1.5px `ink` border.
- Use 1.5px dashed dividers and borders for quiet grouping; use solid `ink` borders only for interaction or clear hierarchy.
- Bottom sheets have a white surface, 24px top corners, a small centered drag handle, and preserve the page context behind them.
- Settings and history are lists, not cards. Keep rows clear and easily tappable (minimum 44px height).

## Motion: tiny, purposeful, and interruptible

Use React Native's built-in `Animated` API unless a future interaction clearly requires more. Motion should confirm an action, reveal a change of state, or guide focus — never decorate.

| Interaction | Motion | Timing |
| --- | --- | --- |
| Button press | Scale to 0.98, then return | 100ms in, 160ms out |
| Toggle / chip | Colour and position interpolation | 160–200ms |
| Timer | Crossfade or brief number transition; no ticking bounce | 150ms |
| Bottom sheet | Fade scrim + translate up | 240ms, ease-out |
| Toast / partner event | Fade + rise 8px | 180ms in, 220ms out |
| Completion | One restrained scale/fade moment, then stillness | 280ms max |

Respect reduced-motion preferences when implemented: remove transforms and use an immediate opacity/state change. Do not use looping, parallax, springy/bouncy motion, confetti, or animation longer than 300ms without explicit approval.

## Copy and accessibility

- Use supportive, factual language: “Ended early” rather than “Failed.”
- Keep one clear action label per control: “Start fast”, “End fast”, “Save note”.
- Maintain clear contrast and at least 44×44px interactive areas.
- Provide accessibility labels for icon-only controls and do not communicate status by colour alone.

## Before shipping UI

1. Use existing theme tokens and shared primitives first.
2. Confirm the view has one visual focal point and one primary action.
3. Add motion only where it explains feedback or a transition.
4. Verify that disabling motion still leaves every state understandable.
