# OPIc 영어 재료 창고

OPIc 스피킹 대비 인풋 학습 앱. **웹(PWA)** 과 **안드로이드 설치형 앱(APK)** 두 가지로 씁니다.

| | 웹 | 안드로이드 앱 |
|---|---|---|
| 주소 / 산출물 | https://wongnd.github.io/opic-trainer/ | `app-debug.apk` / `app-release.apk` |
| 학습 기능 전체 | ✅ | ✅ |
| 발음 듣기(TTS) | ✅ | ✅ (기기 TTS 엔진 필요) |
| 녹음 | ✅ | ✅ |
| 자동 받아쓰기(음성인식) | ✅ Chrome | ⚠️ **WebView 미지원 가능성 높음** — 아래 참고 |
| 매일 알림 | ❌ | ✅ |
| 오프라인 | ✅ 서비스워커 | ✅ APK 내장 |

두 버전은 **같은 `index.html`** 을 씁니다. 학습 데이터(localStorage)는 웹과 앱이 서로 분리되어 **공유되지 않습니다.**

---

## 1. 구조

```
index.html                  앱 전체 (단일 파일, 의존성 없음) — 웹·앱 공용
manifest.json  sw.js        PWA 용
icon-*.png                  아이콘 원본
worker.js                   Cloudflare Worker (AI 첨삭 서버) — 앱에 포함되지 않음
capacitor.config.ts         Capacitor 설정
scripts/sync-web.mjs        웹 자산 → www/ 복사
www/                        Capacitor webDir (자동 생성, git 제외)
android/                    안드로이드 프로젝트
```

**왜 `www/` 가 따로 있나:** 이 저장소는 빌드 단계가 없는 평면 정적 사이트라 루트에 `index.html` 이 있습니다. `webDir` 을 루트로 지정하면 `node_modules/`·`android/`·`.git/` 까지 APK 에 들어갑니다. 그래서 앱에 필요한 파일만 `www/` 로 복사해서 씁니다. **루트 파일은 그대로라 GitHub Pages 배포는 영향받지 않습니다.**

---

## 2. 처음 준비 (한 번만)

### 필요한 것
- **Node.js 20+**
- **Android Studio** + SDK — https://developer.android.com/studio
  - SDK Manager 에서 **Platform 36**, **Build-Tools 36**, **Platform-Tools** 설치
- **JDK 21** — Android Studio 가 함께 설치하므로 따로 받지 않아도 됩니다.

> ### ⚠️ JDK 버전 주의
>
> **필요한 버전은 Java 17~24 이며 21 을 권장합니다.** Gradle 8.x 는 아직 **Java 25 를
> 지원하지 않습니다**(`Unsupported class file major version 69` 오류).
> 최신 Android Studio 의 내장 JDK 는 Java 25 라서 그대로 쓰면 빌드가 실패합니다.
>
> `npm run build:debug` 는 설치된 JDK 들을 훑어 **호환되는 버전(21 우선)을 자동으로
> 골라** 씁니다. Java 25 만 있으면 건너뛰고 해결 방법을 안내합니다.
>
> JDK 21 을 얻는 가장 쉬운 방법은 Android Studio 안에서 받는 것입니다:
> **Settings → Build, Execution, Deployment → Build Tools → Gradle →
> Gradle JDK → Download JDK → 버전 21 선택.**
> `~/.jdks/` 에 설치되며 빌드 스크립트가 자동으로 인식합니다.
> 따로 설치하려면 https://adoptium.net/temurin/releases/?version=21 에서 받으세요.

### 환경변수

```bash
# macOS
export ANDROID_HOME="$HOME/Library/Android/sdk"
# Linux
# export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
```

