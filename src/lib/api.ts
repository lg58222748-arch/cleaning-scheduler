import { Member, Schedule, SwapRequest } from "@/types";

const BASE = "";

// 안전한 fetch 래퍼 - 네트워크 오류/비정상 응답 처리
async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (e) {
    console.error(`API 오류 [${options?.method || "GET"} ${url}]:`, e);
    throw e;
  }
}

async function safeJson<T>(url: string, fallback: T, options?: RequestInit): Promise<T> {
  try {
    const res = await safeFetch(url, options);
    return await res.json();
  } catch {
    return fallback;
  }
}

// Members
export async function fetchMembers(): Promise<Member[]> {
  return safeJson(`${BASE}/api/members`, []);
}

export async function createMember(data: { name: string; phone?: string; availableDays?: number[] }): Promise<Member> {
  const res = await safeFetch(`${BASE}/api/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateMember(id: string, data: Partial<Member>): Promise<Member> {
  const res = await safeFetch(`${BASE}/api/members/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteMember(id: string): Promise<void> {
  await safeFetch(`${BASE}/api/members/${id}`, { method: "DELETE" });
}

// Schedules
export async function fetchSchedules(start?: string, end?: string): Promise<Schedule[]> {
  const params = start && end ? `?start=${start}&end=${end}` : "";
  return safeJson(`${BASE}/api/schedules${params}`, []);
}

export async function searchSchedules(query: string): Promise<Schedule[]> {
  return safeJson(`${BASE}/api/schedules?q=${encodeURIComponent(query)}`, []);
}

export async function softDeleteSchedule(id: string): Promise<void> {
  await safeFetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "softDelete", scheduleId: id }),
  });
}

export async function deleteAllSchedules(): Promise<{ deleted: number }> {
  const res = await safeFetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "deleteAll" }),
  });
  return res.json();
}

export async function fetchDeletedSchedules(): Promise<Schedule[]> {
  return safeJson(`${BASE}/api/schedules?deleted=true`, []);
}

export async function restoreScheduleApi(id: string): Promise<void> {
  await safeFetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "restore", scheduleId: id }),
  });
}

export async function emptyTrashApi(): Promise<{ deleted: number }> {
  const res = await safeFetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "emptyTrash" }),
  });
  return res.json();
}

export async function createSchedule(data: Omit<Schedule, "id" | "status">): Promise<Schedule> {
  const res = await safeFetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchUnassignedSchedules(): Promise<Schedule[]> {
  return safeJson(`${BASE}/api/schedules?unassigned=true`, []);
}

export async function assignScheduleApi(scheduleId: string, memberId: string, memberName: string): Promise<Schedule> {
  const res = await safeFetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "assign", scheduleId, memberId, memberName }),
  });
  return res.json();
}

export async function unassignScheduleApi(scheduleId: string): Promise<Schedule> {
  const res = await safeFetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unassign", scheduleId }),
  });
  return res.json();
}

export async function addUnassignedSchedule(data: { title: string; date: string; startTime?: string; endTime?: string; note?: string; googleEventId?: string; color?: string }): Promise<Schedule> {
  const res = await safeFetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addUnassigned", ...data }),
  });
  return res.json();
}

export async function updateSchedule(id: string, data: Partial<Schedule>): Promise<Schedule> {
  const res = await safeFetch(`${BASE}/api/schedules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteSchedule(id: string): Promise<void> {
  await safeFetch(`${BASE}/api/schedules/${id}`, { method: "DELETE" });
}

// Swap
export async function fetchSwapRequests(): Promise<SwapRequest[]> {
  return safeJson(`${BASE}/api/schedules/swap`, []);
}

export async function createSwapRequest(fromScheduleId: string, toScheduleId: string): Promise<SwapRequest> {
  const res = await safeFetch(`${BASE}/api/schedules/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", fromScheduleId, toScheduleId }),
  });
  return res.json();
}

export async function approveSwapRequest(swapId: string): Promise<void> {
  await safeFetch(`${BASE}/api/schedules/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve", swapId }),
  });
}

export async function rejectSwapRequest(swapId: string): Promise<void> {
  await safeFetch(`${BASE}/api/schedules/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reject", swapId }),
  });
}

// Google Calendar
export async function getGoogleAuthUrl(): Promise<{ authUrl?: string; error?: string; needSetup?: boolean }> {
  return safeJson(`${BASE}/api/calendar?action=auth-url`, { error: "네트워크 오류" });
}

