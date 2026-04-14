// Supabase DB 스토어 (인메모리 → DB 교체)
import { supabase } from "./supabase";
import { Member, Schedule, SwapRequest, Notification, NotificationType, Comment, User, ScheduleChecklist, ChecklistCategory, Settlement, PaymentMethod } from "@/types";

const MEMBER_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B",
  "#8B5CF6", "#EC4899", "#06B6D4", "#F97316",
];

// ===== Helper: DB row → App type 변환 =====
function rowToMember(r: Record<string, unknown>): Member {
  return { id: String(r.id), name: String(r.name), color: String(r.color), phone: String(r.phone || ""), availableDays: (r.available_days as number[]) || [1,2,3,4,5], active: Boolean(r.active), linkedUsername: r.linked_username ? String(r.linked_username) : undefined };
}
function rowToSchedule(r: Record<string, unknown>): Schedule {
  return { id: String(r.id), memberId: String(r.member_id || ""), memberName: String(r.member_name || "미배정"), title: String(r.title), location: String(r.location || ""), date: String(r.date), startTime: String(r.start_time), endTime: String(r.end_time), status: String(r.status) as Schedule["status"], assignedTo: r.assigned_to ? String(r.assigned_to) : undefined, assignedToName: r.assigned_to_name ? String(r.assigned_to_name) : undefined, googleEventId: r.google_event_id ? String(r.google_event_id) : undefined, note: String(r.note || ""), color: r.color ? String(r.color) : undefined };
}
function rowToSwapRequest(r: Record<string, unknown>): SwapRequest {
  return { id: String(r.id), fromScheduleId: String(r.from_schedule_id), toScheduleId: String(r.to_schedule_id), fromMemberId: String(r.from_member_id), toMemberId: String(r.to_member_id), status: String(r.status) as SwapRequest["status"], createdAt: String(r.created_at) };
}
function rowToNotification(r: Record<string, unknown>): Notification {
  return { id: String(r.id), type: String(r.type) as NotificationType, title: String(r.title), message: String(r.message), scheduleId: r.schedule_id ? String(r.schedule_id) : undefined, read: Boolean(r.read), createdAt: String(r.created_at) };
}
function rowToComment(r: Record<string, unknown>): Comment {
  return { id: String(r.id), scheduleId: String(r.schedule_id), authorName: String(r.author_name), content: String(r.content), createdAt: String(r.created_at) };
}
function rowToUser(r: Record<string, unknown>): User {
  return { id: String(r.id), username: String(r.username), password: String(r.password), name: String(r.name), phone: String(r.phone || ""), address: String(r.address || ""), residentNumber: String(r.resident_number || ""), businessLicenseFile: String(r.business_license_file || ""), role: String(r.role) as User["role"], status: String(r.status) as User["status"], createdAt: String(r.created_at) };
}
function rowToSettlement(r: Record<string, unknown>): Settlement {
  return { id: String(r.id), scheduleId: String(r.schedule_id), quote: Number(r.quote), deposit: Number(r.deposit), balance: Number(r.balance), extraCharge: Number(r.extra_charge), subtotal: Number(r.subtotal), vat: Number(r.vat), totalAmount: Number(r.total_amount), paymentMethod: String(r.payment_method) as PaymentMethod, cashReceipt: Boolean(r.cash_receipt), bankInfo: String(r.bank_info), customerName: String(r.customer_name), customerPhone: String(r.customer_phone), note: String(r.note || ""), status: String(r.status) as "draft" | "completed", createdAt: String(r.created_at) };
}

// ===== Members =====
export async function getMembers(): Promise<Member[]> {
  const { data } = await supabase.from("members").select("*").order("name");
  return (data || []).map(rowToMember);
}

export async function getMember(id: string): Promise<Member | undefined> {
  const { data } = await supabase.from("members").select("*").eq("id", id).single();
  return data ? rowToMember(data) : undefined;
}

