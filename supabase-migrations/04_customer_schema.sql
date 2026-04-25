-- ============================================================
-- 04_customer_schema.sql
-- 새집느낌 고객앱(customer-app)용 도메인 스키마.
-- 파트너앱(cleaning-scheduler)과 동일 Supabase 프로젝트를 공유하며,
-- 기존 테이블(users, schedules, members 등)은 건드리지 않고
-- 고객 도메인은 신규 테이블로 분리한다.
--
-- Auth 모델: 파트너앱 `users`는 username/password 자체 관리이지만,
-- 고객앱은 Supabase Auth(`auth.users`)를 사용한다.
-- 즉 customers.id 는 auth.users(id) 와 1:1.
-- ============================================================

-- 1) 고객 프로필 (auth.users 1:1)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kakao_id TEXT,
  phone TEXT UNIQUE,
  name TEXT,
  email TEXT,
  default_address_id UUID,                 -- FK는 addresses 생성 후 ALTER로 부여
  marketing_opt_in BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2) 주소록
CREATE TABLE IF NOT EXISTS addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT,                              -- 집 / 회사 / 별장 등 별칭
  road_address TEXT NOT NULL,              -- 도로명
  jibun_address TEXT,                      -- 지번 (선택)
  detail TEXT,                             -- 상세주소
  zipcode TEXT,
  lat NUMERIC,
  lng NUMERIC,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS addresses_customer_idx ON addresses(customer_id);

ALTER TABLE customers
  ADD CONSTRAINT customers_default_address_fk
  FOREIGN KEY (default_address_id) REFERENCES addresses(id) ON DELETE SET NULL;

-- 3) 견적 요청
CREATE TABLE IF NOT EXISTS quote_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  category TEXT CHECK (category IN ('move_in','move_out','resident','moving')),
  area_pyeong INT,
  floor INT,
  options JSONB DEFAULT '{}'::jsonb,
  address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  photos TEXT[] DEFAULT '{}',
  preferred_date DATE,
  preferred_time TEXT,
  free_text TEXT,
  parsed JSONB,                            -- AI 파싱 결과 prefill 캐시
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','quoted','accepted','canceled')),
  estimated_amount INT,
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_requests_customer_created_idx
  ON quote_requests(customer_id, created_at DESC);

-- 4) 주문 (결제 단위)
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES quote_requests(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  amount INT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN
    ('pending','paid','assigned','in_progress','done','canceled','refunded')),
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  merchant_uid TEXT UNIQUE NOT NULL,       -- 포트원 주문번호 (앱에서 UUID 발급)
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS orders_customer_created_idx
  ON orders(customer_id, created_at DESC);

-- 5) 결제 로그 (포트원 imp_uid 기준 멱등키)
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  pg_provider TEXT,                        -- 'kakaopay' | 'naverpay' | 'tosspay' | 'card'
  pg_tx_id TEXT UNIQUE NOT NULL,           -- 포트원 imp_uid (UNIQUE = 중복 웹훅 방지)
  method TEXT,
  amount INT,
  status TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

-- 6) 상담 채팅방 (CS 1차 응대)
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID UNIQUE REFERENCES quote_requests(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  cs_user_id UUID REFERENCES users(id) ON DELETE SET NULL,    -- 본사 CS (파트너앱 users)
  agent_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- 배정된 팀장 (선택)
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7) 채팅 메시지
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_type TEXT CHECK (sender_type IN ('customer','cs','agent','system')),
  sender_id UUID,
  content TEXT,
  attachments TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_room_created_idx
  ON chat_messages(room_id, created_at);

-- 8) 리뷰
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  content TEXT,
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS (최소 정책 — Step 2a 단계는 insert가 없어 본인 행 select만)
-- 정책 추가/anon insert 허용은 Step 2b에서 확장.
-- ============================================================
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews        ENABLE ROW LEVEL SECURITY;

-- 본인 프로필
DROP POLICY IF EXISTS own_profile ON customers;
CREATE POLICY own_profile ON customers
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 본인 주소
DROP POLICY IF EXISTS own_addresses ON addresses;
CREATE POLICY own_addresses ON addresses
  FOR ALL TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- 본인 견적 요청
DROP POLICY IF EXISTS own_quotes ON quote_requests;
CREATE POLICY own_quotes ON quote_requests
  FOR ALL TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- 본인 주문
DROP POLICY IF EXISTS own_orders ON orders;
CREATE POLICY own_orders ON orders
  FOR ALL TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- 본인 채팅방 / 메시지 (read만; write는 Edge Function/Realtime 채널 인증)
DROP POLICY IF EXISTS own_chat_rooms ON chat_rooms;
CREATE POLICY own_chat_rooms ON chat_rooms
  FOR SELECT TO authenticated
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS own_chat_messages ON chat_messages;
CREATE POLICY own_chat_messages ON chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_rooms r
      WHERE r.id = chat_messages.room_id AND r.customer_id = auth.uid()
    )
  );

-- 본인 리뷰
DROP POLICY IF EXISTS own_reviews ON reviews;
CREATE POLICY own_reviews ON reviews
  FOR ALL TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- payments는 service_role(서버 웹훅) 전용 — 클라 직접 접근 금지.
-- 정책을 만들지 않으면 RLS 활성화된 상태에서 anon/authenticated는 모두 차단됨.
-- (service_role은 RLS 우회)

-- ============================================================
-- 확인 쿼리 (실행 후 Studio Table Editor에서 8개 테이블 표시 확인)
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema = 'public'
--      AND table_name IN ('customers','addresses','quote_requests','orders',
--                         'payments','chat_rooms','chat_messages','reviews')
--    ORDER BY table_name;
-- ============================================================
