"use client";

import { useState, useEffect } from "react";
import { User } from "@/types";
import { fetchUsers, approveUserApi, rejectUserApi } from "@/lib/api";

interface AdminPanelProps {
  onClose: () => void;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    const data = await fetchUsers();
    setUsers(data.users);
    setPendingUsers(data.pendingUsers);
  }

  async function handleApprove(userId: string) {
    await approveUserApi(userId);
    loadUsers();
  }

  async function handleReject(userId: string) {
    await rejectUserApi(userId);
    loadUsers();
  }

  const roleLabels: Record<string, string> = { admin: "관리자", manager: "관리사", pending: "대기" };
  const statusColors: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[85vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-800">관리사 관리</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Pending */}
          {pendingUsers.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-orange-600 mb-2">승인 대기 ({pendingUsers.length})</h4>
              <div className="space-y-2">
                {pendingUsers.map((u) => (
                  <div key={u.id} className="border-2 border-orange-200 bg-orange-50 rounded-xl p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-800">{u.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{u.phone} · {u.address}</div>
                        {u.businessLicenseFile && (
                          <div className="text-xs text-blue-500 mt-0.5">사업자등록증: {u.businessLicenseFile}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleApprove(u.id)}
                        className="flex-1 py-2 bg-green-500 text-white rounded-lg text-xs font-medium"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => handleReject(u.id)}
                        className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-medium"
                      >
                        거절
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All users */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">전체 사용자 ({users.length})</h4>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                    {u.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{u.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full">{roleLabels[u.role]}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[u.status]}`}>{u.status === "approved" ? "승인" : u.status === "pending" ? "대기" : "거절"}</span>
                    </div>
                    <div className="text-xs text-gray-400">{u.phone}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
