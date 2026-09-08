# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Design language — read before any UI work

Read [`docs/DESIGN_LANGUAGE.md`](docs/DESIGN_LANGUAGE.md) before creating or changing user-facing UI. Follow its colour, typography, spacing, component, and motion rules. Do not introduce a component library, gradients, bright colours, heavy shadows, or arbitrary animation styles unless the user explicitly asks.

## Durable fasting architecture

Before implementing timers, login, persistence, or syncing, read [`docs/APP_ARCHITECTURE.md`](docs/APP_ARCHITECTURE.md). Long-running fasts must use stored timestamps rather than a background JavaScript counter; screens must use the domain/service boundaries and must not call storage or remote services directly.
