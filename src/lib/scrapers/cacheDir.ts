import path from "node:path";

// Vercel/AWS Lambda의 파일시스템은 /tmp를 제외하면 읽기 전용이다.
// process.cwd()/.cache 로 쓰면 writeCache가 조용히 실패하고
// readCache는 영구 미스 → 디스크 캐시가 사실상 없는 것과 같아진다.
// 서버리스에서는 /tmp를 쓰고, 로컬 개발에서는 기존 경로를 유지한다.
const IS_SERVERLESS =
  !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

export const CACHE_DIR = IS_SERVERLESS
  ? "/tmp/kor-welfare-hub-cache"
  : path.join(process.cwd(), ".cache");
