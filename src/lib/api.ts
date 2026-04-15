import { Member, Schedule, SwapRequest } from "@/types";
import { sb } from "./supabase-client";

// ===== Helper: DB row → App type =====
function toMember(r: Record<string, unknown>): Member {
  return { id: String(r.id), name: String(r.name), color: String(r.color), phone: String(r.phone || ""), availableDays: (r.available_days as number[]) || [1,2,3,4,5], active: Boolean(r.active), linkedUsername: r.linked_username ? String(r.linked_username) : undefined };
}
function toSchedule(r: Record<string, unknown>): Schedule {
  return { id: String(r.id), memberId: String(r.member_id || ""), memberName: String(r.member_name || "미배정"), title: String(r.title), location: String(r.location || ""), date: String(r.date), startTime: String(r.start_time), endTime: String(r.end_time), status: String(r.status) as Schedule["status"], assignedTo: r.assigned_to ? String(r.assigned_to) : undefined, assignedToName: r.assigned_to_name ? String(r.assigned_to_name) : undefined, googleEventId: r.google_event_id ? String(r.google_event_id) : undefined, note: String(r.note || ""), color: r.color ? String(r.color) : undefined };
}
function toSwap(r: Record<string, unknown>): SwapRequest {
  return { id: String(r.id), fromScheduleId: String(r.from_schedule_id), toScheduleId: String(r.to_schedule_id), fromMemberId: String(r.from_member_id), toMemberId: String(r.to_member_id), status: String(r.status) as SwapRequest["status"], createdAt: String(r.created_at) };
}
function toNotification(r: Record<string, unknown>): import("@/types").Notification {
  return { id: String(r.id), type: String(r.type) as import("@/types").NotificationType, title: String(r.title), message: String(r.message), scheduleId: r.schedule_id ? String(r.schedule_id) : undefined, read: Boolean(r.read), createdAt: String(r.created_at) };
}
function toComment(r: Record<string, unknown>): import("@/types").Comment {
  return { id: String(r.id), scheduleId: String(r.schedule_id), authorName: String(r.author_name), content: String(r.content), createdAt: String(r.created_at) };
}
function toUser(r: Record<string, unknown>): import("@/types").User {
  const role = String(r.role);
  const mappedRole = role === "admin" ? "ceo" : role === "manager" ? "field" : role;
  return { id: String(r.id), username: String(r.username), password: String(r.password), name: String(r.name), phone: String(r.phone || ""), address: String(r.address || ""), residentNumber: String(r.resident_number || ""), businessLicenseFile: String(r.business_license_file || ""), branch: String(r.branch || ""), role: mappedRole as import("@/types").UserRole, status: String(r.status) as import("@/types").UserStatus, createdAt: String(r.created_at) };
}
function toSettlement(r: Record<string, unknown>): import("@/types").Settlement {
  return { id: String(r.id), scheduleId: String(r.schedule_id), quote: Number(r.quote), deposit: Number(r.deposit), balance: Number(r.balance), extraCharge: Number(r.extra_charge), subtotal: Number(r.subtotal), vat: Number(r.vat), totalAmount: Number(r.total_amount), paymentMethod: String(r.payment_method) as import("@/types").PaymentMethod, cashReceipt: Boolean(r.cash_receipt), bankInfo: String(r.bank_info), customerName: String(r.customer_name), customerPhone: String(r.customer_phone), note: String(r.note || ""), status: String(r.status) as "draft" | "completed", createdAt: String(r.created_at) };
}

// ===== Members =====
export async function fetchMembers(): Promise<Member[]> {
  const { data } = await sb.from("members").select("*").order("name");
  return (data || []).map(toMember);
}
export async function createMember(input: { name: string; phone?: string; availableDays?: number[] }): Promise<Member> {
  const COLORS = ["#3B82F6","#EF4444","#10B981","#F59E0B","#8B5CF6","#EC4899","#06B6D4","#F97316"];
  const { data: existing } = await sb.from("members").select("id");
  const color = COLORS[(existing?.length || 0) % COLORS.length];
  const { data } = await sb.from("members").insert({ name: input.name, phone: input.phone || "", available_days: input.availableDays || [1,2,3,4,5], active: true, color }).select().single();
  return toMember(data!);
}
export async function updateMember(id: string, input: Partial<Member>): Promise<Member> {
  const u: Record<string, unknown> = {};
  if (input.name !== undefined) u.name = input.name;
  if (input.phone !== undefined) u.phone = input.phone;
  if (input.availableDays !== undefined) u.available_days = input.availableDays;
  if (input.active !== undefined) u.active = input.active;
  if (input.color !== undefined) u.color = input.color;
  if (input.linkedUsername !== undefined) u.linked_username = input.linkedUsername;
  const { data } = await sb.from("members").update(u).eq("id", id).select().single();
  return toMember(data!);
}
export async function deleteMember(id: string): Promise<void> {
  await sb.from("members").delete().eq("id", id);
}

