"use client";

import { SwapRequest, Schedule, Member } from "@/types";

interface SwapPanelProps {
  swapRequests: SwapRequest[];
  schedules: Schedule[];
  members: Member[];
  onApprove: (swapId: string) => void;
  onReject: (swapId: string) => void;
  onClose: () => void;
}

export default function SwapPanel({
  swapRequests,
  schedules,
  members,
  onApprove,
  onReject,
  onClose,
}: SwapPanelProps) {
  const pendingSwaps = swapRequests.filter((r) => r.status === "pending");
  const pastSwaps = swapRequests.filter((r) => r.status !== "pending");

  function getScheduleInfo(scheduleId: string) {
    return schedules.find((s) => s.id === scheduleId);
  }

  function getMemberName(memberId: string) {
    return members.find((m) => m.id === memberId)?.name || "알 수 없음";
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">일정 교환 관리</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {pendingSwaps.length === 0 && pastSwaps.length === 0 && (
            <div className="text-center text-gray-400 py-12">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <p>교환 요청이 없습니다</p>
              <p className="text-sm mt-1">일정 목록에서 교환 모드를 활성화하여 교환을 요청하세요</p>
            </div>
          )}

          {pendingSwaps.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-500 mb-3">대기 중인 교환 요청</h4>
              <div className="space-y-3">
                {pendingSwaps.map((swap) => {
                  const fromSchedule = getScheduleInfo(swap.fromScheduleId);
                  const toSchedule = getScheduleInfo(swap.toScheduleId);
                  return (
                    <div key={swap.id} className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-medium text-gray-800">
                          {getMemberName(swap.fromMemberId)}
                        </span>
                        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <span className="font-medium text-gray-800">
                          {getMemberName(swap.toMemberId)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1 mb-3">
                        {fromSchedule && (
                          <p>{fromSchedule.date} {fromSchedule.startTime} {fromSchedule.title}</p>
                        )}
                        {toSchedule && (
                          <p>{toSchedule.date} {toSchedule.startTime} {toSchedule.title}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onApprove(swap.id)}
                          className="flex-1 px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => onReject(swap.id)}
                          className="flex-1 px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          거절
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pastSwaps.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3">처리 완료</h4>
              <div className="space-y-2">
                {pastSwaps.map((swap) => (
                  <div
                    key={swap.id}
                    className={`border rounded-xl p-3 text-sm ${
                      swap.status === "approved"
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <span className="font-medium">{getMemberName(swap.fromMemberId)}</span>
                    {" ↔ "}
                    <span className="font-medium">{getMemberName(swap.toMemberId)}</span>
                    <span className={`ml-2 text-xs ${swap.status === "approved" ? "text-green-600" : "text-red-600"}`}>
                      {swap.status === "approved" ? "승인됨" : "거절됨"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
