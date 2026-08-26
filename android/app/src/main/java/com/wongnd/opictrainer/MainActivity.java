package com.wongnd.opictrainer;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 시스템 설정 화면으로 보내는 로컬 플러그인 등록 (super.onCreate 이전이어야 합니다)
        registerPlugin(AppSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
