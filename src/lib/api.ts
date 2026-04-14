import { Member, Schedule, SwapRequest } from "@/types";

const BASE = "";

// Members
export async function fetchMembers(): Promise<Member[]> {
  const res = await fetch(`${BASE}/api/members`);
  return res.json();
}

export async function createMember(data: { name: string; phone?: string; availableDays?: number[] }): Promise<Member> {
  const res = await fetch(`${BASE}/api/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateMember(id: string, data: Partial<Member>): Promise<Member> {
  const res = await fetch(`${BASE}/api/members/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteMember(id: string): Promise<void> {
  await fetch(`${BASE}/api/members/${id}`, { method: "DELETE" });
}

// Schedules
export async function fetchSchedules(start?: string, end?: string): Promise<Schedule[]> {
  const params = start && end ? `?start=${start}&end=${end}` : "";
  const res = await fetch(`${BASE}/api/schedules${params}`);
  return res.json();
}

export async function searchSchedules(query: string): Promise<Schedule[]> {
  const res = await fetch(`${BASE}/api/schedules?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function softDeleteSchedule(id: string): Promise<void> {
  await fetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "softDelete", scheduleId: id }),
  });
}

export async function deleteAllSchedules(): Promise<{ deleted: number }> {
  const res = await fetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "deleteAll" }),
  });
  return res.json();
}

export async function fetchDeletedSchedules(): Promise<Schedule[]> {
  const res = await fetch(`${BASE}/api/schedules?deleted=true`);
  return res.json();
}

export async function restoreScheduleApi(id: string): Promise<void> {
  await fetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "restore", scheduleId: id }),
  });
}

export async function emptyTrashApi(): Promise<{ deleted: number }> {
  const res = await fetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "emptyTrash" }),
  });
  return res.json();
}

export async function createSchedule(data: Omit<Schedule, "id" | "status">): Promise<Schedule> {
  const res = await fetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchUnassignedSchedules(): Promise<Schedule[]> {
  const res = await fetch(`${BASE}/api/schedules?unassigned=true`);
  return res.json();
}

export async function assignScheduleApi(scheduleId: string, memberId: string, memberName: string): Promise<Schedule> {
  const res = await fetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "assign", scheduleId, memberId, memberName }),
  });
  return res.json();
}

export async function unassignScheduleApi(scheduleId: string): Promise<Schedule> {
  const res = await fetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unassign", scheduleId }),
  });
  return res.json();
}

export async function addUnassignedSchedule(data: { title: string; date: string; startTime?: string; endTime?: string; note?: string; googleEventId?: string }): Promise<Schedule> {
  const res = await fetch(`${BASE}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addUnassigned", ...data }),
  });
  return res.json();
}

export async function updateSchedule(id: string, data: Partial<Schedule>): Promise<Schedule> {
  const res = await fetch(`${BASE}/api/schedules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteSchedule(id: string): Promise<void> {
  await fetch(`${BASE}/api/schedules/${id}`, { method: "DELETE" });
}

// Swap
export async function fetchSwapRequests(): Promise<SwapRequest[]> {
  const res = await fetch(`${BASE}/api/schedules/swap`);
  return res.json();
}

export async function createSwapRequest(fromScheduleId: string, toScheduleId: string): Promise<SwapRequest> {
  const res = await fetch(`${BASE}/api/schedules/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", fromScheduleId, toScheduleId }),
  });
  return res.json();
}

export async function approveSwapRequest(swapId: string): Promise<void> {
  await fetch(`${BASE}/api/schedules/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve", swapId }),
  });
}

export async function rejectSwapRequest(swapId: string): Promise<void> {
  await fetch(`${BASE}/api/schedules/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reject", swapId }),
  });
}

// Google Calendar
export async function getGoogleAuthUrl(): Promise<{ authUrl?: string; error?: string; needSetup?: boolean }> {
  const res = await fetch(`${BASE}/api/calendar?action=auth-url`);
  return res.json();
}

export async function autoSyncGoogleCalendar(refreshToken: string): Promise<{ items?: GoogleEvent[]; error?: string; needReauth?: boolean; newAccessToken?: string }> {
  const res = await fetch(`${BASE}/api/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "auto-sync", refreshToken }),
  });
  return res.json();
}

interface GoogleEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
}

export async function fetchGoogleEvents(accessToken: string, timeMin: string, timeMax: string) {
  const res = await fetch(`${BASE}/api/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "fetch-events", accessToken, timeMin, timeMax }),
  });
  return res.json();
}

// Notifications
export async function fetchNotifications(): Promise<{ notifications: import("@/types").Notification[]; unreadCount: number }> {
  const res = await fetch(`${BASE}/api/notifications`);
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetch(`${BASE}/api/notifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "markRead", id }),
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetch(`${BASE}/api/notifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "markAllRead" }),
  });
}

// Comments
export async function fetchComments(scheduleId: string): Promise<import("@/types").Comment[]> {
  const res = await fetch(`${BASE}/api/comments?scheduleId=${scheduleId}`);
  return res.json();
}

export async function createComment(scheduleId: string, authorName: string, content: string): Promise<import("@/types").Comment> {
  const res = await fetch(`${BASE}/api/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduleId, authorName, content }),
  });
  return res.json();
}

export async function deleteCommentApi(id: string): Promise<void> {
  await fetch(`${BASE}/api/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
}

// Auth
export async function loginApi(username: string, password: string): Promise<{ error?: string; status?: string } & Partial<import("@/types").User>> {
  const res = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", username, password }),
  });
  return res.json();
}

export async function registerApi(data: {
  username: string; password: string;
  name: string; phone: string; address: string;
  residentNumber: string; businessLicenseFile: string;
}): Promise<{ error?: string } & Partial<import("@/types").User>> {
  const res = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "register", ...data }),
  });
  return res.json();
}

// Users (Admin)
export async function fetchUsers(): Promise<{ users: import("@/types").User[]; pendingUsers: import("@/types").User[] }> {
  const res = await fetch(`${BASE}/api/users`);
  return res.json();
}

export async function approveUserApi(userId: string): Promise<void> {
  await fetch(`${BASE}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve", userId }),
  });
}

export async function rejectUserApi(userId: string): Promise<void> {
  await fetch(`${BASE}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reject", userId }),
  });
}

// Checklist
export async function fetchChecklist(scheduleId: string): Promise<import("@/types").ScheduleChecklist> {
  const res = await fetch(`${BASE}/api/checklist?scheduleId=${scheduleId}`);
  return res.json();
}

export async function toggleChecklistItem(scheduleId: string, itemId: string, checked: boolean): Promise<import("@/types").ScheduleChecklist> {
  const res = await fetch(`${BASE}/api/checklist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "toggle", scheduleId, itemId, checked }),
  });
  return res.json();
}

export async function submitChecklistApi(scheduleId: string): Promise<import("@/types").ScheduleChecklist> {
  const res = await fetch(`${BASE}/api/checklist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "submit", scheduleId }),
  });
  return res.json();
}

// Settlement
export async function fetchSettlement(scheduleId: string): Promise<import("@/types").Settlement | null> {
  const res = await fetch(`${BASE}/api/settlement?scheduleId=${scheduleId}`);
  return res.json();
}

export async function saveSettlement(scheduleId: string, data: Partial<import("@/types").Settlement>): Promise<import("@/types").Settlement> {
  const res = await fetch(`${BASE}/api/settlement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduleId, ...data }),
  });
  return res.json();
}