export async function addMember(input: Omit<Member, "id" | "color">): Promise<Member> {
  const { data: existing } = await supabase.from("members").select("id");
  const color = MEMBER_COLORS[(existing?.length || 0) % MEMBER_COLORS.length];
  const { data } = await supabase.from("members").insert({ name: input.name, phone: input.phone || "", available_days: input.availableDays, active: input.active, color }).select().single();
  return rowToMember(data!);
}

export async function updateMember(id: string, input: Partial<Member>): Promise<Member | null> {
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.phone !== undefined) update.phone = input.phone;
  if (input.availableDays !== undefined) update.available_days = input.availableDays;
  if (input.active !== undefined) update.active = input.active;
  if (input.color !== undefined) update.color = input.color;
  if (input.linkedUsername !== undefined) update.linked_username = input.linkedUsername;
  const { data } = await supabase.from("members").update(update).eq("id", id).select().single();
  return data ? rowToMember(data) : null;
}

export async function deleteMember(id: string): Promise<boolean> {
  const { error } = await supabase.from("members").delete().eq("id", id);
  return !error;
}

// ===== Schedules =====
export async function getSchedules(): Promise<Schedule[]> {
  const { data } = await supabase.from("schedules").select("*").neq("status", "deleted").order("date");
  return (data || []).map(rowToSchedule);
}

export async function getSchedulesByRange(start: string, end: string): Promise<Schedule[]> {
  // 배정된 일정만 (unassigned, deleted 제외)
  const { data } = await supabase.from("schedules").select("*").gte("date", start).lte("date", end).not("status", "in", '("deleted","unassigned")').order("date");
  return (data || []).map(rowToSchedule);
}

export async function getUnassignedSchedules(): Promise<Schedule[]> {
  const { data } = await supabase.from("schedules").select("*").eq("status", "unassigned").order("date");
  return (data || []).map(rowToSchedule);
}

export async function searchSchedules(query: string): Promise<Schedule[]> {
  const { data } = await supabase.from("schedules").select("*")
    .neq("status", "deleted")
    .or(`title.ilike.%${query}%,note.ilike.%${query}%,member_name.ilike.%${query}%`)
    .order("date", { ascending: false })
    .limit(50);
  return (data || []).map(rowToSchedule);
}

export async function addSchedule(input: Omit<Schedule, "id" | "status">): Promise<Schedule> {
  const { data } = await supabase.from("schedules").insert({
    member_id: input.memberId, member_name: input.memberName, title: input.title, location: input.location || "", date: input.date, start_time: input.startTime, end_time: input.endTime, status: "confirmed", assigned_to: input.assignedTo, assigned_to_name: input.assignedToName, google_event_id: input.googleEventId, note: input.note || "", color: input.color || "#FDDCCC",
  }).select().single();
  return rowToSchedule(data!);
}

export async function addUnassignedSchedule(input: Omit<Schedule, "id" | "status" | "memberId" | "memberName">): Promise<Schedule | null> {
  // 중복 체크 1: googleEventId
  if (input.googleEventId) {
    const { data: existing } = await supabase.from("schedules").select("id").eq("google_event_id", input.googleEventId).limit(1);
    if (existing && existing.length > 0) return null;
  }
  // 중복 체크 2: 같은 제목+날짜
  const { data: dup } = await supabase.from("schedules").select("id").eq("title", input.title).eq("date", input.date).limit(1);
  if (dup && dup.length > 0) return null;
  const { data } = await supabase.from("schedules").insert({
    member_id: "", member_name: "미배정", title: input.title, location: input.location || "", date: input.date, start_time: input.startTime, end_time: input.endTime, status: "unassigned", google_event_id: input.googleEventId, note: input.note || "",
  }).select().single();
  return rowToSchedule(data!);
}

// 전체 일정 삭제 (관리자용)
export async function deleteAllSchedules(): Promise<number> {
  const { data } = await supabase.from("schedules").select("id");
  const count = data?.length || 0;
  // Supabase는 조건 없는 delete 불가 → gte로 모든 행 매칭
  await supabase.from("schedules").delete().gte("id", "00000000-0000-0000-0000-000000000000");
  return count;
}

