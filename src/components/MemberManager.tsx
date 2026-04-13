"use client";

import { useState } from "react";
import { Member } from "@/types";

interface MemberManagerProps {
  members: Member[];
  onAdd: (data: { name: string; phone: string; availableDays: number[] }) => void;
  onUpdate: (id: string, data: Partial<Member>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export default function MemberManager({
  members,
  onAdd,
  onUpdate,
  onDelete,
  onClose,
}: MemberManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDays, setEditDays] = useState<number[]>([]);

  function handleAdd() {
    if (!newName.trim()) return;
    onAdd({ name: newName.trim(), phone: newPhone.trim(), availableDays: newDays });
    setNewName("");
    setNewPhone("");
    setNewDays([1, 2, 3, 4, 5]);
    setShowAddForm(false);
  }

  function startEdit(m: Member) {
    setEditingId(m.id);
    setEditName(m.name);
    setEditPhone(m.phone || "");
    setEditDays([...m.availableDays]);
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    onUpdate(editingId, {
      name: editName.trim(),
      phone: editPhone.trim(),
      availableDays: editDays,
    });
    setEditingId(null);
  }

  function toggleDay(days: number[], day: number, setDays: (d: number[]) => void) {
    if (days.includes(day)) {
      setDays(days.filter((d) => d !== day));
    } else {
      setDays([...days, day].sort());
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">팀원 관리</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {members.map((m) => (
            <div
              key={m.id}
              className="border border-gray-200 rounded-xl p-4"
            >
              {editingId === m.id ? (
                <div className="space-y-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                    placeholder="이름"
                  />
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                    placeholder="전화번호"
                  />
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">근무 가능 요일</label>
                    <div className="flex gap-1">
                      {DAY_NAMES.map((name, i) => (
                        <button
                          key={i}
                          onClick={() => toggleDay(editDays, i, setEditDays)}
                          className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                            editDays.includes(i)
                              ? "bg-blue-500 text-white"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={saveEdit}
                      className="flex-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{m.name}</span>
                      {!m.active && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                          비활성
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{m.phone || "-"}</div>
                    <div className="flex gap-1 mt-1">
                      {DAY_NAMES.map((name, i) => (
                        <span
                          key={i}
                          className={`text-[10px] w-5 h-5 flex items-center justify-center rounded-full ${
                            m.availableDays.includes(i)
                              ? "bg-blue-100 text-blue-600"
                              : "text-gray-300"
                          }`}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(m)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
                      title="수정"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onUpdate(m.id, { active: !m.active })}
                      className={`p-1.5 rounded-lg ${
                        m.active
                          ? "text-gray-400 hover:text-yellow-500 hover:bg-yellow-50"
                          : "text-yellow-500 hover:text-green-500 hover:bg-green-50"
                      }`}
                      title={m.active ? "비활성화" : "활성화"}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={m.active ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(m.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      title="삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add new member */}
          {showAddForm ? (
            <div className="border-2 border-dashed border-blue-300 rounded-xl p-4 space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                placeholder="이름 *"
                autoFocus
              />
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                placeholder="전화번호"
              />
              <div>
                <label className="text-xs text-gray-500 mb-1 block">근무 가능 요일</label>
                <div className="flex gap-1">
                  {DAY_NAMES.map((name, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(newDays, i, setNewDays)}
                      className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                        newDays.includes(i)
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleAdd}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  추가
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-sm font-medium"
            >
              + 새 팀원 추가
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
