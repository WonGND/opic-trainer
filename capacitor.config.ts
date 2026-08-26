import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wongnd.opictrainer',
  appName: 'OPIc Trainer',

  /* 빌드 단계가 없는 정적 사이트라 루트에 index.html 이 있습니다.
     루트를 webDir 로 쓰면 node_modules/ · android/ 까지 APK 에 들어가므로,
     scripts/sync-web.mjs 가 필요한 파일만 복사한 www/ 를 씁니다.
     (npm run sync:web → npx cap sync android) */
  webDir: 'www',

  server: {
    /* https 스킴을 유지해야 window.isSecureContext 가 true 가 되고,
       그래야 앱의 마이크(getUserMedia) 가드를 통과합니다. */
    androidScheme: 'https',
  },

  android: {
    allowMixedContent: false,   // AI 첨삭 엔드포인트가 https 라 평문 통신이 필요 없습니다
  },

  plugins: {
    LocalNotifications: {
      /* 상태바 아이콘은 반드시 흰색 단색 실루엣 + 투명 배경이어야 합니다.
         컬러 이미지를 넣으면 흰 사각형으로만 보입니다.
         위치: android/app/src/main/res/drawable-<밀도>/ic_stat_notify.png */
      smallIcon: 'ic_stat_notify',
      iconColor: '#1F6F6B',
    },
  },
};

export default config;