**Windows (PowerShell)** — 영구 설정:

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME","$env:LOCALAPPDATA\Android\Sdk","User")
[Environment]::SetEnvironmentVariable("JAVA_HOME","C:\Program Files\Android\Android Studio\jbr","User")
```

설정 후 **PowerShell 창을 새로 열어야** 적용됩니다.
`JAVA_HOME` 은 빌드 스크립트가 자동으로 찾으므로 보통 지정하지 않아도 됩니다.

확인:

```bash
node -v && java -version && adb --version
```

### 의존성 설치

```bash
git clone https://github.com/WonGND/opic-trainer.git
cd opic-trainer
npm install
```

---

## 3. 빌드 → 폰 설치

### 디버그 APK (개발·테스트용)

```bash
npm run build:debug
```

산출물: **`android/app/build/outputs/apk/debug/app-debug.apk`**

설치 (둘 중 하나):

```bash
# A) USB 연결 — 폰에서 개발자 옵션 → USB 디버깅 켜기
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# B) 파일 전송 — APK 를 폰으로 옮긴 뒤 파일 관리자에서 탭
#    "출처를 알 수 없는 앱 설치" 를 허용해야 합니다
```

> 첫 Gradle 빌드는 의존성을 받느라 **10~20분** 걸릴 수 있습니다. 이후에는 1~2분입니다.

> **윈도우 사용자:** `npm run build:debug` 가 알아서 `gradlew.bat` 을 실행합니다.
> 직접 Gradle 을 부를 때만 폴더 차이를 신경 쓰면 됩니다
> (`cd android` 후 윈도우는 `.\gradlew.bat`, macOS·리눅스는 `./gradlew`).

> **`ANDROID_HOME` 을 따로 설정하기 번거롭다면**, Android Studio 로 `android` 폴더를
> 한 번 열어보세요. `android/local.properties` 에 SDK 경로가 자동으로 기록되어
> 이후 터미널 빌드도 그대로 동작합니다.

### 터미널이 어렵다면 — Android Studio 버튼으로 빌드

`npm install` 과 `npm run sync` 까지만 터미널에서 하고(이 둘은 반드시 필요합니다),
그다음은 GUI 로 해도 됩니다.

1. Android Studio → **Open** → 이 저장소의 **`android` 폴더** 선택
2. 오른쪽 아래 진행바가 멈출 때까지 대기 (Gradle 동기화 + 부족한 SDK 자동 설치)
3. 상단 메뉴 **Build → Build Bundle(s) / APK(s) → Build APK(s)**
4. 완료 팝업의 **locate** 를 누르면 APK 가 있는 폴더가 열립니다

### 웹 코드를 고친 뒤 앱에 반영

`index.html` 을 수정했다면:

```bash
npm run build:debug      # sync:web → cap sync → assembleDebug 를 한 번에
```

`npm run sync` 만 돌리면 자산 복사와 플러그인 동기화까지만 하고 APK 는 만들지 않습니다.

> **주의:** `www/` 는 `sync:web` 이 매번 지우고 새로 만듭니다. `www/` 안에서 직접 수정하지 마세요. 항상 **루트의 `index.html`** 을 고칩니다.

---

## 4. 매일 알림

**통계 탭 → ⚙️ 설정 → 🔔 매일 알림** 에서 켭니다.

- 서버·푸시를 쓰지 않고 폰 안에서만 예약합니다. 앱을 꺼두어도 울립니다.
- 시각을 바꾸면 기존 예약을 취소하고 다시 잡습니다. 예약은 **항상 1건(id 1)** 만 유지됩니다.
- 이미 지난 시각을 고르면 오늘 울리지 않고 **다음 날**로 잡힙니다. 설정 화면의 "다음 알림" 에서 확인할 수 있습니다.

### 알림이 안 울릴 때 — 이 순서대로 확인

1. **권한** — 설정 화면의 "알림 권한" 이 `허용됨` 인가?
   `거부됨` 이면 → **앱 알림 설정 열기** 버튼 → 알림 허용
   *(Android 13+ 는 런타임 권한이 없으면 매니페스트 선언과 무관하게 알림이 아예 뜨지 않습니다.)*

2. **배터리 최적화** — 노란 경고가 떠 있으면 → **배터리 설정 열기** → 이 앱을 "제한 없음" 으로
   특히 **삼성 One UI** 는 자주 안 쓰는 앱을 자동으로 절전 대상에 넣습니다:
   `설정 → 배터리 → 백그라운드 사용 제한 → 사용 안 함 앱` 에서 이 앱을 빼주세요.
   샤오미(MIUI)·오포·비보도 비슷한 자체 절전 기능이 있어 별도 예외 설정이 필요합니다.

3. **알람 및 리마인더** — 노란 경고가 떠 있으면 → **알람 권한 열기** → 허용
   *(Android 12+ 는 사용자가 이 권한을 끌 수 있고, 꺼져 있으면 정시에 울리지 않습니다.)*

4. **채널** — 앱 알림 설정에서 **"매일 학습 알림"** 채널이 켜져 있는지 확인
   *(채널을 한 번 끄면 앱에서는 다시 켤 수 없고 시스템 설정에서만 켤 수 있습니다.)*

5. **예약 확인** — 설정 화면의 **예약 목록 보기** 를 눌러 `id: 1` 이 원하는 시각으로 있는지 확인

6. **즉시 테스트** — **10초 뒤 테스트 알림** 으로 알림 자체가 뜨는지부터 확인

---

## 5. 릴리즈 빌드

### keystore 만들기 (직접 실행하세요)

```bash
keytool -genkeypair -v \
  -keystore ~/opic-release.keystore \
  -alias opic \
  -keyalg RSA -keysize 2048 -validity 10000