// 소프트 삭제 (휴지통)
export async function softDeleteSchedule(id: string): Promise<Schedule | null> {
  const { data } = await supabase.from("schedules").update({ status: "deleted" }).eq("id", id).select().single();
  return data ? rowToSchedule(data) : null;
}

// 휴지통 목록
export async function getDeletedSchedules(): Promise<Schedule[]> {
  const { data } = await supabase.from("schedules").select("*").eq("status", "deleted").order("date", { ascending: false });
  return (data || []).map(rowToSchedule);
}

// 휴지통에서 복원
export async function restoreSchedule(id: string): Promise<Schedule | null> {
  const { data } = await supabase.from("schedules").update({ status: "confirmed" }).eq("id", id).select().single();
  return data ? rowToSchedule(data) : null;
}

// 휴지통 비우기
export async function emptyTrash(): Promise<number> {
  const { data } = await supabase.from("schedules").select("id").eq("status", "deleted");
  const count = data?.length || 0;
  if (count > 0) {
    const ids = data!.map((r: { id: string }) => r.id);
    await supabase.from("schedules").delete().in("id", ids);
  }
  return count;
}

export async function assignSchedule(scheduleId: string, memberId: string, memberName: string): Promise<Schedule | null> {
  const { data } = await supabase.from("schedules").update({
    assigned_to: memberId, assigned_to_name: memberName, member_id: memberId, member_name: memberName, status: "confirmed",
  }).eq("id", scheduleId).select().single();
  return data ? rowToSchedule(data) : null;
}

export async function unassignSchedule(scheduleId: string): Promise<Schedule | null> {
  const { data } = await supabase.from("schedules").update({
    assigned_to: null, assigned_to_name: null, member_id: "", member_name: "미배정", status: "unassigned",
  }).eq("id", scheduleId).select().single();
  return data ? rowToSchedule(data) : null;
}

export async function updateSchedule(id: string, input: Partial<Schedule>): Promise<Schedule | null> {
  const update: Record<string, unknown> = {};
  if (input.memberId !== undefined) update.member_id = input.memberId;
  if (input.memberName !== undefined) update.member_name = input.memberName;
  if (input.title !== undefined) update.title = input.title;
  if (input.location !== undefined) update.location = input.location;
  if (input.date !== undefined) update.date = input.date;
  if (input.startTime !== undefined) update.start_time = input.startTime;
  if (input.endTime !== undefined) update.end_time = input.endTime;
  if (input.status !== undefined) update.status = input.status;
  if (input.assignedTo !== undefined) update.assigned_to = input.assignedTo;
  if (input.assignedToName !== undefined) update.assigned_to_name = input.assignedToName;
  if (input.note !== undefined) update.note = input.note;
  if (input.color !== undefined) update.color = input.color;
  const { data } = await supabase.from("schedules").update(update).eq("id", id).select().single();
  return data ? rowToSchedule(data) : null;
}

export async function deleteSchedule(id: string): Promise<boolean> {
  const { error } = await supabase.from("schedules").delete().eq("id", id);
  return !error;
}

// ===== Swap Requests =====
export async function getSwapRequests(): Promise<SwapRequest[]> {
  const { data } = await supabase.from("swap_requests").select("*").order("created_at", { ascending: false });
  return (data || []).map(rowToSwapRequest);
}

export async function addSwapRequest(fromScheduleId: string, toScheduleId: string): Promise<SwapRequest | null> {
  const from = await supabase.from("schedules").select("member_id").eq("id", fromScheduleId).single();
  const to = await supabase.from("schedules").select("member_id").eq("id", toScheduleId).single();
  if (!from.data || !to.data) return null;
  const { data } = await supabase.from("swap_requests").insert({
    from_schedule_id: fromScheduleId, to_schedule_id: toScheduleId, from_member_id: String(from.data.member_id), to_member_id: String(to.data.member_id), status: "pending",
  }).select().single();
  return data ? rowToSwapRequest(data) : null;
}

