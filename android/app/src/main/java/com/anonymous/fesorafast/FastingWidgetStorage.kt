package com.anonymous.fesorafast

import android.content.Context
import com.facebook.react.bridge.ReadableMap

internal object FastingWidgetStorage {
  private const val preferencesName = "fasting_widget"
  private const val state = "state"
  private const val planName = "plan_name"
  private const val phaseKind = "phase_kind"
  private const val startedAt = "started_at"
  private const val targetAt = "target_at"
  private const val cycleNumber = "cycle_number"
  private const val darkMode = "dark_mode"

  data class Snapshot(
    val state: String,
    val planName: String,
    val phaseKind: String,
    val startedAt: Long,
    val targetAt: Long,
    val cycleNumber: Int,
    val darkMode: Boolean,
  )

  fun write(context: Context, values: ReadableMap) {
    val editor = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE).edit()
    editor.putString(state, values.getString("state") ?: "idle")
    editor.putString(planName, values.getString("planName") ?: "")
    editor.putString(phaseKind, values.getString("phaseKind") ?: "fast")
    editor.putLong(startedAt, if (values.hasKey("startedAt")) values.getDouble("startedAt").toLong() else 0L)
    editor.putLong(targetAt, if (values.hasKey("targetAt")) values.getDouble("targetAt").toLong() else 0L)
    editor.putInt(cycleNumber, if (values.hasKey("cycleNumber")) values.getInt("cycleNumber") else 1)
    editor.putBoolean(darkMode, values.hasKey("darkMode") && values.getBoolean("darkMode"))
    editor.apply()
  }

  fun read(context: Context): Snapshot {
    val preferences = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
    return Snapshot(
      state = preferences.getString(state, "idle") ?: "idle",
      planName = preferences.getString(planName, "") ?: "",
      phaseKind = preferences.getString(phaseKind, "fast") ?: "fast",
      startedAt = preferences.getLong(startedAt, 0L),
      targetAt = preferences.getLong(targetAt, 0L),
      cycleNumber = preferences.getInt(cycleNumber, 1),
      darkMode = preferences.getBoolean(darkMode, false),
    )
  }

  fun clear(context: Context) {
    context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE).edit().clear().apply()
  }
}
