-- 1. Users (회원/관리사)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  resident_number TEXT DEFAULT '',
  business_license_file TEXT DEFAULT '',
  role TEXT DEFAULT 'pending' CHECK (role IN ('admin','manager','pending')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 기본 관리자 계정
INSERT INTO users (username, password, name, phone, address, role, status)
VALUES ('admin', '1234', '관리자', '010-0000-0000', '서울시 강남구', 'admin', 'approved')
ON CONFLICT (username) DO NOTHING;

-- 2. Members (팀원)
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  phone TEXT DEFAULT '',
  available_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],
  active BOOLEAN DEFAULT true
);

-- 기본 팀원 데이터
INSERT INTO members (name, color, phone, available_days, active) VALUES
  ('김민수', '#3B82F6', '010-1234-5678', ARRAY[1,2,3,4,5], true),
  ('이영희', '#EF4444', '010-2345-6789', ARRAY[1,2,3,4,5], true),
  ('박지훈', '#10B981', '010-3456-7890', ARRAY[1,3,5], true),
  ('최수진', '#F59E0B', '010-4567-8901', ARRAY[2,4,6], true)
ON CONFLICT DO NOTHING;

-- 3. Schedules (일정)
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id TEXT DEFAULT '',
  member_name TEXT DEFAULT '미배정',
  title TEXT NOT NULL,
  location TEXT DEFAULT '',
  date DATE NOT NULL,
  start_time TEXT DEFAULT '09:00',
  end_time TEXT DEFAULT '18:00',
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed','pending','swapRequested','unassigned')),
  assigned_to TEXT,
  assigned_to_name TEXT,
  google_event_id TEXT,
  note TEXT DEFAULT ''
);

-- 4. Swap Requests (교환 요청)
CREATE TABLE IF NOT EXISTS swap_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_schedule_id TEXT NOT NULL,
  to_schedule_id TEXT NOT NULL,
  from_member_id TEXT NOT NULL,
  to_member_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Notifications (알림)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  schedule_id TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Comments (댓글)
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Checklists (체크리스트)
CREATE TABLE IF NOT EXISTS checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id TEXT UNIQUE NOT NULL,
  categories JSONB NOT NULL DEFAULT '[]',
  completed_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  submitted_at TIMESTAMPTZ
);

-- 8. Settlements (정산)
CREATE TABLE IF NOT EXISTS settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id TEXT UNIQUE NOT NULL,
  quote INTEGER DEFAULT 0,
  deposit INTEGER DEFAULT 0,
  balance INTEGER DEFAULT 0,
  extra_charge INTEGER DEFAULT 0,
  subtotal INTEGER DEFAULT 0,
  vat INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0,
  payment_method TEXT DEFAULT 'transfer' CHECK (payment_method IN ('transfer','cash','card')),
  cash_receipt BOOLEAN DEFAULT false,
  bank_info TEXT DEFAULT '우리은행 1005-504-852384 (주식회사 새집느낌)',
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','completed')),
  created_at TIMESTAMPTZ DEFAULT now()
);