// ===== Schedules =====
export async function fetchSchedules(start?: string, end?: string): Promise<Schedule[]> {
  if (start && end) {
    const { data } = await sb.from("schedules").select("*").gte("date", start).lte("date", end).not("status", "in", '("deleted","unassigned")').order("date");
    return (data || []).map(toSchedule);
  }
  const { data } = await sb.from("schedules").select("*").neq("status", "deleted").order("date");
  return (data || []).map(toSchedule);
}
export async function searchSchedules(query: string): Promise<Schedule[]> {
  const { data } = await sb.from("schedules").select("*").neq("status", "deleted").or(`title.ilike.%${query}%,note.ilike.%${query}%,member_name.ilike.%${query}%`).order("date", { ascending: false }).limit(50);
  return (data || []).map(toSchedule);
}
export async function fetchUnassignedSchedules(): Promise<Schedule[]> {
  const { data } = await sb.from("schedules").select("*").eq("status", "unassigned").order("date");
  return (data || []).map(toSchedule);
}
export async function fetchDeletedSchedules(): Promise<Schedule[]> {
  const { data } = await sb.from("schedules").select("*").eq("status", "deleted").order("date", { ascending: false });
  return (data || []).map(toSchedule);
}
export async function softDeleteSchedule(id: string): Promise<void> {
  await sb.from("schedules").update({ status: "deleted" }).eq("id", id);
}
export async function restoreScheduleApi(id: string): Promise<void> {
  await sb.from("schedules").update({ status: "confirmed" }).eq("id", id);
}
export async function emptyTrashApi(): Promise<{ deleted: number }> {
  const { data } = await sb.from("schedules").select("id").eq("status", "deleted");
  const count = data?.length || 0;
  if (count > 0) await sb.from("schedules").delete().in("id", data!.map((r: { id: string }) => r.id));
  return { deleted: count };
}
export async function deleteAllSchedules(): Promise<{ deleted: number }> {
  const { data } = await sb.from("schedules").select("id");
  const count = data?.length || 0;
  await sb.from("schedules").delete().gte("id", "00000000-0000-0000-0000-000000000000");
  return { deleted: count };
}
export async function createSchedule(input: Omit<Schedule, "id" | "status">): Promise<Schedule> {
  const { data } = await sb.from("schedules").insert({
    member_id: input.memberId, member_name: input.memberName, title: input.title, location: input.location || "", date: input.date, start_time: input.startTime, end_time: input.endTime, status: "confirmed", assigned_to: input.assignedTo, assigned_to_name: input.assignedToName, google_event_id: input.googleEventId || null, note: input.note || "", color: input.color || "#FDDCCC",
  }).select().single();
  return toSchedule(data!);
}
export async function addUnassignedSchedule(input: { title: string; date: string; startTime?: string; endTime?: string; note?: string; googleEventId?: string; color?: string }): Promise<Schedule> {
  // 중복 체크
  if (input.googleEventId) {
    const { data: existing } = await sb.from("schedules").select("id").eq("google_event_id", input.googleEventId).limit(1);
    if (existing && existing.length > 0) return toSchedule(existing[0]);
  }
  const { data: dup } = await sb.from("schedules").select("id").eq("title", input.title).eq("date", input.date).limit(1);
  if (dup && dup.length > 0) return toSchedule(dup[0]);
  const { data } = await sb.from("schedules").insert({
    member_id: "", member_name: "미배정", title: input.title, location: "", date: input.date, start_time: input.startTime || "09:00", end_time: input.endTime || "18:00", status: "unassigned", google_event_id: input.googleEventId || null, note: input.note || "",
  }).select().single();
  return toSchedule(data!);
}
export async function assignScheduleApi(scheduleId: string, memberId: string, memberName: string): Promise<Schedule> {
  const { data } = await sb.from("schedules").update({
    assigned_to: memberId, assigned_to_name: memberName, member_id: memberId, member_name: memberName, status: "confirmed",
  }).eq("id", scheduleId).select().single();
  return toSchedule(data!);
}
export async function unassignScheduleApi(scheduleId: string): Promise<Schedule> {
  const { data } = await sb.from("schedules").update({
    assigned_to: null, assigned_to_name: null, member_id: "", member_name: "미배정", status: "unassigned",
  }).eq("id", scheduleId).select().single();
  return toSchedule(data!);
}
export async function updateSchedule(id: string, input: Partial<Schedule>): Promise<Schedule> {
  const u: Record<string, unknown> = {};
  if (input.memberId !== undefined) u.member_id = input.memberId;
  if (input.memberName !== undefined) u.member_name = input.memberName;
  if (input.title !== undefined) u.title = input.title;
  if (input.location !== undefined) u.location = input.location;
  if (input.date !== undefined) u.date = input.date;
  if (input.startTime !== undefined) u.start_time = input.startTime;
  if (input.endTime !== undefined) u.end_time = input.endTime;
  if (input.status !== undefined) u.status = input.status;
  if (input.assignedTo !== undefined) u.assigned_to = input.assignedTo;
  if (input.assignedToName !== undefined) u.assigned_to_name = input.assignedToName;
  if (input.note !== undefined) u.note = input.note;
  if (input.color !== undefined) u.color = input.color;
  const { data } = await sb.from("schedules").update(u).eq("id", id).select().single();
  return toSchedule(data!);
}
export async function deleteSchedule(id: string): Promise<void> {
  await sb.from("schedules").delete().eq("id", id);
}

