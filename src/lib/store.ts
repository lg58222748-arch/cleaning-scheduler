// 서버 사이드 인메모리 스토어 (프로토타입용)
// 프로덕션에서는 DB로 교체

import { Member, Schedule, SwapRequest, Notification, NotificationType, Comment, User, UserRole, UserStatus, ScheduleChecklist, ChecklistCategory, Settlement, PaymentMethod } from "@/types";

const MEMBER_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B",
  "#8B5CF6", "#EC4899", "#06B6D4", "#F97316",
];

let members: Member[] = [
  { id: "1", name: "김민수", color: MEMBER_COLORS[0], phone: "010-1234-5678", availableDays: [1, 2, 3, 4, 5], active: true },
  { id: "2", name: "이영희", color: MEMBER_COLORS[1], phone: "010-2345-6789", availableDays: [1, 2, 3, 4, 5], active: true },
  { id: "3", name: "박지훈", color: MEMBER_COLORS[2], phone: "010-3456-7890", availableDays: [1, 3, 5], active: true },
  { id: "4", name: "최수진", color: MEMBER_COLORS[3], phone: "010-4567-8901", availableDays: [2, 4, 6], active: true },
];

let schedules: Schedule[] = [];
let swapRequests: SwapRequest[] = [];
let nextId = 100;

export function genId(): string {
  return String(++nextId);
}

// Members
export function getMembers(): Member[] {
  return members;
}

export function getMember(id: string): Member | undefined {
  return members.find((m) => m.id === id);
}

export function addMember(data: Omit<Member, "id" | "color">): Member {
  const member: Member = {
    ...data,
    id: genId(),
    color: MEMBER_COLORS[members.length % MEMBER_COLORS.length],
  };
  members.push(member);
  return member;
}

export function updateMember(id: string, data: Partial<Member>): Member | null {
  const idx = members.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  members[idx] = { ...members[idx], ...data, id };
  return members[idx];
}

export function deleteMember(id: string): boolean {
  const len = members.length;
  members = members.filter((m) => m.id !== id);
  return members.length < len;
}

// Schedules
export function getSchedules(): Schedule[] {
  return schedules;
}

export function getSchedulesByDate(date: string): Schedule[] {
  return schedules.filter((s) => s.date === date);
}

export function getSchedulesByMember(memberId: string): Schedule[] {
  return schedules.filter((s) => s.memberId === memberId);
}

export function getSchedulesByRange(start: string, end: string): Schedule[] {
  return schedules.filter((s) => s.date >= start && s.date <= end);
}

export function getUnassignedSchedules(): Schedule[] {
  return schedules.filter((s) => s.status === "unassigned");
}

export function addSchedule(data: Omit<Schedule, "id" | "status">): Schedule {
  const schedule: Schedule = { ...data, id: genId(), status: "confirmed" };
  schedules.push(schedule);
  return schedule;
}

export function addUnassignedSchedule(data: Omit<Schedule, "id" | "status" | "memberId" | "memberName">): Schedule {
  const schedule: Schedule = {
    ...data,
    id: genId(),
    memberId: "",
    memberName: "미배정",
    status: "unassigned",
  };
  schedules.push(schedule);
  return schedule;
}

export function assignSchedule(scheduleId: string, memberId: string, memberName: string): Schedule | null {
  const idx = schedules.findIndex((s) => s.id === scheduleId);
  if (idx === -1) return null;
  schedules[idx].assignedTo = memberId;
  schedules[idx].assignedToName = memberName;
  schedules[idx].memberId = memberId;
  schedules[idx].memberName = memberName;
  schedules[idx].status = "confirmed";
  return schedules[idx];
}

export function unassignSchedule(scheduleId: string): Schedule | null {
  const idx = schedules.findIndex((s) => s.id === scheduleId);
  if (idx === -1) return null;
  schedules[idx].assignedTo = undefined;
  schedules[idx].assignedToName = undefined;
  schedules[idx].memberId = "";
  schedules[idx].memberName = "미배정";
  schedules[idx].status = "unassigned";
  return schedules[idx];
}

export function updateSchedule(id: string, data: Partial<Schedule>): Schedule | null {
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  schedules[idx] = { ...schedules[idx], ...data, id };
  return schedules[idx];
}

export function deleteSchedule(id: string): boolean {
  const len = schedules.length;
  schedules = schedules.filter((s) => s.id !== id);
  return schedules.length < len;
}

// Swap Requests
export function getSwapRequests(): SwapRequest[] {
  return swapRequests;
}

