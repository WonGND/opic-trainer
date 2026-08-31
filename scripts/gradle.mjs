/**
 * Gradle 래퍼를 운영체제에 맞게 실행합니다.
 *
 * 1) 윈도우는 `gradlew.bat`, macOS·리눅스는 `./gradlew` 라서 npm 스크립트에
 *    한쪽만 적어두면 다른 쪽에서 실행이 안 됩니다.
 * 2) Android Studio 는 JDK(JBR) 를 함께 설치하지만 JAVA_HOME 이나 PATH 에
 *    등록해 주지 않습니다. 그래서 터미널에서 Gradle 을 돌리면
 *    "JAVA_HOME is not set" 으로 실패합니다.
 *    JAVA_HOME 이 없으면 Android Studio 가 설치한 JDK 를 찾아 자동으로 씁니다.
 *
 * 사용: node scripts/gradle.mjs assembleDebug
 * Node 내장 모듈만 사용합니다(의존성 없음).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ANDROID = join(ROOT, "android");
const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";
const javaBin = (home) => join(home, "bin", isWin ? "java.exe" : "java");
const isJdk = (home) => !!home && existsSync(javaBin(home));

/** Android Studio 가 함께 설치하는 JDK(JBR) 후보 경로 */
function jdkCandidates() {
  const home = homedir();
  if (isWin) {
    const pf = process.env["ProgramFiles"] || "C:\\Program Files";
    const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const local = process.env["LOCALAPPDATA"] || join(home, "AppData", "Local");
    const names = ["Android Studio", "Android Studio Preview"];
    const roots = [join(pf, "Android"), join(pf86, "Android"), join(local, "Programs"),
                   join(local, "Programs", "Android"), join(local, "JetBrains", "Toolbox", "apps")];
    const out = [];
    for (const r of roots) for (const n of names) for (const j of ["jbr", "jre"]) out.push(join(r, n, j));
    return out;
  }
  if (isMac) {
    const out = [];
    for (const r of ["/Applications", join(home, "Applications")])
      for (const n of ["Android Studio.app", "Android Studio Preview.app"])
        for (const j of ["jbr", "jre"])
          out.push(join(r, n, "Contents", j, "Contents", "Home"));
    return out;
  }
  return ["/opt/android-studio/jbr", "/opt/android-studio/jre",
          join(home, "android-studio", "jbr"), join(home, "android-studio", "jre"),
          "/usr/local/android-studio/jbr"];
}

function resolveJavaHome() {
  if (isJdk(process.env.JAVA_HOME)) return { home: process.env.JAVA_HOME, from: "JAVA_HOME" };
  // PATH 에 java 가 있으면 Gradle 이 알아서 찾습니다
  const probe = spawnSync(isWin ? "where" : "which", ["java"], { shell: isWin, encoding: "utf8" });
  if (probe.status === 0 && (probe.stdout || "").trim()) return { home: null, from: "PATH" };
  for (const c of jdkCandidates()) if (isJdk(c)) return { home: c, from: "Android Studio 내장 JDK" };
  return { home: null, from: null };
}

const wrapper = join(ANDROID, isWin ? "gradlew.bat" : "gradlew");
if (!existsSync(wrapper)) {
  console.error(`✗ Gradle 래퍼를 찾을 수 없습니다: ${wrapper}`);
  console.error("  저장소 루트에서 실행했는지 확인하세요.");
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error("✗ 실행할 Gradle 작업을 지정하세요. 예: node scripts/gradle.mjs assembleDebug");
  process.exit(1);
}

const jdk = resolveJavaHome();
if (!jdk.from) {
  console.error("\n✗ Java(JDK) 를 찾을 수 없어 빌드를 시작할 수 없습니다.\n");
  console.error("  Android Studio 를 설치하면 JDK 가 함께 깔리지만, 터미널에는 등록되지 않습니다.");
  console.error("  아래 중 하나로 해결하세요.\n");
  console.error("  1) Android Studio 를 설치했다면 — 설치 경로를 JAVA_HOME 으로 지정");
  if (isWin) {
    console.error('     [Environment]::SetEnvironmentVariable("JAVA_HOME","C:\\Program Files\\Android\\Android Studio\\jbr","User")');
    console.error("     지정 후 PowerShell 을 새로 여세요.");
  } else {
    console.error('     export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"');
  }
  console.error("\n  2) Android Studio 로 android 폴더를 열고 Build → Build APK(s) 로 빌드");
  console.error("\n  3) JDK 21 을 직접 설치: https://adoptium.net/temurin/releases/?version=21\n");
  process.exit(1);
}

const env = { ...process.env };
if (jdk.home) {
  env.JAVA_HOME = jdk.home;
  console.log(`[opic] JAVA_HOME 자동 설정 (${jdk.from}): ${jdk.home}`);
}

const r = spawnSync(isWin ? "gradlew.bat" : "./gradlew", args, {
  cwd: ANDROID,
  stdio: "inherit",
  env,
  shell: isWin, // 윈도우에서 .bat 을 실행하려면 셸이 필요합니다
});

if (r.error) {
  console.error("✗ Gradle 실행 실패:", r.error.message);
  process.exit(1);
}
process.exit(r.status == null ? 1 : r.status);
