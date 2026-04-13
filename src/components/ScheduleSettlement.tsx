"use client";

import { useState, useEffect, useCallback } from "react";
import { Settlement, PaymentMethod } from "@/types";
import { fetchSettlement, saveSettlement } from "@/lib/api";

interface ScheduleSettlementProps {
  scheduleId: string;
}

function formatWon(n: number): string {
  return n.toLocaleString("ko") + "원";
}

export default function ScheduleSettlement({ scheduleId }: ScheduleSettlementProps) {
  const [s, setS] = useState<Settlement | null>(null);
  const [quote, setQuote] = useState("");
  const [deposit, setDeposit] = useState("");
  const [extraCharge, setExtraCharge] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer");
  const [cashReceipt, setCashReceipt] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  const loadSettlement = useCallback(async () => {
    setLoading(true);
    const data = await fetchSettlement(scheduleId);
    if (data) {
      setS(data);
      setQuote(data.quote > 0 ? String(data.quote) : "");
      setDeposit(data.deposit > 0 ? String(data.deposit) : "");
      setExtraCharge(data.extraCharge > 0 ? String(data.extraCharge) : "");
      setPaymentMethod(data.paymentMethod);
      setCashReceipt(data.cashReceipt);
      setCustomerName(data.customerName);
      setCustomerPhone(data.customerPhone);
      setNote(data.note);
    }
    setLoading(false);
  }, [scheduleId]);

  useEffect(() => { loadSettlement(); }, [loadSettlement]);

  async function handleSave(status: "draft" | "completed" = "draft") {
    const data = await saveSettlement(scheduleId, {
      quote: parseInt(quote) || 0,
      deposit: parseInt(deposit) || 0,
      extraCharge: parseInt(extraCharge) || 0,
      paymentMethod, cashReceipt, customerName, customerPhone, note, status,
    });
    setS(data);
  }

  // Auto-calculate for display
  const q = parseInt(quote) || 0;
  const d = parseInt(deposit) || 0;
  const e = parseInt(extraCharge) || 0;
  const balance = q - d;
  const subtotal = balance + e;
  const vat = Math.round(subtotal * 0.1);
  const total = subtotal + vat;

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">로딩 중...</div>;

  const isCompleted = s?.status === "completed";

  return (
    <div className="space-y-4 px-4 pb-4">
      {isCompleted && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 text-center font-medium">
          정산 완료됨
        </div>
      )}

      {/* Step 1: 견적 */}
      <div className="border border-gray-200 rounded-xl p-3 space-y-3">
        <h4 className="text-xs font-bold text-blue-600">① 상담받은 견적</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">견적금액 (공급가액)</label>
            <input
              type="number" value={quote} onChange={(e) => setQuote(e.target.value)}
              placeholder="0" disabled={isCompleted}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">예약금 (선납)</label>
            <input
              type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)}
              placeholder="0" disabled={isCompleted}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* Step 2: 현장 정산 */}
      <div className="border border-gray-200 rounded-xl p-3 space-y-3">
        <h4 className="text-xs font-bold text-blue-600">② 현장 정산</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">잔금 (자동계산)</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
              {formatWon(balance)}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">현장 추가금</label>
            <input
              type="number" value={extraCharge} onChange={(e) => setExtraCharge(e.target.value)}
              placeholder="0" disabled={isCompleted}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* Step 3: 최종 정산 */}
      <div className="border border-gray-200 rounded-xl p-3 space-y-3">
        <h4 className="text-xs font-bold text-blue-600">③ 최종 정산</h4>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">세전 합계</span>
            <span className="font-medium">{formatWon(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">부가세 (10%)</span>
            <span className="font-medium">{formatWon(vat)}</span>
          </div>
          <div className="border-t border-gray-200 pt-1.5 flex justify-between">
            <span className="text-gray-800 font-bold">최종 결제 금액</span>
            <span className="text-blue-600 font-bold text-base">{formatWon(total)}</span>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="border border-gray-200 rounded-xl p-3 space-y-3">
        <h4 className="text-xs font-bold text-gray-600">결제 방식</h4>
        <div className="flex gap-2">
          {([["transfer", "계좌이체"], ["cash", "현금"], ["card", "카드"]] as [PaymentMethod, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => !isCompleted && setPaymentMethod(val)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                paymentMethod === val ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => !isCompleted && setCashReceipt(true)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium ${cashReceipt ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            현금영수증 신청
          </button>
          <button
            onClick={() => !isCompleted && setCashReceipt(false)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium ${!cashReceipt ? "bg-gray-500 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            미신청
          </button>
        </div>
      </div>

      {/* Customer info */}
      <div className="border border-gray-200 rounded-xl p-3 space-y-2">
        <h4 className="text-xs font-bold text-gray-600">고객 정보</h4>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={customerName} onChange={(e) => setCustomerName(e.target.value)}
            placeholder="고객명" disabled={isCompleted}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
          />
          <input
            value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="연락처" disabled={isCompleted}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
          />
        </div>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="메모" rows={2} disabled={isCompleted}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 resize-none disabled:bg-gray-50"
        />
      </div>

      {/* Actions */}
      {!isCompleted && (
        <div className="flex gap-2">
          <button
            onClick={() => handleSave("draft")}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl text-sm font-medium active:bg-gray-300"
          >
            임시 저장
          </button>
          <button
            onClick={() => handleSave("completed")}
            className="flex-1 py-3 bg-blue-500 text-white rounded-xl text-sm font-medium active:bg-blue-600"
          >
            정산 완료
          </button>
        </div>
      )}
    </div>
  );
}