export function addSwapRequest(fromScheduleId: string, toScheduleId: string): SwapRequest | null {
  const from = schedules.find((s) => s.id === fromScheduleId);
  const to = schedules.find((s) => s.id === toScheduleId);
  if (!from || !to) return null;

  const req: SwapRequest = {
    id: genId(),
    fromScheduleId,
    toScheduleId,
    fromMemberId: from.memberId,
    toMemberId: to.memberId,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  swapRequests.push(req);
  return req;
}

export function approveSwap(swapId: string): boolean {
  const req = swapRequests.find((r) => r.id === swapId);
  if (!req || req.status !== "pending") return false;

  const fromIdx = schedules.findIndex((s) => s.id === req.fromScheduleId);
  const toIdx = schedules.findIndex((s) => s.id === req.toScheduleId);
  if (fromIdx === -1 || toIdx === -1) return false;

  // 팀원 교환
  const tempMemberId = schedules[fromIdx].memberId;
  const tempMemberName = schedules[fromIdx].memberName;
  schedules[fromIdx].memberId = schedules[toIdx].memberId;
  schedules[fromIdx].memberName = schedules[toIdx].memberName;
  schedules[toIdx].memberId = tempMemberId;
  schedules[toIdx].memberName = tempMemberName;

  req.status = "approved";
  return true;
}

export function rejectSwap(swapId: string): boolean {
  const req = swapRequests.find((r) => r.id === swapId);
  if (!req || req.status !== "pending") return false;
  req.status = "rejected";
  return true;
}

// Notifications
let notifications: Notification[] = [];

export function getNotifications(): Notification[] {
  return notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getUnreadCount(): number {
  return notifications.filter((n) => !n.read).length;
}

export function addNotification(type: NotificationType, title: string, message: string, scheduleId?: string): Notification {
  const n: Notification = {
    id: genId(),
    type,
    title,
    message,
    scheduleId,
    read: false,
    createdAt: new Date().toISOString(),
  };
  notifications.push(n);
  return n;
}

export function markNotificationRead(id: string): boolean {
  const n = notifications.find((x) => x.id === id);
  if (!n) return false;
  n.read = true;
  return true;
}

export function markAllNotificationsRead(): void {
  notifications.forEach((n) => { n.read = true; });
}

// Auto-generate happy call reminders for schedules happening tomorrow
export function checkHappyCallReminders(): Notification[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const tomorrowSchedules = schedules.filter((s) => s.date === tomorrowStr);
  const newReminders: Notification[] = [];

  for (const s of tomorrowSchedules) {
    const alreadyNotified = notifications.some(
      (n) => n.type === "happy_call_reminder" && n.scheduleId === s.id
    );
    if (!alreadyNotified) {
      const n = addNotification(
        "happy_call_reminder",
        "해피콜 요청",
        `내일 ${s.startTime} "${s.title}" 일정이 있습니다. ${s.memberName}님에게 해피콜을 진행해주세요.`,
        s.id
      );
      newReminders.push(n);
    }
  }
  return newReminders;
}

// Comments
let comments: Comment[] = [];

export function getCommentsBySchedule(scheduleId: string): Comment[] {
  return comments
    .filter((c) => c.scheduleId === scheduleId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function addComment(scheduleId: string, authorName: string, content: string): Comment {
  const c: Comment = {
    id: genId(),
    scheduleId,
    authorName,
    content,
    createdAt: new Date().toISOString(),
  };
  comments.push(c);
  return c;
}

export function deleteComment(id: string): boolean {
  const len = comments.length;
  comments = comments.filter((c) => c.id !== id);
  return comments.length < len;
}

// ===== Users =====
let users: User[] = [
  {
    id: "admin1",
    username: "admin",
    password: "1234",
    name: "관리자",
    phone: "010-0000-0000",
    address: "서울시 강남구",
    residentNumber: "******-*******",
    businessLicenseFile: "",
    role: "admin",
    status: "approved",
    createdAt: new Date().toISOString(),
  },
];

export function getUsers(): User[] {
  return users;
}

export function getUser(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function getUserByName(name: string): User | undefined {
  return users.find((u) => u.name === name);
}

export function getUserByUsername(username: string): User | undefined {
  return users.find((u) => u.username === username);
}

export function getPendingUsers(): User[] {
  return users.filter((u) => u.status === "pending");
}

export function registerUser(data: {
  username: string; password: string;
  name: string; phone: string; address: string;
  residentNumber: string; businessLicenseFile: string;
}): User {
  const user: User = {
    id: genId(),
    ...data,
    role: "pending",
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return user;
}

export function approveUser(id: string): boolean {
  const u = users.find((x) => x.id === id);
  if (!u) return false;
  u.status = "approved";
  u.role = "manager";
  return true;
}

export function rejectUser(id: string): boolean {
  const u = users.find((x) => x.id === id);
  if (!u) return false;
  u.status = "rejected";
  return true;
}

export function loginUser(username: string, password: string): User | null {
  const u = users.find((x) => x.username === username && x.password === password && x.status === "approved");
  return u || null;
}

export function findUserForLogin(username: string): User | undefined {
  return users.find((x) => x.username === username);
}

// ===== Checklist =====
const DEFAULT_CHECKLIST_TEMPLATE: ChecklistCategory[] = [
  {
    id: "cat1", name: "전체 천장", icon: "🔝",
    items: [
      { id: "c1-1", label: "환기디퓨저 오염/분진", checked: false },
      { id: "c1-2", label: "조명 커버 벌레사체/먼지", checked: false },
      { id: "c1-3", label: "몰딩 먼지/오염", checked: false },
      { id: "c1-4", label: "천장 꼼꼼이 확인", checked: false },
      { id: "c1-5", label: "흡기구 오염 확인", checked: false },
    ],
  },
  {
    id: "cat2", name: "전체 벽면", icon: "🧱",
    items: [
      { id: "c2-1", label: "인터폰/스위치 상단 먼지", checked: false },
      { id: "c2-2", label: "벽지 오염/얼룩", checked: false },
      { id: "c2-3", label: "문틀/문짝 오염", checked: false },
      { id: "c2-4", label: "콘센트 주변 오염", checked: false },
    ],
  },
  {
    id: "cat3", name: "전체 바닥", icon: "🏠",
    items: [
      { id: "c3-1", label: "본드 얼룩/잔여물", checked: false },
      { id: "c3-2", label: "걸레받이 오염", checked: false },
      { id: "c3-3", label: "문턱/새시레일 오염", checked: false },
    ],
  },
  {
    id: "cat4", name: "자주 놓치는 곳", icon: "🔍",
    items: [
      { id: "c4-1", label: "베란다 구석/배수구", checked: false },
      { id: "c4-2", label: "변기 안쪽/뒤쪽", checked: false },
      { id: "c4-3", label: "거울/유리 얼룩", checked: false },
      { id: "c4-4", label: "줄눈 오염", checked: false },
      { id: "c4-5", label: "배수구 머리카락/이물질", checked: false },
      { id: "c4-6", label: "에어컨 필터/외관", checked: false },
      { id: "c4-7", label: "싱크대 배수구/하부장", checked: false },
    ],
  },
];

let checklists: ScheduleChecklist[] = [];

function cloneTemplate(): ChecklistCategory[] {
  return JSON.parse(JSON.stringify(DEFAULT_CHECKLIST_TEMPLATE));
}

export function getChecklist(scheduleId: string): ScheduleChecklist {
  let cl = checklists.find((c) => c.scheduleId === scheduleId);
  if (!cl) {
    const categories = cloneTemplate();
    const totalCount = categories.reduce((sum, cat) => sum + cat.items.length, 0);
    cl = { id: genId(), scheduleId, categories, completedCount: 0, totalCount, submittedAt: undefined };
    checklists.push(cl);
  }
  return cl;
}

export function updateChecklistItem(scheduleId: string, itemId: string, checked: boolean): ScheduleChecklist | null {
  const cl = getChecklist(scheduleId);
  for (const cat of cl.categories) {
    const item = cat.items.find((i) => i.id === itemId);
    if (item) {
      item.checked = checked;
      break;
    }
  }
  cl.completedCount = cl.categories.reduce(
    (sum, cat) => sum + cat.items.filter((i) => i.checked).length, 0
  );
  return cl;
}

export function submitChecklist(scheduleId: string): ScheduleChecklist | null {
  const cl = getChecklist(scheduleId);
  cl.submittedAt = new Date().toISOString();
  return cl;
}

// ===== Settlement =====
let settlements: Settlement[] = [];

export function getSettlement(scheduleId: string): Settlement | null {
  return settlements.find((s) => s.scheduleId === scheduleId) || null;
}

export function createOrUpdateSettlement(scheduleId: string, data: {
  quote?: number; deposit?: number; extraCharge?: number;
  paymentMethod?: PaymentMethod; cashReceipt?: boolean;
  bankInfo?: string; customerName?: string; customerPhone?: string;
  note?: string; status?: "draft" | "completed";
}): Settlement {
  let s = settlements.find((x) => x.scheduleId === scheduleId);
  if (!s) {
    s = {
      id: genId(), scheduleId,
      quote: 0, deposit: 0, balance: 0, extraCharge: 0,
      subtotal: 0, vat: 0, totalAmount: 0,
      paymentMethod: "transfer", cashReceipt: false,
      bankInfo: "우리은행 1005-504-852384 (주식회사 새집느낌)",
      customerName: "", customerPhone: "", note: "",
      status: "draft", createdAt: new Date().toISOString(),
    };
    settlements.push(s);
  }

  if (data.quote !== undefined) s.quote = data.quote;
  if (data.deposit !== undefined) s.deposit = data.deposit;
  if (data.extraCharge !== undefined) s.extraCharge = data.extraCharge;
  if (data.paymentMethod !== undefined) s.paymentMethod = data.paymentMethod;
  if (data.cashReceipt !== undefined) s.cashReceipt = data.cashReceipt;
  if (data.bankInfo !== undefined) s.bankInfo = data.bankInfo;
  if (data.customerName !== undefined) s.customerName = data.customerName;
  if (data.customerPhone !== undefined) s.customerPhone = data.customerPhone;
  if (data.note !== undefined) s.note = data.note;
  if (data.status !== undefined) s.status = data.status;

  // 자동 계산
  s.balance = s.quote - s.deposit;
  s.subtotal = s.balance + s.extraCharge;
  s.vat = Math.round(s.subtotal * 0.1);
  s.totalAmount = s.subtotal + s.vat;

  return s;
}