export async function approveSwap(swapId: string): Promise<boolean> {
  const { data: req } = await supabase.from("swap_requests").select("*").eq("id", swapId).eq("status", "pending").single();
  if (!req) return false;
  const { data: fromS } = await supabase.from("schedules").select("*").eq("id", req.from_schedule_id).single();
  const { data: toS } = await supabase.from("schedules").select("*").eq("id", req.to_schedule_id).single();
  if (!fromS || !toS) return false;
  await supabase.from("schedules").update({ member_id: toS.member_id, member_name: toS.member_name }).eq("id", req.from_schedule_id);
  await supabase.from("schedules").update({ member_id: fromS.member_id, member_name: fromS.member_name }).eq("id", req.to_schedule_id);
  await supabase.from("swap_requests").update({ status: "approved" }).eq("id", swapId);
  return true;
}

export async function rejectSwap(swapId: string): Promise<boolean> {
  const { error } = await supabase.from("swap_requests").update({ status: "rejected" }).eq("id", swapId).eq("status", "pending");
  return !error;
}

// ===== Notifications =====
export async function getNotifications(): Promise<Notification[]> {
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
  return (data || []).map(rowToNotification);
}

export async function getUnreadCount(): Promise<number> {
  const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("read", false);
  return count || 0;
}

export async function addNotification(type: NotificationType, title: string, message: string, scheduleId?: string): Promise<Notification> {
  const { data } = await supabase.from("notifications").insert({ type, title, message, schedule_id: scheduleId, read: false }).select().single();
  return rowToNotification(data!);
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  return !error;
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("read", false);
}

export async function checkHappyCallReminders(): Promise<Notification[]> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const { data: tomorrowSchedules } = await supabase.from("schedules").select("*").eq("date", tomorrowStr);
  const newReminders: Notification[] = [];

  for (const s of tomorrowSchedules || []) {
    const { data: existing } = await supabase.from("notifications").select("id").eq("type", "happy_call_reminder").eq("schedule_id", String(s.id));
    if (!existing || existing.length === 0) {
      const n = await addNotification(
        "happy_call_reminder",
        "해피콜 요청",
        `내일 ${s.start_time} "${s.title}" 일정이 있습니다. ${s.member_name}님에게 해피콜을 진행해주세요.`,
        String(s.id)
      );
      newReminders.push(n);
    }
  }
  return newReminders;
}

// ===== Comments =====
export async function getCommentsBySchedule(scheduleId: string): Promise<Comment[]> {
  const { data } = await supabase.from("comments").select("*").eq("schedule_id", scheduleId).order("created_at");
  return (data || []).map(rowToComment);
}

export async function addComment(scheduleId: string, authorName: string, content: string): Promise<Comment> {
  const { data } = await supabase.from("comments").insert({ schedule_id: scheduleId, author_name: authorName, content }).select().single();
  return rowToComment(data!);
}

export async function deleteComment(id: string): Promise<boolean> {
  const { error } = await supabase.from("comments").delete().eq("id", id);
  return !error;
}

// ===== Users =====
export async function getUsers(): Promise<User[]> {
  const { data } = await supabase.from("users").select("*").order("created_at");
  return (data || []).map(rowToUser);
}

export async function getUser(id: string): Promise<User | undefined> {
  const { data } = await supabase.from("users").select("*").eq("id", id).single();
  return data ? rowToUser(data) : undefined;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const lower = username.toLowerCase();
  const { data } = await supabase.from("users").select("*").ilike("username", lower).single();
  return data ? rowToUser(data) : undefined;
}

export async function getPendingUsers(): Promise<User[]> {
  const { data } = await supabase.from("users").select("*").eq("status", "pending");
  return (data || []).map(rowToUser);
}

export async function registerUser(input: { username: string; password: string; name: string; phone: string; address: string; residentNumber: string; businessLicenseFile: string }): Promise<User> {
  const { data } = await supabase.from("users").insert({
    username: input.username, password: input.password, name: input.name, phone: input.phone, address: input.address, resident_number: input.residentNumber, business_license_file: input.businessLicenseFile, role: "pending", status: "pending",
  }).select().single();
  return rowToUser(data!);
}

