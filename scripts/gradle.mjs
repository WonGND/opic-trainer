/**
 * Gradle 래퍼를 운영체제에 맞게 실행합니다.
 *
 * 이 스크립트가 해결하는 문제 3가지
 *  1) 윈도우는 `gradlew.bat`, macOS·리눅스는 `./gradlew` 로 실행 명령이 다릅니다.
 *  2) Android Studio 는 JDK 를 함께 설치하지만 JAVA_HOME/PATH 에 등록하지 않아
 *     터미널 빌드가 "JAVA_HOME is not set" 으로 실패합니다.
 *  3) 최신 Android Studio 의 내장 JDK 는 Java 25 인데, Gradle 8.x 는 Java 24 까지만
 *     지원해서 "Unsupported class file major version 69" 로 실패합니다.
 *     → 설치된 JDK 들을 훑어 호환되는 버전(21 우선)을 골라 씁니다.
 *
 * 사용: node scripts/gradle.mjs assembleDebug
 * Node 내장 모듈만 사용합니다(의존성 없음).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ANDROID = join(ROOT, "android");
const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";

/* Gradle 8.x 가 돌아가는 범위. Android Gradle Plugin 은 17 또는 21 을 권장하므로
   21 → 17 → 그 외(18~24) 순으로 선호합니다. 25 이상은 아직 지원되지 않습니다. */
const MIN_JDK = 17, MAX_JDK = 24, PREFERRED = [21, 17];

const javaExe = (home) => join(home, "bin", isWin ? "java.exe" : "java");
const isJdk = (home) => !!home && existsSync(javaExe(home));

/** JDK 홈의 release 파일에서 메이저 버전을 읽습니다. 없으면 java -version 으로 확인합니다. */
function jdkMajor(home) {
  try {
    const rel = join(home, "release");
    if (existsSync(rel)) {
      const m = /JAVA_VERSION="?([0-9._]+)"?/.exec(readFileSync(rel, "utf8"));
      if (m) {
        const v = m[1];
        return v.startsWith("1.") ? parseInt(v.split(".")[1], 10) : parseInt(v.split(".")[0], 10);
      }
    }
  } catch {}
  try {
    const r = spawnSync(javaExe(home), ["-version"], { encoding: "utf8" });
    const out = (r.stderr || "") + (r.stdout || "");
    const m = /version "?([0-9._]+)/.exec(out);
    if (m) {
      const v = m[1];
      return v.startsWith("1.") ? parseInt(v.split(".")[1], 10) : parseInt(v.split(".")[0], 10);
    }
  } catch {}
  return null;
}

/** 하위 폴더 전체를 나열합니다 (JDK 여부는 보지 않음) */
function scanDirAll(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(dir, d.name));
  } catch {
    return [];
  }
}

/** 하위 폴더 중 JDK 로 보이는 것들을 모읍니다 (예: ~/.jdks/*, C:\Program Files\Java\*) */
function scanDir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(dir, d.name))
      .filter(isJdk);
  } catch {
    return [];
  }
}

function candidates() {
  const home = homedir();
  const out = [];
  const push = (p) => { if (p && isJdk(p)) out.push(p); };

  push(process.env.JAVA_HOME);

  // PATH 에 있는 java 의 실제 홈
  const probe = spawnSync(isWin ? "where" : "which", ["java"], { shell: isWin, encoding: "utf8" });
  if (probe.status === 0) {
    const first = (probe.stdout || "").split(/\r?\n/).find(Boolean);
    if (first) push(dirname(dirname(first.trim())));
  }

  // IDE 가 내려받은 JDK (Android Studio: Gradle JDK → Download JDK)
  out.push(...scanDir(join(home, ".jdks")));
  // Gradle 툴체인 자동 프로비저닝이 받아둔 JDK (Gradle JVM criteria 로 버전을 지정한 경우)
  const gradleHome = process.env.GRADLE_USER_HOME || join(home, ".gradle");
  out.push(...scanDir(join(gradleHome, "jdks")));
  // 위 폴더는 한 단계 더 들어가 있는 경우가 있습니다 (예: .gradle/jdks/<배포판>/<jdk홈>)
  for (const d of scanDirAll(join(gradleHome, "jdks"))) out.push(...scanDir(d));
  for (const d of scanDirAll(join(home, ".jdks"))) out.push(...scanDir(d));

  if (isWin) {
    const pf = process.env["ProgramFiles"] || "C:\\Program Files";
    const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const local = process.env["LOCALAPPDATA"] || join(home, "AppData", "Local");
    // 일반 JDK 설치 위치
    for (const d of [join(pf, "Java"), join(pf, "Eclipse Adoptium"), join(pf, "Microsoft"),
                     join(pf, "Amazon Corretto"), join(pf, "Zulu"), join(pf86, "Java")])
      out.push(...scanDir(d));
    // Android Studio 내장 JDK
    for (const r of [join(pf, "Android"), join(pf86, "Android"), join(local, "Programs"),
                     join(local, "Programs", "Android")])
      for (const n of ["Android Studio", "Android Studio Preview"])
        for (const j of ["jbr", "jre"]) push(join(r, n, j));
  } else if (isMac) {
    try {
      for (const d of readdirSync("/Library/Java/JavaVirtualMachines"))
        push(join("/Library/Java/JavaVirtualMachines", d, "Contents", "Home"));
    } catch {}
    for (const r of ["/Applications", join(home, "Applications")])
      for (const n of ["Android Studio.app", "Android Studio Preview.app"])
        for (const j of ["jbr", "jre"]) push(join(r, n, "Contents", j, "Contents", "Home"));
  } else {
    for (const d of ["/usr/lib/jvm", "/usr/java"]) out.push(...scanDir(d));
    for (const p of ["/opt/android-studio", join(home, "android-studio"), "/usr/local/android-studio"])
      for (const j of ["jbr", "jre"]) push(join(p, j));
  }
  return [...new Set(out)];
}

