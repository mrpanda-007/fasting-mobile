# Fesora Fast

A calm, minimal fasting tracker built with Expo and React Native. It supports common fasting presets, custom and rolling protocols, persistent local timers, target notifications, and an on-device history of every finished run.

The app is designed around a simple rule: time passing never ends a fast. A fast remains active until the user explicitly ends it.

> This is a wellness tracker, not medical advice. Consult an appropriately qualified professional before making changes that affect your health.

## Current scope

- Start 16:8, 18:6, OMAD, 24-hour, rolling, and custom fasting protocols.
- Persist the active phase and history in SQLite, so a timer restores correctly after backgrounding, app termination, or a device restart.
- Show target-reached/overtime state without automatically stopping the fast.
- Schedule a single local notification when the current fast or refeed target is reached.
- Record completed and early-ended runs with the original protocol, elapsed duration, and timestamps.
- Offer light and dark presentation themes.

The Together/pairing/reaction experience is intentionally paused in the UI while the solo experience is refined. Its implementation remains in the codebase for a later release.

## Technical specifications

| Area | Implementation |
| --- | --- |
| Framework | Expo SDK 57, React Native 0.86, React 19 |
| Language | TypeScript |
| Local storage | `expo-sqlite` with WAL and foreign keys enabled |
| Timer model | Absolute timestamps, derived timer snapshots, no per-second database writes |
| Foreground updates | One-second display ticker only while an active timer is on screen |
| Background behavior | No background JavaScript loop; elapsed time is recalculated from persisted timestamps on resume or relaunch |
| Notifications | `expo-notifications`; one permission-gated, silent local target notification per active phase |
| App state | React hooks plus a small app-flow hook; partner preferences use AsyncStorage |
| Platforms | Android and iOS; web development is also available through Expo |
| Android application ID | `com.anonymous.fesorafast` |

### Timer behavior

An active timer is a durable database record, not a continuously running process. This makes long fasts battery-friendly:

1. Starting a phase saves its `startedAt` and `targetAt` values before the UI reports success.
2. In the foreground, the display updates once per second from the current clock.
3. In the background or after the process is removed, no app timer work runs.
4. On resume or a cold launch, the app reloads the saved record and derives the elapsed, remaining, or overtime value immediately.
5. Only an explicit end action closes the phase and writes it to history.

Platform force-quit behavior still applies: iOS and Android can suppress scheduled notification delivery after a force-stop/force-quit. The saved timer itself is not lost and is restored the next time the app opens.

## Project structure

```text
src/
├── app/                         # Application entry composition
├── data/
│   ├── contracts/               # Interfaces for future auth and sync adapters
│   └── local/sqlite/            # Database schema and fasting repository
├── domain/
│   ├── auth/                    # Future account models
│   └── fasting/                 # Protocols and pure timer snapshot logic
├── features/
│   ├── app/                     # Screen-level flow state
│   ├── fasting/hooks/           # Timer hydration, lifecycle, and commands
│   ├── today/screens/           # Today, history, sheets, and paused Together UI
│   ├── history/                 # Reserved feature boundary
│   └── settings/                # Reserved feature boundary
├── services/notifications/      # Native target-notification scheduling
└── shared/theme/                # Colour and motion tokens
```

The source of truth for a running plan is the SQLite schema in `src/data/local/sqlite/`:

- `plan_runs` stores the immutable protocol snapshot and plan status.
- `phase_runs` stores individual fast and refeed phases.
- `active_timer` points to the one currently active phase.
- `timer_events` provides an append-only record of lifecycle events.

## Getting started

### Prerequisites

- Current Node.js LTS release
- npm (included with Node.js)
- For Android: Android Studio, Android SDK, and either an emulator or a USB-debugging-enabled device
- For iOS: macOS, Xcode, and CocoaPods

### Install

```bash
git clone https://github.com/prabhjeevnijjar/fasting-mobile.git fasting
cd fasting
npm install
```

### Run in development

```bash
# Start Expo's development server
npm start

# Build and run the native development app
npm run android
npm run ios

# Run the Expo web target
npm run web
```

For a physical Android device, enable **Developer options** and **USB debugging**, connect it by USB, confirm it is visible with `adb devices`, then run:

```bash
npm run android
```

### Build a local Android release

Create a private Android upload key, then save its local configuration in
`android/keystore.properties`. This file and the keystore are intentionally
ignored and must never be committed. A release build fails rather than falling
back to the public debug key when these credentials are missing.

```bash
cd android
./gradlew app:bundleRelease
```

The Play-uploadable Android App Bundle is written to:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

### Android native source and widgets

The Android project is checked into source control because the app includes
custom native home-screen widgets and a React Native bridge. Keep all files in
`android/app/src/main/` and the Gradle project files under version control.

Do not run `npx expo prebuild --clean` for Android: it deletes and regenerates
the native project, which would remove the custom widget implementation. Build
the checked-in Android project with Gradle or `npx expo run:android` instead.
Only local Android build output, IDE state, and signing material are ignored.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Expo development server |
| `npm run android` | Build and open the Android app |
| `npm run ios` | Build and open the iOS app |
| `npm run web` | Start Expo's web target |
| `npx tsc --noEmit` | Type-check the project |

## Design language

The visual system is intentionally restrained: warm neutral surfaces, native system typography, generous spacing, and small purposeful motion. Read [docs/DESIGN_LANGUAGE.md](docs/DESIGN_LANGUAGE.md) before changing UI so new work stays consistent with the product.

For the persistence and timer decisions behind the app, see [docs/TIMER_HISTORY_IMPLEMENTATION_PLAN.md](docs/TIMER_HISTORY_IMPLEMENTATION_PLAN.md).

## Data and privacy

Fesora Fast runs and history are stored locally on the device in the app's SQLite database. There is no sign-in or remote sync in the current build. The `data/contracts` layer exists so account-backed sync can be introduced later without changing the timer domain model.

## Contributing

1. Keep timer state timestamp-based; do not add a background loop or per-second storage writes.
2. Preserve the explicit-end rule: reaching a target never stops a fast automatically.
3. Run `npx tsc --noEmit` before submitting changes.
4. Check the design language before making UI changes.

## License

This project currently includes the [MIT License](LICENSE).