export async function autoSyncGoogleCalendar(refreshToken: string): Promise<{ items?: GoogleEvent[]; error?: string; needReauth?: boolean; newAccessToken?: string }> {
  try {
    const res = await safeFetch(`${BASE}/api/calendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "auto-sync", refreshToken }),
    });
    return res.json();
  } catch {
    return { error: "네트워크 오류" };
  }
}

interface GoogleEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
}

export async function fetchGoogleEvents(accessToken: string, timeMin: string, timeMax: string) {
  try {
    const res = await safeFetch(`${BASE}/api/calendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fetch-events", accessToken, timeMin, timeMax }),
    });
    return res.json();
  } catch {
    return { error: "네트워크 오류" };
  }
}

// Notifications
export async function fetchNotifications(): Promise<{ notifications: import("@/types").Notification[]; unreadCount: number }> {
  return safeJson(`${BASE}/api/notifications`, { notifications: [], unreadCount: 0 });
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await safeFetch(`${BASE}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead", id }),
    });
  } catch { /* 낙관적 업데이트 - UI는 이미 반영됨 */ }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await safeFetch(`${BASE}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markAllRead" }),
    });
  } catch { /* 낙관적 업데이트 */ }
}

// Comments
export async function fetchComments(scheduleId: string): Promise<import("@/types").Comment[]> {
  return safeJson(`${BASE}/api/comments?scheduleId=${scheduleId}`, []);
}

export async function createComment(scheduleId: string, authorName: string, content: string): Promise<import("@/types").Comment> {
  const res = await safeFetch(`${BASE}/api/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduleId, authorName, content }),
  });
  return res.json();
}

export async function deleteCommentApi(id: string): Promise<void> {
  await safeFetch(`${BASE}/api/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
}

// Auth
export async function loginApi(username: string, password: string): Promise<{ error?: string; status?: string } & Partial<import("@/types").User>> {
  try {
    const res = await safeFetch(`${BASE}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", username, password }),
    });
    return res.json();
  } catch {
    return { error: "네트워크 오류. 인터넷 연결을 확인해주세요." };
  }
}

export async function registerApi(data: {
  username: string; password: string;
  name: string; phone: string; address: string;
  residentNumber: string; businessLicenseFile: string; branch: string;
}): Promise<{ error?: string } & Partial<import("@/types").User>> {
  try {
    const res = await safeFetch(`${BASE}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", ...data }),
    });
    return res.json();
  } catch {
    return { error: "네트워크 오류. 인터넷 연결을 확인해주세요." };
  }
}

// Users (Admin)
export async function fetchUsers(): Promise<{ users: import("@/types").User[]; pendingUsers: import("@/types").User[] }> {
  return safeJson(`${BASE}/api/users`, { users: [], pendingUsers: [] });
}

export async function approveUserApi(userId: string): Promise<void> {
  await safeFetch(`${BASE}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve", userId }),
  });
}

export async function rejectUserApi(userId: string): Promise<void> {
  await safeFetch(`${BASE}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reject", userId }),
  });
}

export async function deleteUserApi(userId: string): Promise<void> {
  await safeFetch(`${BASE}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", userId }),
  });
}

export async function changeUserRoleApi(userId: string, role: string): Promise<void> {
  await safeFetch(`${BASE}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "changeRole", userId, role }),
  });
}

// Checklist
export async function fetchChecklist(scheduleId: string): Promise<import("@/types").ScheduleChecklist> {
  return safeJson(`${BASE}/api/checklist?scheduleId=${scheduleId}`, { items: [], submitted: false } as unknown as import("@/types").ScheduleChecklist);
}

export async function toggleChecklistItem(scheduleId: string, itemId: string, checked: boolean): Promise<import("@/types").ScheduleChecklist> {
  const res = await safeFetch(`${BASE}/api/checklist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "toggle", scheduleId, itemId, checked }),
  });
  return res.json();
}

export async function submitChecklistApi(scheduleId: string): Promise<import("@/types").ScheduleChecklist> {
  const res = await safeFetch(`${BASE}/api/checklist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "submit", scheduleId }),
  });
  return res.json();
}

// Settlement
export async function fetchSettlement(scheduleId: string): Promise<import("@/types").Settlement | null> {
  return safeJson(`${BASE}/api/settlement?scheduleId=${scheduleId}`, null);
}

export async function saveSettlement(scheduleId: string, data: Partial<import("@/types").Settlement>): Promise<import("@/types").Settlement> {
  const res = await safeFetch(`${BASE}/api/settlement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduleId, ...data }),
  });
  return res.json();
}