function pickJdk() {
  const found = candidates().map((home) => ({ home, major: jdkMajor(home) }));
  const usable = found.filter((j) => j.major != null && j.major >= MIN_JDK && j.major <= MAX_JDK);
  for (const want of PREFERRED) {
    const hit = usable.find((j) => j.major === want);
    if (hit) return { pick: hit, found };
  }
  return { pick: usable[0] || null, found };
}

// ── 실행 ──────────────────────────────────────────────────────────────

/* 경로에 ASCII 가 아닌 문자(한글 등)가 있으면 안드로이드 빌드 도구가 실패합니다.
   윈도우에서 사용자 이름이 한글이면 바탕화면·문서 경로가 전부 여기 걸립니다.
   Gradle 이 40초쯤 돌다 실패하므로, 시작 전에 먼저 알려줍니다. */
const nonAscii = (p) => /[^\x00-\x7F]/.test(p);
if (nonAscii(ROOT)) {
  console.error("\n✗ 프로젝트 경로에 한글(또는 ASCII 가 아닌 문자)이 있어 빌드할 수 없습니다.\n");
  console.error(`  현재 위치: ${ROOT}`);
  console.error("  안드로이드 빌드 도구가 이런 경로를 처리하지 못합니다.\n");
  console.error("  해결: 영문·숫자로만 된 경로로 옮기세요. 예) C:\\dev\\opic-trainer\n");
  console.error("    mkdir C:\\dev");
  console.error("    cd C:\\dev");
  console.error("    git clone -b feat/capacitor-android https://github.com/WonGND/opic-trainer.git");
  console.error("    cd opic-trainer");
  console.error("    npm install");
  console.error("    npm run build:debug\n");
  process.exit(1);
}
if (nonAscii(process.env.GRADLE_USER_HOME || homedir())) {
  console.log("[opic] 참고: 사용자 폴더 경로에 한글이 있습니다.");
  console.log("       빌드가 경로 문제로 실패하면 Gradle 캐시 위치도 옮겨 보세요:");
  console.log('       [Environment]::SetEnvironmentVariable("GRADLE_USER_HOME","C:\\gradle-home","User")');
}

/* Android SDK 위치를 android/local.properties 에 적어줍니다.
   Android Studio 로 프로젝트를 한 번 열면 자동 생성되지만, 터미널만 쓰는 경우에는
   "SDK location not found" 로 실패합니다. 흔한 설치 위치를 찾아 대신 써 둡니다. */
function sdkCandidates() {
  const home = homedir();
  const out = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT];
  if (isWin) {
    const local = process.env["LOCALAPPDATA"] || join(home, "AppData", "Local");
    out.push(join(local, "Android", "Sdk"), join(local, "Android", "sdk"),
             "C:\\Android\\Sdk", "C:\\Android\\sdk");
  } else if (isMac) {
    out.push(join(home, "Library", "Android", "sdk"));
  } else {
    out.push(join(home, "Android", "Sdk"), "/usr/lib/android-sdk", "/opt/android-sdk");
  }
  return out.filter(Boolean);
}
const looksLikeSdk = (p) =>
  existsSync(join(p, "platform-tools")) || existsSync(join(p, "platforms")) || existsSync(join(p, "licenses"));

/* .properties 파일은 ASCII 로 두는 것이 안전합니다.
   경로에 한글이 있으면 \uXXXX 로 이스케이프해 인코딩 문제를 피합니다. */
function propEscape(v) {
  return [...v].map((ch) => {
    if (ch === "\\") return "\\\\";
    if (ch === ":") return "\\:";
    const c = ch.codePointAt(0);
    return c > 127 ? "\\u" + c.toString(16).padStart(4, "0") : ch;
  }).join("");
}