// ===== Swap =====
export async function fetchSwapRequests(): Promise<SwapRequest[]> {
  const { data } = await sb.from("swap_requests").select("*").order("created_at", { ascending: false });
  return (data || []).map(toSwap);
}
export async function createSwapRequest(fromScheduleId: string, toScheduleId: string): Promise<SwapRequest> {
  const from = await sb.from("schedules").select("member_id").eq("id", fromScheduleId).single();
  const to = await sb.from("schedules").select("member_id").eq("id", toScheduleId).single();
  const { data } = await sb.from("swap_requests").insert({
    from_schedule_id: fromScheduleId, to_schedule_id: toScheduleId, from_member_id: String(from.data?.member_id), to_member_id: String(to.data?.member_id), status: "pending",
  }).select().single();
  return toSwap(data!);
}
export async function approveSwapRequest(swapId: string): Promise<void> {
  const { data: req } = await sb.from("swap_requests").select("*").eq("id", swapId).single();
  if (!req) return;
  const { data: fromS } = await sb.from("schedules").select("*").eq("id", req.from_schedule_id).single();
  const { data: toS } = await sb.from("schedules").select("*").eq("id", req.to_schedule_id).single();
  if (fromS && toS) {
    await sb.from("schedules").update({ member_id: toS.member_id, member_name: toS.member_name }).eq("id", req.from_schedule_id);
    await sb.from("schedules").update({ member_id: fromS.member_id, member_name: fromS.member_name }).eq("id", req.to_schedule_id);
  }
  await sb.from("swap_requests").update({ status: "approved" }).eq("id", swapId);
}
export async function rejectSwapRequest(swapId: string): Promise<void> {
  await sb.from("swap_requests").update({ status: "rejected" }).eq("id", swapId);
}

// ===== Notifications =====
export async function fetchNotifications(): Promise<{ notifications: import("@/types").Notification[]; unreadCount: number }> {
  const { data } = await sb.from("notifications").select("*").order("created_at", { ascending: false });
  const notifications = (data || []).map(toNotification);
  const unreadCount = notifications.filter(n => !n.read).length;
  return { notifications, unreadCount };
}
export async function markNotificationRead(id: string): Promise<void> {
  await sb.from("notifications").update({ read: true }).eq("id", id);
}
export async function markAllNotificationsRead(): Promise<void> {
  await sb.from("notifications").update({ read: true }).eq("read", false);
}

