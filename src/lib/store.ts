// Supabase DB 스토어 (인메모리 → DB 교체)
import { supabase } from "./supabase";
import { Member, Schedule, SwapRequest, Notification, NotificationType, Comment, User, ScheduleChecklist, ChecklistCategory, Settlement, PaymentMethod } from "@/types";

const MEMBER_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B",
  "#8B5CF6", "#EC4899", "#06B6D4", "#F97316",
];

// note 내 HTML 태그/엔티티를 plain text 로 정리.
// Google Calendar description 이 <p>…</p><br><br> 같은 HTML 로 내려오던 걸
// 그대로 저장해서 textarea 에 태그가 문자열로 보이던 버그 방지.
// read/write 양쪽에서 호출해 기존 DB 의 HTML 도 자연스럽게 정리됨.
function sanitizeNote(s: string | null | undefined): string {
  if (!s) return "";
  let out = String(s);
  // 구조 태그 → 줄바꿈
  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<\/p\s*>/gi, "\n");
  out = out.replace(/<p[^>]*>/gi, "");
  out = out.replace(/<div[^>]*>/gi, "");
  out = out.replace(/<\/div\s*>/gi, "\n");
  // 나머지 태그 모두 제거
  out = out.replace(/<[^>]+>/g, "");
  // 기본 HTML 엔티티 디코드
  out = out
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // 3줄 이상 빈줄 → 2줄로 압축
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

