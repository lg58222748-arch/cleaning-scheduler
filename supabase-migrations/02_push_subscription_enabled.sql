-- 푸시 구독에 on/off 플래그 추가
-- 기존 방식(sw.js 메모리 플래그)은 SW 재시작 시 초기화되고, FCM(APK)은 sw.js를 거치지 않아 작동 안 함.
-- 서버가 발송 대상에서 제외하도록 DB 컬럼으로 관리.

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;