function ensureLocalProperties() {
  const lp = join(ANDROID, "local.properties");
  if (existsSync(lp) && /^\s*sdk\.dir\s*=/m.test(readFileSync(lp, "utf8"))) return true;
  const sdk = sdkCandidates().find((p) => { try { return existsSync(p) && looksLikeSdk(p); } catch { return false; } });
  if (!sdk) {
    console.error("\n✗ Android SDK 를 찾을 수 없습니다.\n");
    console.error("  Android Studio 를 설치하고 첫 실행 마법사(Standard)를 끝까지 진행하면 함께 설치됩니다.");
    console.error("  https://developer.android.com/studio\n");
    console.error("  이미 설치했다면 위치를 직접 지정하세요:");
    if (isWin) {
      console.error('    [Environment]::SetEnvironmentVariable("ANDROID_HOME","$env:LOCALAPPDATA\\Android\\Sdk","User")');
      console.error("    지정 후 PowerShell 을 새로 열고 다시 실행하세요.");
    } else {
      console.error('    export ANDROID_HOME="$HOME/Library/Android/sdk"   # macOS');
    }
    console.error("");
    return false;
  }
  try {
    writeFileSync(lp,
      "# 이 파일은 빌드 스크립트가 자동으로 만들었습니다. 각자 PC 마다 경로가 달라 커밋하지 않습니다.\n" +
      "sdk.dir=" + propEscape(sdk) + "\n", "utf8");
    console.log(`[opic] Android SDK 위치를 적었습니다: ${sdk}`);
    if (nonAscii(sdk)) {
      console.log("[opic] 참고: SDK 경로에 한글이 있습니다. 빌드가 리소스 단계에서 실패하면");
      console.log("       Android Studio 의 SDK Manager 에서 위치를 C:\\Android\\Sdk 로 바꿔 다시 받으세요.");
    }
    return true;
  } catch (e) {
    console.error("✗ local.properties 를 쓰지 못했습니다:", e.message);
    return false;
  }
}

if (!ensureLocalProperties()) process.exit(1);

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

const { pick, found } = pickJdk();
if (!pick) {
  console.error("\n✗ 이 빌드에 쓸 수 있는 JDK 를 찾지 못했습니다.");
  console.error(`  필요한 버전: Java ${MIN_JDK}~${MAX_JDK} (권장 21)\n`);
  if (found.length) {
    console.error("  찾은 JDK:");
    for (const j of found) {
      const why = j.major == null ? "버전 확인 실패"
        : j.major > MAX_JDK ? `Java ${j.major} — 너무 최신이라 Gradle 이 지원하지 않음`
        : `Java ${j.major} — 너무 낮음`;
      console.error(`    · ${j.home}  (${why})`);
    }
    console.error("");
  }
  console.error("  해결: JDK 21 을 설치하고 JAVA_HOME 을 지정하세요.");
  console.error("    다운로드: https://adoptium.net/temurin/releases/?version=21");
  if (isWin) {
    console.error('    설치 후:  [Environment]::SetEnvironmentVariable("JAVA_HOME","C:\\Program Files\\Eclipse Adoptium\\jdk-21...","User")');
    console.error("    지정 후 PowerShell 을 새로 열어야 적용됩니다.");
  } else {
    console.error('    설치 후:  export JAVA_HOME="/path/to/jdk-21"');
  }
  console.error("\n  (Android Studio 에서 프로젝트를 연 뒤 Settings → Build, Execution, Deployment →");
  console.error("   Build Tools → Gradle → Gradle JDK → Download JDK 로 21 을 받아도 인식합니다.");
  console.error("   프로젝트를 열지 않았다면 Gradle JVM criteria 의 Version 을 21 로 바꾸세요.)\n");
  process.exit(1);
}

console.log(`[opic] JDK ${pick.major} 사용: ${pick.home}`);
const skipped = found.filter((j) => j.home !== pick.home && j.major != null && j.major > MAX_JDK);
if (skipped.length) {
  console.log(`[opic] (Java ${skipped.map((j) => j.major).join(", ")} 는 Gradle 이 아직 지원하지 않아 건너뜁니다)`);
}

const r = spawnSync(isWin ? "gradlew.bat" : "./gradlew", args, {
  cwd: ANDROID,
  stdio: "inherit",
  env: { ...process.env, JAVA_HOME: pick.home },
  shell: isWin, // 윈도우에서 .bat 을 실행하려면 셸이 필요합니다
});

if (r.error) {
  console.error("✗ Gradle 실행 실패:", r.error.message);
  process.exit(1);
}
process.exit(r.status == null ? 1 : r.status);
