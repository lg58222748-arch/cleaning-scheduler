"use client";

import { useState, useEffect, useCallback } from "react";
import { Settlement, PaymentMethod } from "@/types";
import { fetchSettlement, saveSettlement, updateSchedule as apiUpdateSchedule } from "@/lib/api";

interface ScheduleSettlementProps {
  scheduleId: string;
  scheduleNote?: string;
  customerNameFromSchedule?: string;
  customerPhoneFromSchedule?: string;
  memberName?: string;
  memberBranch?: string;
  onCompleted?: () => void;
}

function formatWon(n: number): string {
  return n.toLocaleString("ko") + "원";
}

export default function ScheduleSettlement({ scheduleId, scheduleNote, customerNameFromSchedule, customerPhoneFromSchedule, memberName = "", memberBranch = "", onCompleted }: ScheduleSettlementProps) {
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
  const [showBankEdit, setShowBankEdit] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // 계좌정보: localStorage에서 불러오기 (한번 저장하면 계속 사용)
  const [depositorName, setDepositorName] = useState(() => typeof window !== "undefined" ? localStorage.getItem("bank_depositor") || "" : "");
  const [bankName, setBankName] = useState(() => typeof window !== "undefined" ? localStorage.getItem("bank_name") || "" : "");
  const [accountNumber, setAccountNumber] = useState(() => typeof window !== "undefined" ? localStorage.getItem("bank_account") || "" : "");

  function saveBankInfo() {
    localStorage.setItem("bank_depositor", depositorName);
    localStorage.setItem("bank_name", bankName);
    localStorage.setItem("bank_account", accountNumber);
    setShowBankEdit(false);
  }

  const loadSettlement = useCallback(async () => {
    setLoading(true);
    const data = await fetchSettlement(scheduleId);
    if (data) {
      setS(data);
      const hasExisting = data.quote > 0 || data.deposit > 0;
      if (hasExisting) {
        setQuote(String(data.quote));
        setDeposit(String(data.deposit));
      } else if (scheduleNote) {
        const qMatch = scheduleNote.match(/견적금액.*[:：]\s*([\d,]+)/);
        const dMatch = scheduleNote.match(/예\s*약\s*금.*[:：]\s*([\d,]+)/);
        if (qMatch) setQuote(qMatch[1].replace(/,/g, ""));
        if (dMatch) setDeposit(dMatch[1].replace(/,/g, ""));
      }
      setExtraCharge(data.extraCharge > 0 ? String(data.extraCharge) : "");
      setPaymentMethod(data.paymentMethod);
      setCashReceipt(data.cashReceipt);
      setCustomerName(data.customerName || customerNameFromSchedule || "");
      setCustomerPhone(data.customerPhone || customerPhoneFromSchedule || "");
      setNote(data.note);
    }
    setLoading(false);
  }, [scheduleId, scheduleNote, customerNameFromSchedule, customerPhoneFromSchedule]);

  useEffect(() => { loadSettlement(); }, [loadSettlement]);

  const q = parseInt(quote) || 0;
  const d = parseInt(deposit) || 0;
  const e = parseInt(extraCharge) || 0;
  const balance = q - d;
  const fieldPayment = balance + e;
  const vatTotal = Math.round((balance + e + d) * 0.1);
  const total = cashReceipt ? fieldPayment + vatTotal : fieldPayment;

  const receiptMsg = cashReceipt
    ? "현금영수증 신청 확인했습니다. 안내드린 견적은 공급가액 기준이며, 부가세는 법적으로 부과되는 세금으로 저희가 추가로 받는 금액이 아닌 점 양해 부탁드립니다. 부가세 포함 최종 금액 안내드리겠습니다. 감사합니다!"
    : "현금영수증 미신청 확인했습니다. 안내드린 견적은 공급가액 기준이며, 부가세는 법적으로 부과되는 세금으로 저희가 추가로 받는 금액이 아닌 점 양해 부탁드립니다. 최종 금액 안내드리겠습니다. 현금영수증은 자진발급 처리됩니다. 감사합니다!";

  function getShareText() {
    const pm = paymentMethod === "transfer" ? "계좌이체" : paymentMethod === "cash" ? "현금결제" : "카드결제";
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const memberDisplay = memberBranch ? `${memberBranch} 관리점 ${memberName}` : memberName;

    const lines: string[] = [];
    lines.push("🏠 새집느낌 정산서");
    lines.push("──────────────────");
    lines.push(`고객명: ${customerName || "-"}님`);
    lines.push(`연락처: ${customerPhone || "-"}`);
    lines.push(`결제방식: ${pm}`);
    lines.push(`현금영수증: ${cashReceipt ? "신청" : "미신청"}`);
    lines.push("");
    lines.push("📋 비용 상세");
    lines.push(`공급가액: ${formatWon(q)}`);
    lines.push(`예약금(선납완료): -${formatWon(d)}`);
    lines.push(`잔금: ${formatWon(balance)}`);
    if (e > 0) lines.push(`현장 추가금: +${formatWon(e)}`);
    if (cashReceipt) lines.push(`부가세(10%): +${formatWon(vatTotal)}`);
    lines.push("");
    lines.push(`💰 최종 결제 금액: ${formatWon(total)}`);
    lines.push(cashReceipt ? "※ 부가세 포함" : "※ 부가세 미포함 (공급가액)");
    lines.push("");
    lines.push(receiptMsg);
    lines.push("");
    if (accountNumber && bankName) lines.push(`🏦 ${bankName} ${accountNumber}`);
    if (memberDisplay) lines.push(`${memberDisplay} 관리사`);
    lines.push("");
    lines.push("감사합니다! 가족분들과 항상 건강하시고 행복한 일들만 가득하세요!!");
    lines.push("");
    lines.push("문제있으시면 관리점 대표인 저에게 편하게 연락 부탁드립니다!! 😊");
    lines.push(`${dateStr} · 새집느낌`);
    return lines.join("\n");
  }

  async function handleComplete() {
    // 낙관적 업데이트: 모달 먼저 표시
    if (s) setS({ ...s, status: "completed" as const });
    setShowShareModal(true);
    onCompleted?.();
    // API 병렬 처리 (백그라운드)
    Promise.all([
      saveSettlement(scheduleId, {
        quote: q, deposit: d, extraCharge: e,
        paymentMethod, cashReceipt, customerName, customerPhone, note, status: "completed",
        depositorName, bankName, accountNumber,
      } as Record<string, unknown>),
      apiUpdateSchedule(scheduleId, { status: "completed" } as Partial<import("@/types").Schedule>),
    ]).catch(() => {});
  }

  function handleSendSMS() {
    const text = getShareText();
    const phone = customerPhone.replace(/[^0-9]/g, "");
    const encoded = encodeURIComponent(text);
    const isIOS = /iPhone|iPad/i.test(navigator.userAgent);
    window.location.href = phone
      ? `sms:${phone}${isIOS ? "&" : "?"}body=${encoded}`
      : `sms:${isIOS ? "&" : "?"}body=${encoded}`;
  }

  async function handleSendKakao() {
    const text = getShareText();
    // 1. 클립보드에 먼저 복사
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    // 2. 카카오톡 앱 열기 시도 (Android intent → kakao scheme → 공유시트 순서)
    const encoded = encodeURIComponent(text);
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      // Android intent scheme - 카카오톡 앱 직접 호출
      window.location.href = `intent://send?text=${encoded}#Intent;scheme=kakaotalk;package=com.kakao.talk;end`;
      return;
    }
    // iOS 또는 기타 - 네이티브 공유 시트
    if (navigator.share) {
      try { await navigator.share({ title: "새집느낌 정산서", text }); return; } catch { /* 취소 */ }
    }
    // 최종 fallback
    window.location.href = `kakaotalk://send?text=${encoded}`;
  }

  async function handleCopy() {
    const text = getShareText();
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">로딩 중...</div>;

  const isCompleted = s?.status === "completed";

  return (
    <div className="space-y-3 px-4 pt-3 pb-4">
      {isCompleted && (
        <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 text-center font-bold">
          작업 완료됨
        </div>
      )}

      {/* 결제 방식 */}
      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none bg-white" style={{ fontSize: "14px" }}>
        <option value="transfer">계좌이체</option>
        <option value="cash">현금결제</option>
        <option value="card">카드결제</option>
      </select>

      {/* 견적 */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-100">
          <div className="flex items-center px-3 py-2.5">
            <span className="flex-1 text-xs text-gray-600">견적금액 (공급가액)</span>
            <input type="tel" value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="0"
              className="w-24 px-2 py-1.5 border border-gray-200 rounded text-xs text-right outline-none" />
          </div>
          <div className="flex items-center px-3 py-2.5">
            <span className="flex-1 text-xs text-gray-600">예약금 (선납)</span>
            <input type="tel" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0"
              className="w-24 px-2 py-1.5 border border-gray-200 rounded text-xs text-right outline-none" />
          </div>
          <div className="flex items-center px-3 py-2.5">
            <span className="flex-1 text-xs text-gray-600">잔금</span>
            <span className="text-xs font-bold text-blue-700">{formatWon(balance)}</span>
          </div>
          <div className="flex items-center px-3 py-2.5">
            <span className="flex-1 text-xs text-gray-600">현장 추가금</span>
            <input type="tel" value={extraCharge} onChange={(e) => setExtraCharge(e.target.value)} placeholder="0"
              className="w-24 px-2 py-1.5 border border-gray-200 rounded text-xs text-right outline-none" />
          </div>
        </div>
      </div>

      {/* 계좌 정보 (접기/펼치기) */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button onClick={() => setShowBankEdit(!showBankEdit)}
          className="w-full px-3 py-2.5 flex items-center justify-between bg-gray-50 active:bg-gray-100">
          <span className="text-xs font-bold text-gray-600">계좌 정보</span>
          <span className="text-xs text-gray-400">
            {bankName && accountNumber ? `${bankName} ${accountNumber}` : "미설정"}
            {showBankEdit ? " ▲" : " ▼"}
          </span>
        </button>
        {showBankEdit && (
          <div className="divide-y divide-gray-100">
            <div className="flex items-center px-3 py-2.5">
              <span className="w-14 text-xs text-gray-500">입금주</span>
              <input type="text" value={depositorName} onChange={(e) => setDepositorName(e.target.value)} placeholder="입금주"
                className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs outline-none" />
            </div>
            <div className="flex items-center px-3 py-2.5">
              <span className="w-14 text-xs text-gray-500">은행명</span>
              <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="은행명"
                className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs outline-none" />
            </div>
            <div className="flex items-center px-3 py-2.5">
              <span className="w-14 text-xs text-gray-500">계좌번호</span>
              <input type="tel" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="계좌번호"
                className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs outline-none" />
            </div>
            <div className="px-3 py-2">
              <button onClick={saveBankInfo} className="w-full py-2 bg-blue-500 text-white rounded-lg text-xs font-bold active:bg-blue-600">
                계좌 저장
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 현금영수증 */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200">
        <button onClick={() => setCashReceipt(true)}
          className={`flex-1 py-2.5 text-xs font-bold ${cashReceipt ? "bg-blue-700 text-white" : "bg-white text-gray-500"}`}>
          현금영수증 신청
        </button>
        <button onClick={() => setCashReceipt(false)}
          className={`flex-1 py-2.5 text-xs font-bold ${!cashReceipt ? "bg-blue-700 text-white" : "bg-white text-gray-500"}`}>
          미신청
        </button>
      </div>

      {/* 최종 결제 */}
      <div className="rounded-xl p-4 text-center" style={{ background: "linear-gradient(135deg, #0f4c81, #1a6bb5)" }}>
        <div className="text-xs text-white/60 mb-1">최종 결제 금액</div>
        <div className="text-2xl font-extrabold text-white">{formatWon(total)}</div>
        <div className="text-xs text-white/50 mt-1">{cashReceipt ? "부가세 포함" : "부가세 미포함 (공급가액)"}</div>
      </div>

      {/* 작업 완료 버튼 */}
      {!isCompleted ? (
        <button onClick={handleComplete}
          className="w-full py-4 rounded-xl text-base font-bold text-white active:opacity-90"
          style={{ background: "linear-gradient(135deg, #00c473, #00a35e)" }}>
          작업 완료
        </button>
      ) : (
        <button onClick={() => setShowShareModal(true)}
          className="w-full py-4 rounded-xl text-base font-bold text-white active:opacity-90"
          style={{ background: "linear-gradient(135deg, #0f4c81, #1a6bb5)" }}>
          마무리 · 정산서 전송
        </button>
      )}

      {/* 마무리 모달 - 문자/카톡 전송 */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={(e) => { if (e.target === e.currentTarget) setShowShareModal(false); }}>
          <div className="bg-white rounded-t-2xl w-full max-w-md p-5 pb-8 animate-[modalIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-green-700">✅ 작업 완료</h3>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 text-xl">&times;</button>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 max-h-[35vh] overflow-y-auto">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{getShareText()}</pre>
            </div>
            <div className="space-y-2">
              <button onClick={handleSendSMS} className="w-full py-3.5 bg-blue-500 text-white rounded-xl text-sm font-bold active:bg-blue-600 flex items-center justify-center gap-2">
                <span>💬</span> 문자 전송{customerPhone ? ` (${customerPhone})` : ""}
              </button>
              <button onClick={handleSendKakao} className="w-full py-3.5 rounded-xl text-sm font-bold active:opacity-90 flex items-center justify-center gap-2"
                style={{ background: "#FEE500", color: "#3C1E1E" }}>
                <span>💛</span> 카카오톡 전송
              </button>
              <button onClick={handleCopy} className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${copied ? "bg-green-500 text-white" : "bg-gray-200 text-gray-700"}`}>
                <span>📋</span> {copied ? "복사됨!" : "텍스트 복사"}
              </button>
              <button onClick={() => setShowShareModal(false)} className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl text-sm font-bold">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
