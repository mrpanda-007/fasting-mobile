package com.anonymous.fasting

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class FastingWidgetModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "FastingWidget"

  @ReactMethod
  fun update(snapshot: ReadableMap) {
    FastingWidgetStorage.write(context, snapshot)
    FastingWidgetProvider.refresh(context)
    FastingRingWidgetProvider.refresh(context)
  }

  @ReactMethod
  fun clear() {
    FastingWidgetStorage.clear(context)
    FastingWidgetProvider.refresh(context)
    FastingRingWidgetProvider.refresh(context)
  }
}