// ===== Helper: DB row → App type 변환 =====
function rowToMember(r: Record<string, unknown>): Member {
  return { id: String(r.id), name: String(r.name), color: String(r.color), phone: String(r.phone || ""), availableDays: (r.available_days as number[]) || [1,2,3,4,5], active: Boolean(r.active), linkedUsername: r.linked_username ? String(r.linked_username) : undefined };
}
function rowToSchedule(r: Record<string, unknown>): Schedule {
  return { id: String(r.id), memberId: String(r.member_id || ""), memberName: String(r.member_name || "미배정"), title: String(r.title), location: String(r.location || ""), date: String(r.date), startTime: String(r.start_time), endTime: String(r.end_time), status: String(r.status) as Schedule["status"], assignedTo: r.assigned_to ? String(r.assigned_to) : undefined, assignedToName: r.assigned_to_name ? String(r.assigned_to_name) : undefined, googleEventId: r.google_event_id ? String(r.google_event_id) : undefined, note: sanitizeNote(r.note as string | null | undefined), color: r.color ? String(r.color) : undefined };
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
function mapRole(role: string): User["role"] {
  // admin 은 이제 독립 역할로 유지 (대표와 별도)
  if (role === "manager") return "field";
  return role as User["role"];
}
function rowToUser(r: Record<string, unknown>): User {
  return { id: String(r.id), username: String(r.username), password: String(r.password), name: String(r.name), phone: String(r.phone || ""), address: String(r.address || ""), residentNumber: String(r.resident_number || ""), businessLicenseFile: String(r.business_license_file || ""), branch: String(r.branch || ""), role: mapRole(String(r.role)), status: String(r.status) as User["status"], createdAt: String(r.created_at) };
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

export async function addSchedule(input: Omit<Schedule, "id" | "status">): Promise<{ schedule?: Schedule; error?: string }> {
  const row: Record<string, unknown> = {
    member_id: input.memberId || "", member_name: input.memberName || "미배정", title: input.title, location: input.location || "", date: input.date, start_time: input.startTime, end_time: input.endTime, status: "confirmed", google_event_id: input.googleEventId || null, note: sanitizeNote(input.note),
  };
  if (input.assignedTo) row.assigned_to = input.assignedTo;
  if (input.assignedToName) row.assigned_to_name = input.assignedToName;
  const { data, error } = await supabase.from("schedules").insert(row).select().single();
  if (error || !data) { console.error("[addSchedule] 실패:", error); return { error: error?.message || "insert failed" }; }
  return { schedule: rowToSchedule(data) };
}

// 같은 탭에서 동시 insert 되는 TOCTOU 방어 — key 는 googleEventId 또는 title|date
const pendingInserts = new Set<string>();

export async function addUnassignedSchedule(input: Omit<Schedule, "id" | "status" | "memberId" | "memberName">): Promise<Schedule | null> {
  const key = input.googleEventId || `${input.title}|${input.date}`;
  if (pendingInserts.has(key)) return null;
  pendingInserts.add(key);
  try {
    // 중복 체크 1: googleEventId
    if (input.googleEventId) {
      const { data: existing } = await supabase.from("schedules").select("id").eq("google_event_id", input.googleEventId).limit(1);
      if (existing && existing.length > 0) return null;
    }
    // 중복 체크 2: 같은 제목+날짜
    const { data: dup } = await supabase.from("schedules").select("id").eq("title", input.title).eq("date", input.date).limit(1);
    if (dup && dup.length > 0) return null;
    const { data, error } = await supabase.from("schedules").insert({
      member_id: "", member_name: "미배정", title: input.title, location: input.location || "", date: input.date, start_time: input.startTime, end_time: input.endTime, status: "unassigned", google_event_id: input.googleEventId || null, note: sanitizeNote(input.note),
    }).select().single();
    if (error || !data) return null;
    return rowToSchedule(data);
  } finally {
    pendingInserts.delete(key);
  }
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
  if (input.note !== undefined) update.note = sanitizeNote(input.note);
  if (input.color !== undefined) update.color = input.color;
  const { data, error } = await supabase.from("schedules").update(update).eq("id", id).select().single();
  if (error) console.error("[updateSchedule] supabase error:", error);
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

export async function addNotification(type: NotificationType, title: string, message: string, scheduleId?: string, targetNames?: string[], targetRoles?: string[]): Promise<Notification> {
  const { data, error } = await supabase.from("notifications").insert({ type, title, message, schedule_id: scheduleId, read: false }).select().single();
  if (error || !data) {
    console.error("[Notify] DB insert 실패:", { type, title, error });
    throw new Error(`notification insert failed: ${error?.message || "no data"}`);
  }
  console.log("[Notify] 생성:", { id: data.id, type, title, targetRoles, targetNames });
  // 푸시 알림 - role/name 타겟을 user_id 로 합쳐 중복 제거 후 1회만 발송
  // (FCM tag 가 같으면 2번째 푸시는 소리 없이 덮어쓰기 → 이중 발송 시 안 울리던 버그 차단)
  try {
    const userIds = new Set<string>();
    if (targetRoles && targetRoles.length > 0) {
      const { data: u } = await supabase.from("users").select("id").in("role", targetRoles).eq("status", "approved");
      (u || []).forEach(r => userIds.add(String(r.id)));
    }
    if (targetNames && targetNames.length > 0) {
      const clean = targetNames.filter(n => n && n.trim() && n !== "미배정").map(n => n.trim());
      if (clean.length > 0) {
        const { data: u } = await supabase.from("users").select("id").eq("status", "approved").in("name", clean);
        (u || []).forEach(r => userIds.add(String(r.id)));
      }
    }
    if (userIds.size > 0) {
      const { sendPushToUsers } = await import("./push");
      await sendPushToUsers(Array.from(userIds), title, message, type);
    } else if (!targetRoles?.length && !targetNames?.length) {
      // 타겟 미지정 시 레거시 메시지 매칭
      const { sendPushToMentioned } = await import("./push");
      await sendPushToMentioned(title, message, type);
    }
  } catch (e) { console.error("[Push] 발송 실패:", e); }
  return rowToNotification(data!);
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  return !error;
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("read", false);
}

export async function deleteAllNotifications(): Promise<number> {
  const { data } = await supabase.from("notifications").select("id");
  const count = data?.length || 0;
  if (count > 0) {
    await supabase.from("notifications").delete().gte("id", "00000000-0000-0000-0000-000000000000");
  }
  return count;
}

export async function deleteNotificationsByIds(ids: string[]): Promise<number> {
  if (!ids || ids.length === 0) return 0;
  await supabase.from("notifications").delete().in("id", ids);
  return ids.length;
}

// 전체 공지 (대표/admin 전용): 모든 사용자에게 in-app 알림 + 푸시 전송
export async function createSystemNotice(title: string, message: string): Promise<Notification> {
  const { data } = await supabase.from("notifications").insert({ type: "system_notice", title, message, read: false }).select().single();
  try {
    const { sendPushToAll } = await import("./push");
    sendPushToAll(title, message, "system_notice").catch(() => {});
  } catch { /* push 모듈 로드 실패 무시 */ }
  return rowToNotification(data!);
}

export async function getSystemNotices(): Promise<Notification[]> {
  const { data } = await supabase.from("notifications").select("*").eq("type", "system_notice").order("created_at", { ascending: false }).limit(50);
  return (data || []).map(rowToNotification);
}

export async function deleteSystemNotice(id: string): Promise<boolean> {
  const { error } = await supabase.from("notifications").delete().eq("id", id).eq("type", "system_notice");
  return !error;
}

// 구버전 배포가 돌더라도 재생성 못하게, 모든 내일 일정에 대해
// 푸시 없이 happy_call_reminder 마커만 미리 생성 (이미 있으면 스킵)
export async function prefillHappyCallMarkers(): Promise<number> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const { data: tomorrowSchedules } = await supabase.from("schedules").select("id").eq("date", tomorrowStr);
  if (!tomorrowSchedules) return 0;
  let created = 0;
  for (const s of tomorrowSchedules) {
    const { data: existing } = await supabase.from("notifications").select("id").eq("type", "happy_call_reminder").eq("schedule_id", String(s.id));
    if (!existing || existing.length === 0) {
      await supabase.from("notifications").insert({
        type: "happy_call_reminder",
        title: "해피콜 요청",
        message: "[자동 생성 마커]",
        schedule_id: String(s.id),
        read: true,
      });
      created++;
    }
  }
  return created;
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
        String(s.id),
        undefined,
        ["ceo", "admin", "scheduler"]
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
  const { data } = await supabase.from("users").select("*").eq("status", "approved").order("created_at");
  return (data || []).map(rowToUser);
}

export async function getUser(id: string): Promise<User | undefined> {
  const { data } = await supabase.from("users").select("*").eq("id", id).single();
  return data ? rowToUser(data) : undefined;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const lower = username.toLowerCase();
  const { data } = await supabase.from("users").select("*").ilike("username", lower).in("status", ["approved", "pending"]).single();
  return data ? rowToUser(data) : undefined;
}

export async function getPendingUsers(): Promise<User[]> {
  const { data } = await supabase.from("users").select("*").eq("status", "pending");
  return (data || []).map(rowToUser);
}

export async function registerUser(input: { username: string; password: string; name: string; phone: string; address: string; residentNumber: string; businessLicenseFile: string; branch: string }): Promise<User> {
  // 거절/삭제된 동일 아이디 레코드 삭제 (재가입 허용)
  await supabase.from("users").delete().ilike("username", input.username.toLowerCase()).eq("status", "rejected");

  const insertData: Record<string, unknown> = {
    username: input.username.toLowerCase(), password: input.password, name: input.name, phone: input.phone, address: input.address, resident_number: input.residentNumber, business_license_file: input.businessLicenseFile, role: "pending", status: "pending",
  };
  if (input.branch) insertData.branch = input.branch;
  const { data, error } = await supabase.from("users").insert(insertData).select().single();
  if (error && error.message?.includes("branch")) {
    delete insertData.branch;
    const { data: d2, error: e2 } = await supabase.from("users").insert(insertData).select().single();
    if (e2 || !d2) throw new Error(e2?.message || "회원가입에 실패했습니다.");
    return rowToUser(d2);
  }
  if (error || !data) throw new Error(error?.message || "회원가입에 실패했습니다.");
  return rowToUser(data);
}

export async function approveUser(id: string): Promise<boolean> {
  // 유저 승인
  const { data: user } = await supabase.from("users").select("*").eq("id", id).single();
  if (!user) return false;
  const { error } = await supabase.from("users").update({ status: "approved", role: "field" }).eq("id", id);
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

export async function changeUserRole(id: string, role: string): Promise<boolean> {
  const { error } = await supabase.from("users").update({ role }).eq("id", id);
  return !error;
}

export async function updateUserInfo(id: string, data: { address?: string; phone?: string; branch?: string }): Promise<boolean> {
  const update: Record<string, unknown> = {};
  if (data.address !== undefined) update.address = data.address;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.branch !== undefined) update.branch = data.branch;
  const { error } = await supabase.from("users").update(update).eq("id", id);
  return !error;
}

export async function deleteUser(id: string): Promise<boolean> {
  // 연결된 멤버도 삭제
  const { data: user } = await supabase.from("users").select("username").eq("id", id).single();
  if (user) {
    await supabase.from("members").delete().eq("linked_username", String(user.username));
  }
  const { error } = await supabase.from("users").delete().eq("id", id);
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

// 모든 아이템을 동일 상태로 atomically 세팅 (전체선택/전체해제 race 방지)
// handleSelectAll 이 개별 토글을 수십 개 병렬 호출할 때 각 요청이 current state 를 읽고 덮어써
// 마지막 write 만 반영되던 버그 수정 — 이제 단일 쿼리로 일괄 처리.
export async function setAllChecklistItems(scheduleId: string, checked: boolean): Promise<ScheduleChecklist | null> {
  const cl = await getChecklist(scheduleId);
  cl.categories = cl.categories.map(cat => ({
    ...cat,
    items: cat.items.map(item => ({ ...item, checked }))
  }));
  cl.completedCount = checked ? cl.totalCount : 0;
  await supabase.from("checklists").update({ categories: cl.categories, completed_count: cl.completedCount }).eq("schedule_id", scheduleId);
  return cl;
}

// 검수 완료: submit 버튼은 progress 100% 에서만 활성화되므로 무조건 전체 체크로 최종 저장.
// 과거엔 handleSelectAll 의 개별 toggle 병렬 호출이 DB JSON read-modify-write race 로
// 1개만 살아남은 상태에서 submit 이 그걸 재조회해 그대로 UI 에 반영하던 버그 있었음.
// 이제 서버가 submit 시 **atomic 하게 전체true + submitted_at** 으로 덮어써
// 클라이언트 구 버전/race 와 무관하게 항상 올바른 최종 상태 보장.
export async function submitChecklist(scheduleId: string): Promise<ScheduleChecklist | null> {
  const now = new Date().toISOString();
  const cl = await getChecklist(scheduleId);
  const categories = cl.categories.map((cat) => ({
    ...cat,
    items: cat.items.map((item) => ({ ...item, checked: true })),
  }));
  await supabase.from("checklists").update({
    categories,
    completed_count: cl.totalCount,
    submitted_at: now,
  }).eq("schedule_id", scheduleId);
  return { ...cl, categories, completedCount: cl.totalCount, submittedAt: now };
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