// ===== Comments =====
export async function fetchComments(scheduleId: string): Promise<import("@/types").Comment[]> {
  const { data } = await sb.from("comments").select("*").eq("schedule_id", scheduleId).order("created_at");
  return (data || []).map(toComment);
}
export async function createComment(scheduleId: string, authorName: string, content: string): Promise<import("@/types").Comment> {
  const { data } = await sb.from("comments").insert({ schedule_id: scheduleId, author_name: authorName, content }).select().single();
  return toComment(data!);
}
export async function deleteCommentApi(id: string): Promise<void> {
  await sb.from("comments").delete().eq("id", id);
}

// ===== Auth =====
export async function loginApi(username: string, password: string): Promise<{ error?: string } & Partial<import("@/types").User>> {
  const { data } = await sb.from("users").select("*").ilike("username", username.toLowerCase()).single();
  if (!data) return { error: "아이디를 찾을 수 없습니다." };
  if (String(data.password) !== password) return { error: "비밀번호가 일치하지 않습니다." };
  if (String(data.status) === "pending") return { error: "승인 대기 중입니다. 관리자 승인 후 이용 가능합니다." };
  if (String(data.status) === "rejected") return { error: "가입이 거절되었습니다." };
  return toUser(data);
}
export async function registerApi(input: {
  username: string; password: string; name: string; phone: string; address: string; residentNumber: string; businessLicenseFile: string; branch: string;
}): Promise<{ error?: string } & Partial<import("@/types").User>> {
  const { data: existing } = await sb.from("users").select("id").ilike("username", input.username.toLowerCase()).limit(1);
  if (existing && existing.length > 0) return { error: "이미 사용 중인 아이디입니다." };
  const { data, error } = await sb.from("users").insert({
    username: input.username.toLowerCase(), password: input.password, name: input.name, phone: input.phone, address: input.address, resident_number: input.residentNumber, business_license_file: input.businessLicenseFile, branch: input.branch, role: "pending", status: "pending",
  }).select().single();
  if (error) return { error: "회원가입 실패: " + error.message };
  return toUser(data!);
}

// ===== Users (Admin) =====
export async function fetchUsers(): Promise<{ users: import("@/types").User[]; pendingUsers: import("@/types").User[] }> {
  const { data: approved } = await sb.from("users").select("*").eq("status", "approved").order("created_at");
  const { data: pending } = await sb.from("users").select("*").eq("status", "pending");
  return { users: (approved || []).map(toUser), pendingUsers: (pending || []).map(toUser) };
}
export async function approveUserApi(userId: string): Promise<void> {
  await sb.from("users").update({ status: "approved" }).eq("id", userId);
}
export async function rejectUserApi(userId: string): Promise<void> {
  await sb.from("users").update({ status: "rejected" }).eq("id", userId);
}
export async function deleteUserApi(userId: string): Promise<void> {
  await sb.from("users").delete().eq("id", userId);
}
export async function changeUserRoleApi(userId: string, role: string): Promise<void> {
  await sb.from("users").update({ role }).eq("id", userId);
}

