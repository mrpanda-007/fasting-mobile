package com.anonymous.fesorafast

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.os.SystemClock
import android.widget.RemoteViews
import java.text.DateFormat
import java.util.Date

class FastingWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { update(context, manager, it) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    update(context, manager, id)
  }

  companion object {
    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, FastingWidgetProvider::class.java)
      manager.getAppWidgetIds(component).forEach { update(context, manager, it) }
      updatePickerPreview(context, manager, component)
    }

    private fun update(context: Context, manager: AppWidgetManager, id: Int) {
      val options = manager.getAppWidgetOptions(id)
      val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110)
      val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
      val layout = when {
        width >= 250 && height >= 220 -> R.layout.fasting_widget_large
        width >= 250 -> R.layout.fasting_widget_wide
        height >= 190 -> R.layout.fasting_widget_tall
        else -> R.layout.fasting_widget_small
      }
      val views = RemoteViews(context.packageName, layout)
      bind(context, views, FastingWidgetStorage.read(context), layout, id)
      manager.updateAppWidget(id, views)
    }

    private fun updatePickerPreview(context: Context, manager: AppWidgetManager, component: ComponentName) {
      if (Build.VERSION.SDK_INT < 35) return
      val preview = RemoteViews(context.packageName, R.layout.fasting_widget_large)
      bind(context, preview, FastingWidgetStorage.read(context), R.layout.fasting_widget_large, null)
      manager.setWidgetPreview(component, AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN, preview)
    }

    private fun bind(context: Context, views: RemoteViews, snapshot: FastingWidgetStorage.Snapshot, layout: Int, id: Int?) {
      if (id != null) views.setOnClickPendingIntent(R.id.fasting_widget_root, openAppIntent(context, id))
      applyTheme(views, snapshot.darkMode, layout)

      if (snapshot.state == "active" && snapshot.startedAt > 0L && snapshot.targetAt > snapshot.startedAt) {
        val isRefeed = snapshot.phaseKind == "refeed"
        val label = if (isRefeed) "REFEEDING" else "FASTING"
        val now = System.currentTimeMillis()
        val reachedTarget = now >= snapshot.targetAt
        val phaseCopy = when {
          isRefeed && reachedTarget -> "REFEED TARGET REACHED"
          isRefeed -> "REFEEDING"
          reachedTarget -> "FAST TARGET REACHED"
          else -> "FASTING"
        }
        val elapsedAtBoot = SystemClock.elapsedRealtime() - (now - snapshot.startedAt).coerceAtLeast(0L)
        val duration = (snapshot.targetAt - snapshot.startedAt).coerceAtLeast(1L)
        val progress = (((now - snapshot.startedAt).coerceAtLeast(0L) * 100L) / duration).coerceIn(0L, 100L).toInt()
        val target = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(snapshot.targetAt))

        views.setTextViewText(R.id.fasting_widget_protocol, snapshot.planName)
        views.setTextViewText(R.id.fasting_widget_status, phaseCopy)
        views.setTextViewText(R.id.fasting_widget_supporting, if (reachedTarget) "Continues until you choose to end" else "Target $target")
        views.setTextViewText(R.id.fasting_widget_metric_one_label, "PHASE")
        views.setTextViewText(R.id.fasting_widget_metric_one_value, label.lowercase().replaceFirstChar { it.titlecase() })
        views.setTextViewText(R.id.fasting_widget_metric_two_label, "CYCLE")
        views.setTextViewText(R.id.fasting_widget_metric_two_value, snapshot.cycleNumber.toString())
        views.setContentDescription(R.id.fasting_widget_root, "$phaseCopy. ${snapshot.planName}. Tap to open Fesora Fast.")
        if (layout == R.layout.fasting_widget_large) {
          views.setTextViewText(
            R.id.fasting_widget_message,
            when {
              isRefeed && reachedTarget -> "Your refeed target is reached. End when you’re ready."
              isRefeed -> "Your refeed is active. Take the time you need."
              reachedTarget -> "Your fast target is reached. End when you’re ready."
              else -> "Keep going at your own pace."
            },
          )
        }
        views.setChronometer(R.id.fasting_widget_timer, elapsedAtBoot, null, true)
        views.setProgressBar(R.id.fasting_widget_progress, 100, progress, false)
      } else {
        val isPending = snapshot.state == "pending"
        val next = if (snapshot.phaseKind == "refeed") "refeed" else "fast"
        views.setTextViewText(R.id.fasting_widget_protocol, if (isPending) snapshot.planName else "Fesora Fast")
        views.setTextViewText(R.id.fasting_widget_status, if (isPending) "READY FOR ${next.uppercase()}" else "READY WHEN YOU ARE")
        views.setTextViewText(R.id.fasting_widget_timer, if (isPending) "Open app" else "Start a fast")
        views.setTextViewText(R.id.fasting_widget_supporting, if (isPending) "Tap to begin your next phase" else "Tap to choose a plan")
        views.setTextViewText(R.id.fasting_widget_metric_one_label, "NEXT")
        views.setTextViewText(R.id.fasting_widget_metric_one_value, if (isPending) next.replaceFirstChar { it.titlecase() } else "Plan")
        views.setTextViewText(R.id.fasting_widget_metric_two_label, "STATUS")
        views.setTextViewText(R.id.fasting_widget_metric_two_value, "Ready")
        views.setContentDescription(R.id.fasting_widget_root, "Fesora Fast widget. ${if (isPending) "Next phase ready" else "Ready when you are"}. Tap to open Fesora Fast.")
        if (layout == R.layout.fasting_widget_large) {
          views.setTextViewText(R.id.fasting_widget_message, if (isPending) "Your next phase is ready when you are." else "Choose a plan when it feels right for you.")
        }
        views.setProgressBar(R.id.fasting_widget_progress, 100, 0, false)
      }
    }

    private fun openAppIntent(context: Context, id: Int): PendingIntent {
      val intent = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
        data = Uri.parse("fesorafast://widget/$id")
      }
      return PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun applyTheme(views: RemoteViews, dark: Boolean, layout: Int) {
      val canvas = if (dark) 0xff201f1b.toInt() else 0xffefece5.toInt()
      val ink = if (dark) 0xfff4f0e8.toInt() else 0xff1a1a1a.toInt()
      val muted = if (dark) 0xffc8c1b6.toInt() else 0xff6b665e.toInt()
      val subtle = if (dark) 0xffafa79b.toInt() else 0xff8a847a.toInt()
      val accent = if (dark) 0xffd68a57.toInt() else 0xffc67139.toInt()
      views.setInt(R.id.fasting_widget_root, "setBackgroundColor", canvas)
      views.setInt(R.id.fasting_widget_protocol, "setTextColor", muted)
      views.setInt(R.id.fasting_widget_status, "setTextColor", accent)
      views.setInt(R.id.fasting_widget_timer, "setTextColor", ink)
      views.setInt(R.id.fasting_widget_supporting, "setTextColor", muted)
      views.setInt(R.id.fasting_widget_metric_one_label, "setTextColor", subtle)
      views.setInt(R.id.fasting_widget_metric_one_value, "setTextColor", ink)
      views.setInt(R.id.fasting_widget_metric_two_label, "setTextColor", subtle)
      views.setInt(R.id.fasting_widget_metric_two_value, "setTextColor", ink)
      if (layout == R.layout.fasting_widget_large) views.setInt(R.id.fasting_widget_message, "setTextColor", muted)
    }
  }
}
