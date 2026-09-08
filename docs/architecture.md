# Architecture

The folder structure follows the provided fasting wireframes.

```text
src/
  app/                 App composition and providers
  components/          Cross-feature UI primitives
  navigation/          Tab and modal navigation
  features/
    today/             Main dashboard and idle state
    fasting/           Plan selection, timer, notes, end/refeed states
    together/          Accountability partner flow
    history/           Fast list and detail
    settings/          User preferences and safety information
  services/            Persistence, notifications, and future API clients
  state/               App-wide state
  shared/              Theme, types, constants, utilities, shared components
```

Primary navigation from the wireframe is Today, Together, and History. Settings is reached from the avatar; timer-related interactions are presented as modal sheets.
