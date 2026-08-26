/**
 * Gradle 래퍼를 운영체제에 맞게 실행합니다.
 *
 * 윈도우는 `gradlew.bat`, macOS·리눅스는 `./gradlew` 라서 npm 스크립트에
 * 한쪽만 적어두면 다른 쪽에서 실행이 안 됩니다. 이 스크립트가 분기합니다.
 *
 * 사용: node scripts/gradle.mjs assembleDebug
 * Node 내장 모듈만 사용합니다(의존성 없음).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ANDROID = join(ROOT, "android");
const isWin = process.platform === "win32";
const wrapper = join(ANDROID, isWin ? "gradlew.bat" : "gradlew");

if (!existsSync(wrapper)) {
  console.error(`✗ Gradle 래퍼를 찾을 수 없습니다: ${wrapper}`);
  console.error("  저장소 루트에서 실행했는지, npx cap add android 가 끝났는지 확인하세요.");
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error("✗ 실행할 Gradle 작업을 지정하세요. 예: node scripts/gradle.mjs assembleDebug");
  process.exit(1);
}

const r = spawnSync(isWin ? "gradlew.bat" : "./gradlew", args, {
  cwd: ANDROID,
  stdio: "inherit",
  shell: isWin, // 윈도우에서 .bat 을 실행하려면 셸이 필요합니다
});

if (r.error) {
  console.error("✗ Gradle 실행 실패:", r.error.message);
  if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
    console.error("  ANDROID_HOME 이 설정돼 있지 않습니다. Android Studio 로 android 폴더를 한 번 열면");
    console.error("  android/local.properties 가 만들어져 SDK 경로가 잡힙니다. (README 참고)");
  }
  process.exit(1);
}
process.exit(r.status == null ? 1 : r.status);
