"use client";

import { useState } from "react";
import { addUnassignedSchedule } from "@/lib/api";

interface SalesTabProps {
  userName: string;
  onCreated: () => void;
}

const SERVICES = ["입주청소", "이사청소", "거주청소", "에어컨청소", "곰팡이제거", "줄눈시공", "탄성코트", "인테리어필름"];
const TYPES = ["확장형", "비확장형", "부분비확장형"];

export default function SalesTab({ userName, onCreated }: SalesTabProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: 양식 작성
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [pyeong, setPyeong] = useState("");
  const [buildType, setBuildType] = useState("확장형");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [salesNote, setSalesNote] = useState("");

  // Step 2: 고객 답장 파싱 → 확정
  const [customerText, setCustomerText] = useState("");
  const [parsedName, setParsedName] = useState("");
  const [parsedAddr, setParsedAddr] = useState("");
  const [parsedPhone, setParsedPhone] = useState("");
  const [parsedDate, setParsedDate] = useState("");
  const [parsedTime, setParsedTime] = useState("오전");
  const [parsedNote, setParsedNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");

  function toggleService(s: string) {
    setSelectedServices((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  const balance = (parseInt(quoteAmount) || 0) - (parseInt(depositAmount) || 0);

  // 양식 텍스트 생성
  function getFormText() {
    const svc = selectedServices.join("+") || "서비스";
    return `안녕하세요 고객님 😊\n예약 양식 전달드립니다^^\n\n` +
      `1)성함 :\n2)주소 : (아파트명+동호수)\n3)연락처 :\n4)청소희망날짜 :\n  (오전: 7시~9시, 오후: 1시~3시 사이 방문 선택)\n5)신경쓰고 싶은곳 및 특이사항 :\n\n` +
      `──────────────────\n` +
      `6)평수 : ${pyeong ? pyeong + "평 " : ""}${buildType}${selectedServices.length > 0 ? " " + svc : ""}\n` +
      `7)견적금액(공급가액) : ${quoteAmount ? parseInt(quoteAmount).toLocaleString() + "원" : ""}\n` +
      `8)예 약 금 : ${depositAmount ? parseInt(depositAmount).toLocaleString() + "원" : ""}\n` +
      `9)잔 금 : ${balance > 0 ? balance.toLocaleString() + "원" : ""}\n` +
      (salesNote ? `10)상담사 특이사항 : ${salesNote}\n` : "") +
      `\n*예약금은 본사 확정 비용, 잔금과 세금 증빙은 당일 관리점에서 작업 마무리 후 처리됩니다.\n` +
      `*최종 정산은 현장 작업 완료 후 공급가액과 부가세를 구분하여 안내드립니다.`;
  }

  // 고객 답장 파싱
  function parseCustomerText() {
    const text = customerText;
    const nameMatch = text.match(/성함\s*[:：]?\s*(.+)/);
    const addrMatch = text.match(/주소\s*[:：]?\s*(.+)/);
    const phoneMatch = text.match(/연락처\s*[:：]?\s*([\d\-]+)/);
    const dateMatch = text.match(/날짜\s*[:：]?\s*(.+)/);
    const noteMatch = text.match(/특이사항\s*[:：]?\s*(.+)/);

    if (nameMatch) setParsedName(nameMatch[1].trim());
    if (addrMatch) setParsedAddr(addrMatch[1].trim());
    if (phoneMatch) setParsedPhone(phoneMatch[1].trim());
    if (dateMatch) setParsedDate(dateMatch[1].trim());
    if (noteMatch) setParsedNote(noteMatch[1].trim());
  }

  // 확정 메시지
  function getConfirmText() {
    const svc = selectedServices.join("+") || "서비스";
    return `안녕하세요 ${parsedName || "고객"}님 😊\n예약이 확정되었습니다!\n\n` +
      `1)성함 : ${parsedName}\n2)주소 : ${parsedAddr}\n3)연락처 : ${parsedPhone}\n` +
      `4)청소희망날짜 : ${parsedDate} ${parsedTime}\n  (${parsedTime === "오전" ? "오전: 7시~9시" : parsedTime === "오후" ? "오후: 1시~3시" : parsedTime} 사이 방문)\n` +
      `5)신경쓰고 싶은곳 및 특이사항 : ${parsedNote}\n\n` +
      `──────────────────\n` +
      `6)평수 : ${pyeong ? pyeong + "평 " : ""}${buildType} ${svc}\n` +
      `7)견적금액(공급가액) : ${quoteAmount ? parseInt(quoteAmount).toLocaleString() + "원" : ""}\n` +
      `8)예 약 금 : ${depositAmount ? parseInt(depositAmount).toLocaleString() + "원" : ""}\n` +
      `9)잔 금 : ${balance > 0 ? balance.toLocaleString() + "원" : ""}\n` +
      (salesNote ? `10)상담사 특이사항 : ${salesNote}\n` : "") +
      `\n*예약금은 본사 확정 비용, 잔금과 세금 증빙은 당일 관리점에서 작업 마무리 후 처리됩니다.\n` +
      `*최종 정산은 현장 작업 완료 후 공급가액과 부가세를 구분하여 안내드립니다.`;
  }

  async function handleCopy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  }

  // 배정탭에 등록
  async function handleSaveToSchedule() {
    if (!parsedName && !parsedAddr) return;
    setSaving(true);
    const svc = selectedServices.join("+") || "";
    const title = `U${parsedName}/${parsedAddr.split(" ").slice(0,2).join("")}/${userName}`;
    const calTitle = parsedTime ? `[${parsedTime}] ${title}` : title;

    await addUnassignedSchedule({
      title: calTitle,
      date: parsedDate ? parsedDate.replace(/[년월]/g, "-").replace(/일/g, "").replace(/\s/g, "") : new Date().toISOString().slice(0, 10),
      startTime: parsedTime === "오전" ? "07:00" : parsedTime === "오후" ? "13:00" : "09:00",
      endTime: parsedTime === "오전" ? "12:00" : parsedTime === "오후" ? "18:00" : "18:00",
      note: getConfirmText(),
    });
    setSaving(false);
    onCreated();
    alert("배정탭에 등록 완료!");
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      {/* 탭 */}
      <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
        <button onClick={() => setStep(1)} className={`flex-1 py-3 text-sm font-bold text-center ${step === 1 ? "text-green-700 border-b-2 border-green-700 bg-green-50" : "text-gray-400"}`}>
          STEP 1 · 양식 발송
        </button>
        <button onClick={() => setStep(2)} className={`flex-1 py-3 text-sm font-bold text-center ${step === 2 ? "text-green-700 border-b-2 border-green-700 bg-green-50" : "text-gray-400"}`}>
          STEP 2 · 예약 확정
        </button>
      </div>

      {step === 1 && (
        <div className="p-4 space-y-4">
          {/* 서비스 선택 */}
          <div>
            <label className="text-xs font-bold text-gray-500 mb-2 block">서비스 선택</label>
            <div className="flex flex-wrap gap-2">
              {SERVICES.map((s) => (
                <button key={s} onClick={() => toggleService(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${selectedServices.includes(s) ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-600 border-gray-200"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 평수 + 타입 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 mb-1 block">평수</label>
              <input value={pyeong} onChange={(e) => setPyeong(e.target.value)} placeholder="34" type="tel"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 mb-1 block">타입</label>
              <select value={buildType} onChange={(e) => setBuildType(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400 bg-white">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* 견적 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 mb-1 block">견적금액</label>
              <input value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} placeholder="0" type="tel"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 mb-1 block">예약금</label>
              <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0" type="tel"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>
          {balance > 0 && <div className="text-sm text-blue-600 font-bold">잔금: {balance.toLocaleString()}원</div>}

          {/* 특이사항 */}
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">상담사 특이사항</label>
            <textarea value={salesNote} onChange={(e) => setSalesNote(e.target.value)} rows={2} placeholder="외부유리창, 에어컨 등"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400 resize-none" />
          </div>

          {/* 미리보기 + 복사 */}
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs font-bold text-gray-500 mb-2">미리보기</div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-[200px] overflow-y-auto">{getFormText()}</pre>
          </div>

          <button onClick={() => handleCopy(getFormText(), "form")}
            className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #1a6b3c, #22874c)" }}>
            {copied === "form" ? "✅ 복사됨!" : "📋 1. 양식 복사 (카톡/문자 붙여넣기)"}
          </button>

          <button onClick={() => setStep(2)} className="w-full py-3 bg-gray-100 rounded-xl text-sm font-bold text-gray-700 active:bg-gray-200">
            STEP 2 · 고객 답장 파싱으로 이동 →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="p-4 space-y-4">
          {/* 고객 답장 붙여넣기 */}
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">고객 답장 붙여넣기</label>
            <textarea value={customerText} onChange={(e) => setCustomerText(e.target.value)} rows={5}
              placeholder="고객이 보낸 1~5번 내용을 붙여넣으세요"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400 resize-y" />
            <button onClick={parseCustomerText} className="mt-2 w-full py-2.5 bg-green-100 text-green-700 rounded-lg text-sm font-bold active:bg-green-200">
              🤖 자동 파싱
            </button>
          </div>

          {/* 파싱 결과 */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-500">파싱 결과 (수정 가능)</div>
            <input value={parsedName} onChange={(e) => setParsedName(e.target.value)} placeholder="성함"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
            <input value={parsedAddr} onChange={(e) => setParsedAddr(e.target.value)} placeholder="주소"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
            <input value={parsedPhone} onChange={(e) => setParsedPhone(e.target.value)} placeholder="연락처" type="tel"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
            <div className="flex gap-2">
              <input value={parsedDate} onChange={(e) => setParsedDate(e.target.value)} placeholder="희망날짜 (예: 2026-05-20)"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
              <select value={parsedTime} onChange={(e) => setParsedTime(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white">
                <option value="오전">오전</option>
                <option value="오후">오후</option>
                <option value="시무">시무</option>
                <option value="사이">사이</option>
              </select>
            </div>
            <textarea value={parsedNote} onChange={(e) => setParsedNote(e.target.value)} placeholder="특이사항" rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400 resize-none" />
          </div>

          {/* 확정 메시지 미리보기 */}
          <div className="bg-green-50 rounded-xl p-3 border border-green-200">
            <div className="text-xs font-bold text-green-700 mb-2">확정 메시지</div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-[200px] overflow-y-auto">{getConfirmText()}</pre>
          </div>

          <div className="space-y-2">
            <button onClick={() => handleCopy(getConfirmText(), "confirm")}
              className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #1a6b3c, #22874c)" }}>
              {copied === "confirm" ? "✅ 복사됨!" : "📋 확정 메시지 복사"}
            </button>

            <button onClick={handleSaveToSchedule} disabled={saving}
              className="w-full py-3 bg-blue-500 rounded-xl text-sm font-bold text-white active:bg-blue-600 disabled:opacity-50">
              {saving ? "저장 중..." : "📅 배정탭에 일정 등록"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