```

이름·조직 등을 묻고 비밀번호를 두 번(스토어/키) 정하게 됩니다.

> ### ⚠️ keystore 를 잃어버리면 되돌릴 수 없습니다
>
> 같은 keystore 로 서명해야만 **기존 앱을 덮어쓰는 업데이트**가 됩니다. 잃어버리면 사용자가 앱을 **지우고 새로 설치**해야 하고, **저장된 학습 데이터가 전부 사라집니다.**
>
> - keystore 파일과 비밀번호를 **저장소 밖** 안전한 곳(비밀번호 관리자, 암호화 백업)에 보관하세요.
> - 절대 커밋하지 마세요. `.gitignore` 에 `*.keystore`, `*.jks`, `keystore.properties` 가 들어 있습니다.

### 서명 정보 주입

`android/keystore.properties` 를 만듭니다 (git 제외됨):

```properties
storeFile=/Users/본인/opic-release.keystore
storePassword=스토어_비밀번호
keyAlias=opic
keyPassword=키_비밀번호
```

또는 환경변수로:

```bash
export OPIC_KEYSTORE_FILE=~/opic-release.keystore
export OPIC_KEYSTORE_PASSWORD=...
export OPIC_KEY_ALIAS=opic
export OPIC_KEY_PASSWORD=...
```

### 빌드

```bash
npm run build:release
```

산출물: **`android/app/build/outputs/apk/release/app-release.apk`**

서명 정보가 없으면 빌드는 되지만 **미서명 APK 라 설치되지 않습니다.** 빌드 로그에 `[opic] 서명 설정이 없어...` 경고가 나옵니다.

버전을 올리려면 `android/app/build.gradle` 의 `versionCode`(정수, 매번 증가)와 `versionName`(표시용)을 수정합니다.

---

## 6. 디버그 버튼 제거

설정 화면 하단의 개발용 버튼 3개(테스트 알림 / 예약 목록 / 전체 취소)는 `index.html` 의 `renderNotifBox()` 안에 한 블록으로 모여 있습니다.

```html
<!-- ▼▼▼ 개발용 디버그 도구 — 배포 전 이 블록만 지우면 됩니다 (README 참고) ▼▼▼ -->
...
<!-- ▲▲▲ 개발용 디버그 도구 끝 ▲▲▲ -->
```

이 주석 사이를 통째로 지우면 됩니다. 핸들러(`notif-test`, `notif-pending`, `notif-cancel-all`)는 남겨두어도 호출되지 않으므로 무해합니다.

---

## 7. 알려진 제약

**자동 받아쓰기(음성인식)** — `SpeechRecognition` 은 Chrome 브라우저 기능이라 **안드로이드 WebView 에는 없을 가능성이 높습니다.** 앱은 이를 감지해 "직접 옮겨 적어 주세요" 로 안전하게 대체하지만, **APK 에서는 이 기능을 못 쓸 수 있습니다.** 자동 전사가 꼭 필요하면 브라우저(Chrome)로 여세요. → **실기기에서 가장 먼저 확인할 항목입니다.**

**녹음 파일** — 용량 때문에 메모리에만 두므로 새로고침·앱 재시작 시 사라집니다. 받아쓴 텍스트와 첨삭 결과는 저장됩니다.

**서비스워커** — 앱에서는 일부러 등록하지 않습니다. cache-first 방식이라 `cap sync` 로 새 자산을 넣어도 예전 캐시가 계속 나오는데, 앱에서는 사용자가 캐시를 지울 방법이 사실상 없기 때문입니다. 자산이 APK 안에 있어 오프라인 동작에는 영향이 없습니다.

**웹과 앱의 데이터 분리** — 출처(origin)가 달라 학습 진도가 공유되지 않습니다. 한쪽으로 정해서 쓰세요.

**`USE_EXACT_ALARM`** — Google Play 는 알람·캘린더가 핵심 기능인 앱에만 이 권한을 허용합니다. 직접 설치(사이드로드)에는 제한이 없지만, Play 스토어에 올릴 계획이면 이 권한을 빼고 `SCHEDULE_EXACT_ALARM` 만 쓰도록 바꿔야 합니다.

**npm audit 경고** — `@capacitor/cli` → `xcode` → `uuid` 경로의 moderate 경고가 있습니다. iOS 프로젝트 조작용 개발 의존성이며 **APK 에 포함되지 않습니다.**

---

## 8. AI 첨삭 서버

`worker.js` 는 Cloudflare Workers AI 를 쓰는 무료 첨삭 서버입니다. 배포 방법은 파일 상단 주석에 있습니다. 앱에는 포함되지 않으며, 주소는 앱의 **통계 → 설정 → AI 작문 첨삭** 에서 바꿀 수 있습니다.

`Access-Control-Allow-Origin: *` 를 반환하므로 웹(`https://wongnd.github.io`)과 앱(`https://localhost`) 양쪽에서 호출됩니다.

---

## 9. 되돌리기

Capacitor 관련 작업은 전부 `feat/capacitor-android` 브랜치에 있습니다.

```bash
git checkout main            # 웹 전용 상태로 복귀
git branch -D feat/capacitor-android
```

`main` 은 웹 배포에 필요한 파일만 있는 원래 상태 그대로입니다.
