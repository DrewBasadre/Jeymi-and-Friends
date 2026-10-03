package org.pavo.nearby

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Keeps a user-started Nearby transfer alive while the screen dims. Started
 * only from a visible "Send" or "Accept" action and stopped when the session
 * ends; it never discovers or advertises on its own.
 */
class PavoTransferService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_CANCEL) {
      onCancel?.invoke()
      stopSelf()
      return START_NOT_STICKY
    }
    title = intent?.getStringExtra(EXTRA_TITLE) ?: "PAVO transfer"
    val notification = build(this, intent?.getStringExtra(EXTRA_TEXT) ?: "Preparing", -1)
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    return START_NOT_STICKY
  }

  companion object {
    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT = "text"
    private const val ACTION_CANCEL = "org.pavo.nearby.CANCEL_TRANSFER"
    private const val CHANNEL_ID = "pavo-transfers"
    private const val NOTIFICATION_ID = 4107
    private var title = "PAVO transfer"
    var onCancel: (() -> Unit)? = null

    fun update(context: Context, text: String, percent: Int) {
      context.getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, build(context, text, percent))
    }

    private fun build(context: Context, text: String, percent: Int): Notification {
      val manager = context.getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= 26 && manager?.getNotificationChannel(CHANNEL_ID) == null) {
        manager?.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Nearby transfers", NotificationManager.IMPORTANCE_LOW))
      }
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
        PendingIntent.getActivity(context, 0, it.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), flags)
      }
      val cancel = PendingIntent.getService(
        context, 1, Intent(context, PavoTransferService::class.java).setAction(ACTION_CANCEL), flags
      )
      return NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.stat_sys_upload)
        .setContentTitle(title)
        .setContentText(text)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setProgress(100, percent.coerceIn(0, 100), percent < 0)
        .setContentIntent(open)
        .addAction(0, "Cancel", cancel)
        .build()
    }
  }
}
