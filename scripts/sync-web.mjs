/**
 * 웹 자산을 Capacitor 의 webDir(www/) 로 복사합니다.
 *
 * 이 저장소는 빌드 단계가 없는 평면 정적 사이트라, 루트에 index.html 이 그대로 있습니다.
 * webDir 을 루트로 지정하면 node_modules/ · android/ · .git/ 까지 APK 에 들어가므로,
 * 앱에 필요한 파일만 www/ 로 복사해서 씁니다.
 *
 * 루트 파일은 건드리지 않으므로 GitHub Pages 웹 배포는 그대로 동작합니다.
 * Node 내장 모듈만 사용합니다(의존성 없음).
 */
import { cp, mkdir, rm, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "www");

/* 앱에 들어갈 파일만 명시합니다(허용 목록).
   worker.js 는 Cloudflare Worker 서버 코드라 앱에 포함하지 않습니다. */
const ASSETS = [
  "index.html",
  "manifest.json",
  "sw.js",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
];

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

let copied = 0;
for (const name of ASSETS) {
  const src = join(ROOT, name);
  if (!(await exists(src))) {
    console.error(`✗ 없는 파일: ${name}`);
    process.exitCode = 1;
    continue;
  }
  await cp(src, join(OUT, name));
  copied++;
}

if (process.exitCode === 1) {
  console.error("\n웹 자산이 누락되어 중단합니다. 저장소 루트에서 실행했는지 확인하세요.");
  process.exit(1);
}
console.log(`✓ www/ 로 ${copied}개 파일 복사 완료`);