// ===== Checklist =====
export async function fetchChecklist(scheduleId: string): Promise<import("@/types").ScheduleChecklist> {
  const { data } = await sb.from("checklists").select("*").eq("schedule_id", scheduleId).single();
  if (!data) {
    // 기본 체크리스트 생성
    const defaultCategories = [
      { id: "kitchen", name: "주방", icon: "🍳", items: [
        { id: "k1", label: "싱크대 청소", checked: false },{ id: "k2", label: "가스레인지 청소", checked: false },{ id: "k3", label: "레인지후드 청소", checked: false },{ id: "k4", label: "주방 바닥 청소", checked: false },
      ]},
      { id: "bathroom", name: "욕실", icon: "🚿", items: [
        { id: "b1", label: "변기 청소", checked: false },{ id: "b2", label: "세면대 청소", checked: false },{ id: "b3", label: "욕조/샤워부스 청소", checked: false },{ id: "b4", label: "욕실 바닥 청소", checked: false },
      ]},
      { id: "rooms", name: "거실/방", icon: "🛋️", items: [
        { id: "r1", label: "바닥 청소", checked: false },{ id: "r2", label: "창문/창틀 청소", checked: false },{ id: "r3", label: "몰딩/걸레받이", checked: false },{ id: "r4", label: "베란다 청소", checked: false },
      ]},
    ];
    const totalCount = defaultCategories.reduce((s, c) => s + c.items.length, 0);
    const { data: created } = await sb.from("checklists").insert({
      schedule_id: scheduleId, categories: defaultCategories, completed_count: 0, total_count: totalCount,
    }).select().single();
    if (created) return { id: String(created.id), scheduleId, categories: defaultCategories, completedCount: 0, totalCount, submittedAt: undefined };
  }
  const cats = (data?.categories || []) as import("@/types").ChecklistCategory[];
  return { id: String(data?.id), scheduleId, categories: cats, completedCount: Number(data?.completed_count || 0), totalCount: Number(data?.total_count || 0), submittedAt: data?.submitted_at ? String(data.submitted_at) : undefined };
}
export async function toggleChecklistItem(scheduleId: string, itemId: string, checked: boolean): Promise<import("@/types").ScheduleChecklist> {
  const { data } = await sb.from("checklists").select("*").eq("schedule_id", scheduleId).single();
  if (!data) return fetchChecklist(scheduleId);
  const cats = (data.categories as import("@/types").ChecklistCategory[]).map(c => ({
    ...c, items: c.items.map(i => i.id === itemId ? { ...i, checked } : i),
  }));
  const done = cats.reduce((s, c) => s + c.items.filter(i => i.checked).length, 0);
  await sb.from("checklists").update({ categories: cats, completed_count: done }).eq("id", data.id);
  return { id: String(data.id), scheduleId, categories: cats, completedCount: done, totalCount: Number(data.total_count), submittedAt: data.submitted_at ? String(data.submitted_at) : undefined };
}
export async function submitChecklistApi(scheduleId: string): Promise<import("@/types").ScheduleChecklist> {
  const now = new Date().toISOString();
  const { data } = await sb.from("checklists").update({ submitted_at: now }).eq("schedule_id", scheduleId).select().single();
  const cats = (data?.categories || []) as import("@/types").ChecklistCategory[];
  return { id: String(data?.id), scheduleId, categories: cats, completedCount: Number(data?.completed_count || 0), totalCount: Number(data?.total_count || 0), submittedAt: now };
}

// ===== Settlement =====
export async function fetchSettlement(scheduleId: string): Promise<import("@/types").Settlement | null> {
  const { data } = await sb.from("settlements").select("*").eq("schedule_id", scheduleId).single();
  return data ? toSettlement(data) : null;
}
export async function saveSettlement(scheduleId: string, input: Record<string, unknown>): Promise<import("@/types").Settlement> {
  const q = Number(input.quote) || 0;
  const d = Number(input.deposit) || 0;
  const e = Number(input.extraCharge) || 0;
  const balance = q - d;
  const subtotal = balance + e;
  const cashReceipt = Boolean(input.cashReceipt);
  const vat = cashReceipt ? Math.round(subtotal * 0.1) : 0;
  const row = {
    schedule_id: scheduleId, quote: q, deposit: d, balance, extra_charge: e, subtotal, vat, total_amount: subtotal + vat,
    payment_method: String(input.paymentMethod || "transfer"), cash_receipt: cashReceipt,
    bank_info: "", customer_name: String(input.customerName || ""), customer_phone: String(input.customerPhone || ""),
    note: String(input.note || ""), status: String(input.status || "draft"),
  };
  // upsert
  const { data: existing } = await sb.from("settlements").select("id").eq("schedule_id", scheduleId).single();
  if (existing) {
    const { data } = await sb.from("settlements").update(row).eq("id", existing.id).select().single();
    return toSettlement(data!);
  }
  const { data } = await sb.from("settlements").insert(row).select().single();
  return toSettlement(data!);
}

// ===== Google Calendar (기존 유지 - GAS 사용) =====
export async function getGoogleAuthUrl(): Promise<{ authUrl?: string; error?: string; needSetup?: boolean }> {
  return { error: "GAS를 사용하세요" };
}
export async function autoSyncGoogleCalendar(): Promise<{ error?: string }> {
  return { error: "GAS를 사용하세요" };
}
interface GoogleEvent { id: string; summary: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }; description?: string; }
export async function fetchGoogleEvents(_token?: string, _timeMin?: string, _timeMax?: string): Promise<{ items?: GoogleEvent[]; error?: string }> {
  return { error: "GAS를 사용하세요" };
}
