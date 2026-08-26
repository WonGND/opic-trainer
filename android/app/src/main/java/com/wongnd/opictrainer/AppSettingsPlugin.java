package com.wongnd.opictrainer;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 시스템 설정 화면으로 보내는 최소 플러그인.
 *
 * 알림 권한이 거부됐거나 배터리 최적화로 알림이 지연될 때, 사용자를 해당 설정으로
 * 안내하려면 네이티브 인텐트가 필요합니다. 서드파티 의존성을 늘리지 않으려고
 * 필요한 것만 직접 구현했습니다.
 *
 * JS 에서: window.Capacitor.Plugins.AppSettings.openAppSettings()
 */
@CapacitorPlugin(name = "AppSettings")
public class AppSettingsPlugin extends Plugin {

    private void launch(PluginCall call, Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("설정 화면을 열지 못했습니다: " + e.getMessage());
        }
    }

    /** 앱 정보 화면 (권한 항목이 여기에 있습니다) */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        launch(call, new Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", getContext().getPackageName(), null)));
    }

    /** 앱 알림 설정 화면 (채널별 on/off 를 여기서 봅니다) */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent i;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.fromParts("package", getContext().getPackageName(), null));
        }
        launch(call, i);
    }

    /**
     * 배터리 최적화 예외 목록 화면.
     * 곧바로 예외를 요청하는 다이얼로그(REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)는
     * Play 정책상 별도 권한 선언이 필요해, 목록으로 보내 사용자가 직접 고르게 합니다.
     */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        launch(call, new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
    }

    /** 정확한 알람 권한 설정 화면 (Android 12+) */
    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            launch(call, new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.fromParts("package", getContext().getPackageName(), null)));
        } else {
            call.resolve();
        }
    }

    /** 이 앱이 배터리 최적화에서 제외돼 있는지 */
    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        boolean ignoring = true;   // 확인 불가하면 경고를 띄우지 않습니다
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                ignoring = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            }
        } catch (Exception ignored) {
        }
        JSObject ret = new JSObject();
        ret.put("value", ignoring);
        call.resolve(ret);
    }

    /** 정확한 알람을 예약할 수 있는 상태인지 (Android 12+ 에서 사용자가 끌 수 있습니다) */
    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        boolean can = true;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                if (am != null) can = am.canScheduleExactAlarms();
            }
        } catch (Exception ignored) {
        }
        JSObject ret = new JSObject();
        ret.put("value", can);
        call.resolve(ret);
    }
}
