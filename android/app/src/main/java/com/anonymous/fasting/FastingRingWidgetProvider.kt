package com.anonymous.fasting

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.Bundle
import android.os.Build
import android.os.SystemClock
import android.widget.RemoteViews

/** A fixed-size, glanceable companion widget for the launcher. */
class FastingRingWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { update(context, manager, it) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    update(context, manager, id)
  }

  companion object {
    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, FastingRingWidgetProvider::class.java)
      manager.getAppWidgetIds(component).forEach { update(context, manager, it) }
      updatePickerPreview(context, manager, component)
    }

    private fun update(context: Context, manager: AppWidgetManager, id: Int) {
      val views = RemoteViews(context.packageName, R.layout.fasting_ring_widget)
      val snapshot = FastingWidgetStorage.read(context)
      val openApp = PendingIntent.getActivity(
        context,
        1,
        Intent(context, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      views.setOnClickPendingIntent(R.id.fasting_ring_root, openApp)

      if (snapshot.state == "active" && snapshot.startedAt > 0L && snapshot.targetAt > snapshot.startedAt) {
        val now = System.currentTimeMillis()
        val duration = (snapshot.targetAt - snapshot.startedAt).coerceAtLeast(1L)
        val elapsed = (now - snapshot.startedAt).coerceAtLeast(0L)
        val progress = (elapsed.toFloat() / duration).coerceIn(0f, 1f)
        val elapsedBase = SystemClock.elapsedRealtime() - elapsed
        views.setImageViewBitmap(R.id.fasting_ring_graph, ringBitmap(progress, snapshot.phaseKind == "refeed", snapshot.darkMode))
        views.setTextViewText(R.id.fasting_ring_status, if (snapshot.phaseKind == "refeed") "REFEEDING" else "FASTING")
        views.setChronometer(R.id.fasting_ring_elapsed, elapsedBase, null, true)
        views.setTextViewText(R.id.fasting_ring_elapsed_label, "elapsed")
      } else {
        views.setImageViewBitmap(R.id.fasting_ring_graph, ringBitmap(0f, false, snapshot.darkMode))
        views.setTextViewText(R.id.fasting_ring_status, if (snapshot.state == "pending") "NEXT PHASE READY" else "FASTING")
        views.setTextViewText(R.id.fasting_ring_elapsed, if (snapshot.state == "pending") "Open app" else "Ready")
        views.setTextViewText(R.id.fasting_ring_elapsed_label, if (snapshot.state == "pending") "to begin" else "when you are")
      }
      applyTheme(views, snapshot.darkMode)
      manager.updateAppWidget(id, views)
    }

    private fun updatePickerPreview(context: Context, manager: AppWidgetManager, component: ComponentName) {
      if (Build.VERSION.SDK_INT < 35) return
      val preview = RemoteViews(context.packageName, R.layout.fasting_ring_widget)
      val snapshot = FastingWidgetStorage.read(context)
      if (snapshot.state == "active" && snapshot.startedAt > 0L && snapshot.targetAt > snapshot.startedAt) {
        val now = System.currentTimeMillis()
        val duration = (snapshot.targetAt - snapshot.startedAt).coerceAtLeast(1L)
        val progress = ((now - snapshot.startedAt).coerceAtLeast(0L).toFloat() / duration).coerceIn(0f, 1f)
        preview.setImageViewBitmap(R.id.fasting_ring_graph, ringBitmap(progress, snapshot.phaseKind == "refeed", snapshot.darkMode))
        preview.setTextViewText(R.id.fasting_ring_status, if (snapshot.phaseKind == "refeed") "REFEEDING" else "FASTING")
        preview.setChronometer(R.id.fasting_ring_elapsed, SystemClock.elapsedRealtime() - (now - snapshot.startedAt).coerceAtLeast(0L), null, false)
        preview.setTextViewText(R.id.fasting_ring_elapsed_label, "elapsed")
      } else {
        preview.setImageViewBitmap(R.id.fasting_ring_graph, ringBitmap(0f, false, snapshot.darkMode))
        preview.setTextViewText(R.id.fasting_ring_status, "FASTING")
        preview.setTextViewText(R.id.fasting_ring_elapsed, "Ready")
        preview.setTextViewText(R.id.fasting_ring_elapsed_label, "when you are")
      }
      applyTheme(preview, snapshot.darkMode)
      manager.setWidgetPreview(component, AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN, preview)
    }

    private fun applyTheme(views: RemoteViews, dark: Boolean) {
      val canvas = if (dark) 0xff201f1b.toInt() else 0xffefece5.toInt()
      val ink = if (dark) 0xfff4f0e8.toInt() else 0xff1a1a1a.toInt()
      val muted = if (dark) 0xffc8c1b6.toInt() else 0xff6b665e.toInt()
      val accent = if (dark) 0xffd68a57.toInt() else 0xffc67139.toInt()
      views.setInt(R.id.fasting_ring_root, "setBackgroundColor", canvas)
      views.setInt(R.id.fasting_ring_status, "setTextColor", accent)
      views.setInt(R.id.fasting_ring_elapsed, "setTextColor", ink)
      views.setInt(R.id.fasting_ring_elapsed_label, "setTextColor", muted)
    }

    private fun ringBitmap(progress: Float, isRefeed: Boolean, dark: Boolean): Bitmap {
      val size = 480
      val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      val stroke = 30f
      val bounds = RectF(stroke, stroke, size - stroke, size - stroke)
      val track = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = if (dark) 0xff4a4740.toInt() else 0xffd9d4cb.toInt(); style = Paint.Style.STROKE; strokeWidth = stroke; strokeCap = Paint.Cap.ROUND }
      val progressPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = if (isRefeed) { if (dark) 0xffa4b383.toInt() else 0xff7a8a5e.toInt() } else { if (dark) 0xffd68a57.toInt() else 0xffc67139.toInt() }; style = Paint.Style.STROKE; strokeWidth = stroke; strokeCap = Paint.Cap.ROUND }
      canvas.drawArc(bounds, -90f, 360f, false, track)
      if (progress > 0f) canvas.drawArc(bounds, -90f, progress * 360f, false, progressPaint)
      return bitmap
    }
  }
}