export async function approveUser(id: string): Promise<boolean> {
  // 유저 승인
  const { data: user } = await supabase.from("users").select("*").eq("id", id).single();
  if (!user) return false;
  const { error } = await supabase.from("users").update({ status: "approved", role: "manager" }).eq("id", id);
  if (error) return false;

  // 팀원 목록에 자동 추가 (이미 있으면 스킵)
  const { data: existing } = await supabase.from("members").select("id").eq("linked_username", String(user.username)).limit(1);
  if (!existing || existing.length === 0) {
    const colors = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];
    const { data: allMembers } = await supabase.from("members").select("id");
    const color = colors[(allMembers?.length || 0) % colors.length];
    await supabase.from("members").insert({
      name: String(user.name),
      phone: String(user.phone || ""),
      available_days: [1, 2, 3, 4, 5],
      active: true,
      color,
      linked_username: String(user.username),
    });
  }
  return true;
}

export async function rejectUser(id: string): Promise<boolean> {
  const { error } = await supabase.from("users").update({ status: "rejected" }).eq("id", id);
  return !error;
}

export async function loginUser(username: string, password: string): Promise<User | null> {
  const lower = username.toLowerCase();
  const { data } = await supabase.from("users").select("*").ilike("username", lower).eq("password", password).eq("status", "approved").single();
  return data ? rowToUser(data) : null;
}

export async function findUserForLogin(username: string): Promise<User | undefined> {
  const lower = username.toLowerCase();
  const { data } = await supabase.from("users").select("*").ilike("username", lower).single();
  return data ? rowToUser(data) : undefined;
}

// ===== Checklist =====
const DEFAULT_CHECKLIST_TEMPLATE: ChecklistCategory[] = [
  { id: "cat1", name: "전체 천장", icon: "🔝", items: [
    { id: "c1-1", label: "환기디퓨저 오염/분진 확인", checked: false },
    { id: "c1-2", label: "조명 커버 벌레사체/분진상태 확인", checked: false },
    { id: "c1-3", label: "천장 몰딩 도배풀 확인", checked: false },
    { id: "c1-4", label: "천장 벽지 오염 얼룩 확인", checked: false },
    { id: "c1-5", label: "에어컨 오염상태", checked: false },
  ]},
  { id: "cat2", name: "전체 벽면", icon: "🧱", items: [
    { id: "c2-1", label: "인터폰/스위치 상단 오염상태", checked: false },
    { id: "c2-2", label: "벽지 오염 상태", checked: false },
    { id: "c2-3", label: "콘센트 오염 상태", checked: false },
    { id: "c2-4", label: "아트월 분진/먼지 오염 상태", checked: false },
  ]},
  { id: "cat3", name: "전체 바닥", icon: "🏠", items: [
    { id: "c3-1", label: "본드 얼룩 시공 오염 제거 여부", checked: false },
    { id: "c3-2", label: "걸레받이 오염상태", checked: false },
    { id: "c3-3", label: "방 모서리 오염 잔여물 상태", checked: false },
  ]},
  { id: "cat4", name: "자주 놓치는 곳", icon: "🔍", items: [
    { id: "c4-1", label: "베란다 빨래건조대", checked: false },
    { id: "c4-2", label: "변기 옆면 뒷면 오염도상태", checked: false },
    { id: "c4-3", label: "걸레받이 내부 오염상태", checked: false },
    { id: "c4-4", label: "서랍장 모서리 및 표면 먼지 상태", checked: false },
    { id: "c4-5", label: "전체 거울 얼룩 오염 상태", checked: false },
    { id: "c4-6", label: "타일 백시멘트 잔여물 상태", checked: false },
    { id: "c4-7", label: "줄눈 사이 오염도 상태", checked: false },
  ]},
];

