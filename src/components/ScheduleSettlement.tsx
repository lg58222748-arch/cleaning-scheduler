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

  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSave(status: "draft" | "completed" = "draft") {
    const data = await saveSettlement(scheduleId, {
      quote: parseInt(quote) || 0,
      deposit: parseInt(deposit) || 0,
      extraCharge: parseInt(extraCharge) || 0,
      paymentMethod, cashReceipt, customerName, customerPhone, note, status,
    });
    setS(data);
    if (status === "completed") setShowShareModal(true);
  }

  function getShareText() {
    const pm = paymentMethod === "transfer" ? "계좌이체" : paymentMethod === "cash" ? "현금결제" : "카드결제";
    const lines = [
      "━━━━━━━━━━━━━━━",
      "🏠 새집느낌 정산서",
      "━━━━━━━━━━━━━━━",
      "",
      `📋 결제방식: ${pm}`,
      `📝 현금영수증: ${cashReceipt ? "신청" : "미신청 (자진발급)"}`,
      "",
      "─── 상담받은 견적 ───",
      `견적 금액: ${formatWon(q)}`,
      `예약금: ${formatWon(d)}`,
      "",
      "─── 현장 정산 ───",
      `잔금: ${formatWon(balance)}`,
      `현장 추가금: ${formatWon(e)}`,
      "",
      "─── 정산 내역 ───",
      `전체 부가세(10%): ${formatWon(vatTotal)}`,
      `현장 결제 금액: ${formatWon(fieldPayment)}`,
      "",
      "━━━━━━━━━━━━━━━",
      `💰 최종 결제 금액: ${formatWon(total)}`,
      "━━━━━━━━━━━━━━━",
      "",
      `총 서비스 금액: ${formatWon(serviceTotal)} (부가세 별도)`,
      `총 서비스 금액: ${formatWon(serviceTotalVat)} (부가세 포함)`,
    ];
    if (cashReceipt) {
      lines.push("", "✅ 현금영수증 신청 확인되었습니다.");
    } else {
      lines.push("", "📌 현금영수증 미신청 → 자진발급 처리됩니다.");
    }
    lines.push("", "감사합니다! 🙏", "새집느낌");
    return lines.join("\n");
  }

  async function handleCopy() {
    const text = getShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleShare() {
    const text = getShareText();
    if (navigator.share) {
      try { await navigator.share({ title: "새집느낌 정산서", text }); } catch {}
    } else {
      handleCopy();
    }
  }

  // 원본 계산법
  const q = parseInt(quote) || 0;
  const d = parseInt(deposit) || 0;
  const e = parseInt(extraCharge) || 0;
  const balance = q - d; // 잔금
  const fieldPayment = balance + e; // 현장 결제 (부가세 제외)
  const vatTotal = Math.round((balance + e + d) * 0.1); // 전체 부가세 = (잔금+추가금+예약금) × 10%
  const total = fieldPayment + vatTotal; // 최종 결제 = 현장결제 + 전체부가세
  const serviceTotal = q + e; // 총 서비스 금액 (부가세 제외)
  const serviceTotalVat = serviceTotal + Math.round(serviceTotal * 0.1); // 총 서비스 금액 (부가세 포함)

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">로딩 중...</div>;

  const isCompleted = s?.status === "completed";

  // 현금영수증 멘트
  const receiptMsg = cashReceipt
    ? "현금영수증 신청 확인했습니다. 안내드린 견적은 공급가액 기준이며, 부가세는 법적으로 부과되는 세금으로 저희가 추가로 받는 금액이 아닌 점 양해 부탁드립니다. 부가세 포함 최종 금액 안내드리겠습니다. 감사합니다!"
    : "현금영수증 미신청 확인했습니다. 안내드린 견적은 공급가액 기준이며, 부가세는 법적으로 부과되는 세금으로 저희가 추가로 받는 금액이 아닌 점 양해 부탁드립니다. 최종 금액 안내드리겠습니다. 현금영수증은 자진발급 처리됩니다. 감사합니다!";

  return (
    <div className="space-y-4 px-4 pt-4 pb-4">
      {isCompleted && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 text-center font-medium">
          정산 완료됨
        </div>
      )}

      {/* 결제 방식 - 드롭다운 */}
      <div>
        <select
          value={paymentMethod}
          onChange={(e) => !isCompleted && setPaymentMethod(e.target.value as PaymentMethod)}
          disabled={isCompleted}
          className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white disabled:bg-gray-50"
        >
          <option value="transfer">💳 계좌이체</option>
          <option value="cash">💵 현금결제</option>
          <option value="card">💳 카드결제</option>
        </select>
      </div>

      {/* Step 1: 상담받은 견적 */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-blue-50">
          <h4 className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
            <span className="bg-blue-700 text-white text-[10px] px-1.5 py-0.5 rounded">1</span>
            상담받은 견적
          </h4>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="flex items-center px-4 py-3">
            <span className="flex-1 text-sm">견적 금액 <span className="text-[11px] text-gray-400">(공급가액)</span></span>
            <input type="tel" value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="0" disabled={isCompleted}
              className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50" />
          </div>
          <div className="flex items-center px-4 py-3">
            <span className="flex-1 text-sm">예약금 <span className="text-[11px] text-gray-400">(선납 완료)</span></span>
            <input type="tel" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" disabled={isCompleted}
              className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50" />
          </div>
        </div>
      </div>

      {/* Step 2: 현장 정산 견적 */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-blue-50">
          <h4 className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
            <span className="bg-blue-700 text-white text-[10px] px-1.5 py-0.5 rounded">2</span>
            현장 정산 견적
          </h4>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="flex items-center px-4 py-3">
            <span className="flex-1 text-sm">잔금</span>
            <span className="text-sm font-bold text-blue-700">{formatWon(balance)}</span>
          </div>
          <div className="flex items-center px-4 py-3">
            <span className="flex-1 text-sm">현장 추가금</span>
            <input type="tel" value={extraCharge} onChange={(e) => setExtraCharge(e.target.value)} placeholder="0" disabled={isCompleted}
              className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50" />
          </div>
        </div>
      </div>

      {/* Step 3: 고객님 정산 확인 */}
      <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0f4c81, #1a6bb5)" }}>
        <div className="px-3 py-2" style={{ background: "rgba(255,255,255,0.1)" }}>
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <span className="bg-white text-blue-700 text-[10px] px-1.5 py-0.5 rounded">3</span>
            고객님 정산 확인
          </h4>
        </div>
        <div className="divide-y divide-white/10">
          <div className="flex items-center px-4 py-3.5">
            <div className="flex-1">
              <div className="text-sm text-white/85">전체 부가세 10%</div>
              <div className="text-[10px] text-white/50">잔금 + 추가금 + 예약금</div>
            </div>
            <span className="text-base font-bold text-white">{formatWon(vatTotal)}</span>
          </div>
          <div className="flex items-center px-4 py-3.5">
            <div className="flex-1">
              <div className="text-sm text-white/85">현장 결제 금액</div>
              <div className="text-[10px] text-white/50">잔금 + 추가금 (부가세 제외)</div>
            </div>
            <span className="text-base font-bold text-white">{formatWon(fieldPayment)}</span>
          </div>
          <div className="flex items-center px-4 py-3.5">
            <div className="flex-1">
              <div className="text-sm text-white/85 font-bold">최종 결제 금액</div>
              <div className="text-[10px] text-white/50">현장 결제 + 전체 부가세</div>
            </div>
            <span className="text-lg font-bold text-sky-300">{formatWon(total)}</span>
          </div>
        </div>
      </div>

      {/* 총 서비스 금액 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-blue-200">
          <div className="flex-1">
            <div className="text-sm font-medium text-blue-800">총 서비스 금액</div>
            <div className="text-[10px] text-blue-500">견적 + 추가금 (부가세 제외)</div>
          </div>
          <span className="text-base font-bold text-blue-800">{formatWon(serviceTotal)}</span>
        </div>
        <div className="flex items-center px-4 py-3">
          <div className="flex-1">
            <div className="text-sm font-medium text-blue-800">총 서비스 금액</div>
            <div className="text-[10px] text-blue-500">부가세 10% 포함</div>
          </div>
          <span className="text-base font-bold text-blue-800">{formatWon(serviceTotalVat)}</span>
        </div>
      </div>

      {/* 현금영수증 */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200">
        <button
          onClick={() => !isCompleted && setCashReceipt(true)}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${cashReceipt ? "bg-blue-700 text-white" : "bg-white text-gray-500"}`}
        >
          현금영수증 신청
        </button>
        <button
          onClick={() => !isCompleted && setCashReceipt(false)}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${!cashReceipt ? "bg-blue-700 text-white" : "bg-white text-gray-500"}`}
        >
          현금영수증 미신청
        </button>
      </div>
      {!cashReceipt && (
        <div className="text-xs text-gray-500 text-center">💡 미신청 시 자진발급 처리 (010-000-1234)</div>
      )}

      {/* Actions */}
      {!isCompleted && (
        <div className="flex gap-2">
          <button onClick={() => handleSave("draft")} className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl text-sm font-medium active:bg-gray-300">
            임시 저장
          </button>
          <button onClick={() => handleSave("completed")} className="flex-1 py-3 rounded-xl text-sm font-bold text-white active:opacity-90"
            style={{ background: "linear-gradient(135deg, #00c473, #00a35e)" }}>
            💰 정산 완료
          </button>
        </div>
      )}

      {/* 고객 안내 멘트 */}
      <div className="border border-gray-200 rounded-xl p-4">
        <div className="text-xs font-bold text-blue-800 mb-2">📢 고객님 안내 멘트</div>
        <div className="text-xs text-gray-600 leading-relaxed mb-3">{receiptMsg}</div>
        <div className="rounded-xl p-4 text-center" style={{ background: "linear-gradient(135deg, #0f4c81, #1a6bb5)", boxShadow: "0 4px 16px rgba(15,76,129,0.3)" }}>
          <div className="text-[11px] text-white/60 mb-1">최종 결제 금액</div>
          <div className="text-2xl font-extrabold text-white tracking-tight">{formatWon(total)}</div>
          <div className="border-t border-white/15 mt-2 pt-2 text-xs text-white/80">
            {paymentMethod === "transfer" ? "💳 계좌이체" : paymentMethod === "cash" ? "💵 현금결제" : "💳 카드결제"}
          </div>
        </div>
      </div>

      {/* 정산서 공유 버튼 (완료 후) */}
      {isCompleted && (
        <div className="flex gap-2">
          <button onClick={handleCopy} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold active:bg-gray-200">
            {copied ? "✅ 복사됨!" : "📋 정산서 복사"}
          </button>
          <button onClick={handleShare} className="flex-1 py-3 rounded-xl text-sm font-bold text-white active:opacity-90"
            style={{ background: "#FEE500", color: "#3C1E1E" }}>
            📤 공유하기
          </button>
        </div>
      )}

      {/* 정산 완료 공유 모달 */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={(e) => { if (e.target === e.currentTarget) setShowShareModal(false); }}>
          <div className="bg-white rounded-t-2xl w-full max-w-md p-5 pb-8 animate-[modalIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">💰 정산 완료</h3>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 text-xl">&times;</button>
            </div>

            {/* 미리보기 */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4 max-h-[40vh] overflow-y-auto">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{getShareText()}</pre>
            </div>

            <div className="space-y-2">
              <button onClick={handleCopy} className="w-full py-3 bg-gray-100 rounded-xl text-sm font-bold active:bg-gray-200">
                {copied ? "✅ 복사 완료!" : "📋 텍스트 복사 (카톡/문자에 붙여넣기)"}
              </button>
              <button onClick={handleShare} className="w-full py-3 rounded-xl text-sm font-bold active:opacity-90"
                style={{ background: "#FEE500", color: "#3C1E1E" }}>
                📤 공유하기 (카톡/문자 등)
              </button>
            </div>
            <div className="text-[11px] text-gray-400 text-center mt-3">💡 복사 후 카카오톡이나 문자에 붙여넣기 하세요</div>
          </div>
        </div>
      )}
    </div>
  );
}
