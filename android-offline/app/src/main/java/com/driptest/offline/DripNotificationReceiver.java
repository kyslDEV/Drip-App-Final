package com.driptest.offline;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.os.Build;

public class DripNotificationReceiver extends BroadcastReceiver {
    public static final String CHANNEL_ID = "driptest-reminders";

    @Override
    public void onReceive(Context context, Intent intent) {
        ensureNotificationChannel(context);

        String reminderId = intent != null ? intent.getStringExtra("reminderId") : null;
        String title = intent != null ? intent.getStringExtra("title") : null;
        String text = intent != null ? intent.getStringExtra("text") : null;

        if (title == null || title.trim().isEmpty()) {
            title = "Hora do gotejamento";
        }
        if (text == null || text.trim().isEmpty()) {
            text = "Confira o DripTest no celular.";
        }

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent contentIntent = PendingIntent.getActivity(
                context,
                reminderId == null ? 0 : reminderId.hashCode(),
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(context, CHANNEL_ID)
                : new Notification.Builder(context);

        builder.setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentIntent(contentIntent)
                .setAutoCancel(true)
                .setDefaults(Notification.DEFAULT_ALL)
                .setPriority(Notification.PRIORITY_HIGH);

        if (Build.VERSION.SDK_INT >= 21) {
            builder.setCategory(Notification.CATEGORY_REMINDER);
            builder.setVisibility(Notification.VISIBILITY_PUBLIC);
        }

        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        if (notificationManager != null) {
            notificationManager.notify(reminderId == null ? 1 : reminderId.hashCode(), builder.build());
        }
    }

    public static void ensureNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) {
            return;
        }

        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        if (notificationManager == null) {
            return;
        }

        NotificationChannel existing = notificationManager.getNotificationChannel(CHANNEL_ID);
        if (existing != null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Lembretes DripTest",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Alertas do gotejamento e conferencias do DripTest.");
        channel.enableLights(true);
        channel.enableVibration(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        if (Build.VERSION.SDK_INT >= 26) {
            channel.setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build());
        }
        notificationManager.createNotificationChannel(channel);
    }
}
