# Android source of truth

This is a checked-in native Android project, not a disposable Expo Prebuild
output. It contains the fasting widgets, their widget layouts, and the React
Native bridge used to update them.

Do not run `npx expo prebuild --clean` for Android. That command replaces this
directory and would remove the widget implementation. Build this project with
Gradle or `npx expo run:android`.

Do not commit `build/`, `.gradle/`, `.kotlin/`, `.cxx/`, `local.properties`,
or signing keys. Those paths are excluded in the root `.gitignore`.
