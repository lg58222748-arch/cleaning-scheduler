export interface Member {
  id: string;
  name: string;
  color: string;
  phone?: string;
  availableDays: number[]; // 0=일, 1=월, ..., 6=토
  active: boolean;
  linkedUsername?: string; // 연결된 로그인 아이디
}

export interface Schedule {
  id: string;
  memberId: string;
  memberName: string;
  title: string;
  location: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: "confirmed" | "pending" | "swapRequested" | "unassigned";
  assignedTo?: string; // 배정된 팀장 ID (미배정이면 빈값)
  assignedToName?: string; // 배정된 팀장 이름
  googleEventId?: string;
  note?: string;
  color?: string; // 일정 색상 (#FDDCCC, #DBEAFE, #D1FAE5, #E9D5FF, #FEF3C7)
}

export interface SwapRequest {
  id: string;
  fromScheduleId: string;
  toScheduleId: string;
  fromMemberId: string;
  toMemberId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export type NotificationType =
  | "schedule_created"
  | "schedule_cancelled"
  | "schedule_updated"
  | "happy_call_reminder"
  | "swap_requested"
  | "swap_approved"
  | "swap_rejected";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  scheduleId?: string;
  read: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  scheduleId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

// ===== 회원/관리사 =====
export type UserRole = "ceo" | "scheduler" | "sales" | "field" | "pending";
export type UserStatus = "pending" | "approved" | "rejected";

export interface User {
  id: string;
  username: string; // 로그인 아이디
  password: string; // 비밀번호 (프로토타입: 평문)
  name: string;
  phone: string;
  address: string;
  residentNumber: string; // 주민등록번호
  businessLicenseFile: string; // 파일명만 저장
  branch: string; // 관리점 (예: "서울[관리점]")
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

// ===== 체크리스트 =====
export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface ChecklistCategory {
  id: string;
  name: string;
  icon: string;
  items: ChecklistItem[];
}

export interface ScheduleChecklist {
  id: string;
  scheduleId: string;
  categories: ChecklistCategory[];
  completedCount: number;
  totalCount: number;
  submittedAt?: string;
}

// ===== 정산 =====
export type PaymentMethod = "transfer" | "cash" | "card";

export interface Settlement {
  id: string;
  scheduleId: string;
  quote: number; // 견적금액 (공급가액)
  deposit: number; // 예약금
  balance: number; // 잔금 = 견적 - 예약금
  extraCharge: number; // 현장 추가금
  subtotal: number; // 세전합계 = 잔금 + 추가금
  vat: number; // 부가세 = 세전합계 × 0.1
  totalAmount: number; // 최종결제 = 세전합계 + 부가세
  paymentMethod: PaymentMethod;
  cashReceipt: boolean;
  bankInfo: string;
  customerName: string;
  customerPhone: string;
  note: string;
  status: "draft" | "completed";
  createdAt: string;
}