export async function getChecklist(scheduleId: string): Promise<ScheduleChecklist> {
  const { data } = await supabase.from("checklists").select("*").eq("schedule_id", scheduleId).single();
  if (data) {
    return { id: String(data.id), scheduleId: String(data.schedule_id), categories: data.categories as ChecklistCategory[], completedCount: Number(data.completed_count), totalCount: Number(data.total_count), submittedAt: data.submitted_at ? String(data.submitted_at) : undefined };
  }
  // 새로 생성
  const categories = JSON.parse(JSON.stringify(DEFAULT_CHECKLIST_TEMPLATE));
  const totalCount = categories.reduce((sum: number, cat: ChecklistCategory) => sum + cat.items.length, 0);
  const { data: newRow } = await supabase.from("checklists").insert({ schedule_id: scheduleId, categories, completed_count: 0, total_count: totalCount }).select().single();
  return { id: String(newRow!.id), scheduleId, categories, completedCount: 0, totalCount, submittedAt: undefined };
}

export async function updateChecklistItem(scheduleId: string, itemId: string, checked: boolean): Promise<ScheduleChecklist | null> {
  const cl = await getChecklist(scheduleId);
  for (const cat of cl.categories) {
    const item = cat.items.find((i) => i.id === itemId);
    if (item) { item.checked = checked; break; }
  }
  cl.completedCount = cl.categories.reduce((sum, cat) => sum + cat.items.filter((i) => i.checked).length, 0);
  await supabase.from("checklists").update({ categories: cl.categories, completed_count: cl.completedCount }).eq("schedule_id", scheduleId);
  return cl;
}

export async function submitChecklist(scheduleId: string): Promise<ScheduleChecklist | null> {
  const cl = await getChecklist(scheduleId);
  const now = new Date().toISOString();
  await supabase.from("checklists").update({ submitted_at: now }).eq("schedule_id", scheduleId);
  cl.submittedAt = now;
  return cl;
}

// ===== Settlement =====
export async function getSettlement(scheduleId: string): Promise<Settlement | null> {
  const { data } = await supabase.from("settlements").select("*").eq("schedule_id", scheduleId).single();
  return data ? rowToSettlement(data) : null;
}

export async function createOrUpdateSettlement(scheduleId: string, input: {
  quote?: number; deposit?: number; extraCharge?: number;
  paymentMethod?: PaymentMethod; cashReceipt?: boolean;
  bankInfo?: string; customerName?: string; customerPhone?: string;
  note?: string; status?: "draft" | "completed";
}): Promise<Settlement> {
  let s = await getSettlement(scheduleId);
  if (!s) {
    const { data } = await supabase.from("settlements").insert({
      schedule_id: scheduleId, quote: 0, deposit: 0, balance: 0, extra_charge: 0, subtotal: 0, vat: 0, total_amount: 0, payment_method: "transfer", cash_receipt: false, bank_info: "우리은행 1005-504-852384 (주식회사 새집느낌)", customer_name: "", customer_phone: "", note: "", status: "draft",
    }).select().single();
    s = rowToSettlement(data!);
  }

  if (input.quote !== undefined) s.quote = input.quote;
  if (input.deposit !== undefined) s.deposit = input.deposit;
  if (input.extraCharge !== undefined) s.extraCharge = input.extraCharge;
  if (input.paymentMethod !== undefined) s.paymentMethod = input.paymentMethod;
  if (input.cashReceipt !== undefined) s.cashReceipt = input.cashReceipt;
  if (input.bankInfo !== undefined) s.bankInfo = input.bankInfo;
  if (input.customerName !== undefined) s.customerName = input.customerName;
  if (input.customerPhone !== undefined) s.customerPhone = input.customerPhone;
  if (input.note !== undefined) s.note = input.note;
  if (input.status !== undefined) s.status = input.status;

  s.balance = s.quote - s.deposit;
  s.subtotal = s.balance + s.extraCharge;
  s.vat = Math.round(s.subtotal * 0.1);
  s.totalAmount = s.subtotal + s.vat;

  await supabase.from("settlements").update({
    quote: s.quote, deposit: s.deposit, balance: s.balance, extra_charge: s.extraCharge, subtotal: s.subtotal, vat: s.vat, total_amount: s.totalAmount, payment_method: s.paymentMethod, cash_receipt: s.cashReceipt, bank_info: s.bankInfo, customer_name: s.customerName, customer_phone: s.customerPhone, note: s.note, status: s.status,
  }).eq("schedule_id", scheduleId);

  return s;
}
