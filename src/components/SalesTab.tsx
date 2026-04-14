"use client";

import { useState } from "react";
import { addUnassignedSchedule } from "@/lib/api";

interface SalesTabProps {
  userName: string;
  onCreated: () => void;
}

const ALL_SERVICES = ["입주청소", "거주청소", "인테리어청소", "사이청소", "새집증후군 시공", "줄눈시공", "탄성코트", "에어컨청소(완전분해)"];
const TIME_SLOTS = ["오전", "오후", "시무", "사이"];
const TYPES = ["확장형", "비확장형", "부분비확장형"];

interface ServiceEntry {
  name: string;
  quote: string;
  deposit: string;
}

interface ParsedSchedule {
  service: string;
  date: string;
  time: string;
}

export default function SalesTab({ userName, onCreated }: SalesTabProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [pyeong, setPyeong] = useState("");
  const [buildType, setBuildType] = useState("선택");
  const [salesNote, setSalesNote] = useState("");
  const [copied, setCopied] = useState("");

  // Step 2
  const [customerText, setCustomerText] = useState("");
  const [parsedName, setParsedName] = useState("");
  const [parsedPhone, setParsedPhone] = useState("");
  const [parsedAddr, setParsedAddr] = useState("");
  const [parsedWishDate, setParsedWishDate] = useState("");
  const [parsedPyeong, setParsedPyeong] = useState("");
  const [parsedNote, setParsedNote] = useState("");
  const [parsedQuote, setParsedQuote] = useState("");
  const [parsedDeposit, setParsedDeposit] = useState("");
  const [parsedBalance, setParsedBalance] = useState("");
  const [parsedSalesNote, setParsedSalesNote] = useState("");
  const [calendarNote, setCalendarNote] = useState("");
  const [schedules, setSchedules] = useState<ParsedSchedule[]>([]);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // 서비스 토글 (복수 선택)
  function toggleService(name: string) {
    setServices((prev) => {
      const exists = prev.find((s) => s.name === name);
      if (exists) return prev.filter((s) => s.name !== name);
      return [...prev, { name, quote: "", deposit: "" }];
    });
  }

  function removeService(name: string) {
    setServices((prev) => prev.filter((s) => s.name !== name));
  }

  function updateService(name: string, field: "quote" | "deposit", value: string) {
    setServices((prev) => prev.map((s) => s.name === name ? { ...s, [field]: value } : s));
  }

  function getBalance(s: ServiceEntry) {
    return (parseInt(s.quote) || 0) - (parseInt(s.deposit) || 0);
  }

  // 캘린더 제목 생성
  function getCalTitle(svcName: string, index: number) {
    const total = services.length;
    return `U___/${parsedName || "이름"}/${parsedAddr?.split(" ")[0] || "지역"}/${userName} [${index + 1}/${total}]/${svcName}`;
  }

  // Step 1 양식 텍스트
  function getFormText() {
    const svcList = services.map((s) => s.name).join(", ");
    let text = `안녕하세요 고객님\n예약 양식 전달드립니다^^\n\n`;
    text += `1)성함 :\n2)주소 : (아파트명+동호수)\n3)연락처 :\n4)청소희망날짜:\n  (오전: 7시~9시, 오후: 1시~3시 사이 방문 선택)\n5)고객님 특이사항 :\n\n`;
    text += `──────────────────\n`;
    text += `6)서비스 종류 : ${svcList}\n`;
    text += `7)평수 : ${pyeong ? pyeong : ""}\n`;

    services.forEach((s, i) => {
      text += `► ${s.name}\n`;
      text += `8)견적금액(공급가액) : ${s.quote ? parseInt(s.quote).toLocaleString() + "원" : ""}\n`;
      text += `9)예 약 금 : ${s.deposit ? parseInt(s.deposit).toLocaleString() + "원" : ""}\n`;
      text += `10)잔 금 : ${getBalance(s) > 0 ? getBalance(s).toLocaleString() + "원" : ""}\n`;
    });

    if (salesNote) text += `11)상담사 특이사항 : ${salesNote}\n`;
    text += `\n확인 차원에서 1~5번까지\n체크사항 보내주시면\n예약 빠르게 도와 드리겠습니다.\n감사합니다.\n`;
    text += `\n*예약금은 본사 확정 비용, 잔금과 세금 증빙은 당일 관리점에서 작업 마무리 후 처리됩니다.\n`;
    text += `*최종 정산은 현장 작업 완료 후 공급가액과 부가세를 구분하여 안내드립니다.`;
    return text;
  }

  // 예약금 안내 텍스트
  function getDepositText() {
    const totalDeposit = services.reduce((sum, s) => sum + (parseInt(s.deposit) || 0), 0);
    return `예약금 안내드립니다.\n\n💳 입금 계좌\n하나은행 12345678901\n예금주: 새집느낌\n\n예약금: ${totalDeposit.toLocaleString()}원\n\n입금 확인 후 예약 확정 안내드리겠습니다.\n감사합니다!`;
  }

  // AI 파싱
  function parseCustomer() {
    const t = customerText;
    const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);

    // 간단한 파싱
    let name = "", phone = "", addr = "", wish = "", note = "";
    for (const line of lines) {
      const clean = line.replace(/^\d+\)?\s*/, "");
      if (/성함|이름/i.test(line)) name = clean.replace(/성함\s*[:：]?\s*/i, "").replace(/이름\s*[:：]?\s*/i, "").trim();
      else if (/주소/i.test(line)) addr = clean.replace(/주소\s*[:：]?\s*/i, "").trim();
      else if (/연락처|전화|핸드폰/i.test(line)) phone = clean.replace(/연락처\s*[:：]?\s*/i, "").replace(/전화\s*[:：]?\s*/i, "").trim();
      else if (/날짜|희망/i.test(line)) wish = clean.replace(/.*날짜\s*[:：]?\s*/i, "").trim();
      else if (/특이사항|신경/i.test(line)) note = clean.replace(/.*특이사항\s*[:：]?\s*/i, "").replace(/.*신경\s*[:：]?\s*/i, "").trim();
    }

    // 이름/전화만 있는 간단 입력
    if (!name && !phone) {
      const shortLines = lines.filter((l) => !l.includes("예약") && !l.includes("확인"));
      if (shortLines.length >= 1) name = shortLines[0];
      if (shortLines.length >= 2 && /\d/.test(shortLines[1])) addr = shortLines[1];
      if (shortLines.length >= 3 && /\d{3}/.test(shortLines[2])) phone = shortLines[2];
    }

    setParsedName(name);
    setParsedPhone(phone);
    setParsedAddr(addr);
    setParsedWishDate(wish);
    setParsedNote(note);
    setParsedPyeong(pyeong);

    // 서비스별 일정
    setSchedules(services.map((s) => ({ service: s.name, date: "", time: "선택" })));

    // 확정 메시지 생성
    generateConfirmMsg(name, addr, phone, wish, note);
  }

  function generateConfirmMsg(name?: string, addr?: string, phone?: string, wish?: string, note?: string) {
    const n = name || parsedName;
    const svcList = services.map((s) => s.name).join(", ");
    let msg = `안녕하세요 ${n}님 😊\n예약이 확정되었습니다!\n\n`;
    msg += `1)성함 : ${n}\n2)주소 : ${addr || parsedAddr}\n3)연락처 : ${phone || parsedPhone}\n`;
    msg += `4)청소희망날짜 : ${wish || parsedWishDate}\n`;
    msg += `5)고객님 특이사항 : ${note || parsedNote}\n\n`;
    msg += `──────────────────\n`;
    msg += `6)서비스 종류 : ${svcList}\n7)평수 : ${parsedPyeong || pyeong}\n`;

    services.forEach((s) => {
      msg += `► ${s.name}\n`;
      msg += `8)견적금액(공급가액) : ${s.quote ? parseInt(s.quote).toLocaleString() + "원" : ""}\n`;
      msg += `9)예 약 금 : ${s.deposit ? parseInt(s.deposit).toLocaleString() + "원" : ""}\n`;
      msg += `10)잔 금 : ${getBalance(s) > 0 ? getBalance(s).toLocaleString() + "원" : ""}\n`;
    });

    if (salesNote) msg += `11)상담사 특이사항 : ${salesNote}\n`;
    msg += `\n*예약금은 본사 확정 비용, 잔금과 세금 증빙은 당일 관리점에서 작업 마무리 후 처리됩니다.\n`;
    msg += `*최종 정산은 현장 작업 완료 후 공급가액과 부가세를 구분하여 안내드립니다.`;
    setConfirmMsg(msg);
  }

  async function handleCopy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(label); setTimeout(() => setCopied(""), 1500);
  }

  // 예약 확정 → 배정탭 등록
  async function handleConfirm() {
    setSaving(true);
    for (let i = 0; i < schedules.length; i++) {
      const sched = schedules[i];
      const svc = services[i];
      if (!svc) continue;
      const title = `U${parsedName}/${parsedAddr?.split(" ").slice(0, 2).join("")}/${userName} [${i + 1}/${schedules.length}]/${svc.name}`;
      const calTitle = sched.time && sched.time !== "선택" ? `[${sched.time}] ${title}` : title;

      await addUnassignedSchedule({
        title: calTitle,
        date: sched.date || new Date().toISOString().slice(0, 10),
        startTime: sched.time === "오전" ? "07:00" : sched.time === "오후" ? "13:00" : "09:00",
        endTime: sched.time === "오전" ? "12:00" : sched.time === "오후" ? "18:00" : "18:00",
        note: confirmMsg,
      });
    }
    setSaving(false);
    onCreated();
    alert(`${schedules.length}건 배정탭에 등록 완료!`);
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

      {/* ===== STEP 1 ===== */}
      {step === 1 && (
        <div className="p-4 space-y-4">
          {/* 서비스 선택 (복수) */}
          <div>
            <label className="text-xs font-bold text-green-700 mb-2 block">서비스 종류 (복수 선택 가능)</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SERVICES.map((s) => (
                <button key={s} onClick={() => toggleService(s)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${services.find((x) => x.name === s) ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-600 border-gray-200 active:bg-gray-50"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 서비스 순서 */}
          {services.length > 0 && (
            <div>
              <label className="text-xs font-bold text-gray-500 mb-2 block">서비스 순서</label>
              <div className="space-y-1.5">
                {services.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="w-5 h-5 bg-green-700 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-sm font-medium flex-1">{s.name}</span>
                    <button onClick={() => removeService(s.name)} className="text-red-400 text-sm font-bold">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 견적 정보 */}
          <div>
            <label className="text-xs font-bold text-green-700 mb-2 block">견적 정보</label>
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 mb-0.5 block">평수</label>
                <input value={pyeong} onChange={(e) => setPyeong(e.target.value)} placeholder="예) 34평" type="tel"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-green-500" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 mb-0.5 block">타입</label>
                <select value={buildType} onChange={(e) => setBuildType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white focus:border-green-500">
                  <option value="선택">선택</option>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* 서비스별 견적 */}
            {services.map((s, i) => (
              <div key={s.name} className="border border-gray-200 rounded-xl p-3 mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 bg-green-700 text-white rounded-full text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm font-bold text-green-800">{s.name}</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 block">견적금액</label>
                    <input value={s.quote} onChange={(e) => updateService(s.name, "quote", e.target.value)} placeholder="예) 418000원" type="tel"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-green-500" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 block">예약금</label>
                    <input value={s.deposit} onChange={(e) => updateService(s.name, "deposit", e.target.value)} placeholder="예) 108000원" type="tel"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:border-green-500" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 block">잔금 (자동)</label>
                    <div className="px-2 py-1.5 bg-gray-50 rounded text-sm text-blue-700 font-bold">
                      {getBalance(s) > 0 ? getBalance(s).toLocaleString() : "0"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 상담사 특이사항 */}
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">상담사 특이사항</label>
            <textarea value={salesNote} onChange={(e) => setSalesNote(e.target.value)} rows={2}
              placeholder="예) 외부유리창, 반분해에어컨청소, 세탁기청소, 곰팡이, 니코틴, 스티커, 걸비시공, 에어컨통, 테라스 특이사항을 기재해주세요"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-green-500 resize-none" />
          </div>

          {/* 캘린더 제목 미리보기 */}
          {services.length > 0 && (
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">캘린더 저장 제목 미리보기</label>
              <div className="flex flex-wrap gap-1.5">
                {services.map((s, i) => (
                  <span key={s.name} className="text-[10px] px-2 py-1 bg-green-100 text-green-800 rounded-lg font-medium">
                    {getCalTitle(s.name, i)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 미리보기 */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <div className="text-xs font-bold text-green-700 mb-2">고객에게 보낼 양식 미리보기</div>
            <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-[250px] overflow-y-auto">{getFormText()}</pre>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2">
            <button onClick={() => handleCopy(getFormText(), "form")}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #1a6b3c, #22874c)" }}>
              {copied === "form" ? "✅ 복사됨!" : "1. 📋 양식 복사"}
            </button>
            <button onClick={() => handleCopy(getDepositText(), "dep")}
              className="flex-1 py-3 rounded-xl text-sm font-bold border-2 border-green-700 text-green-700 active:bg-green-50">
              {copied === "dep" ? "✅ 복사됨!" : "2. 💰 예약금 안내"}
            </button>
          </div>

          <button onClick={() => { setStep(2); if (services.length > 0) setSchedules(services.map((s) => ({ service: s.name, date: "", time: "선택" }))); }}
            className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #1a6b3c, #22874c)" }}>
            STEP 2 · 고객 답장 파싱으로 이동 →
          </button>
        </div>
      )}

      {/* ===== STEP 2 ===== */}
      {step === 2 && (
        <div className="p-4 space-y-4">
          {/* 고객 답장 붙여넣기 */}
          <div>
            <label className="text-xs font-bold text-green-700 mb-1 block">고객 답장 붙여넣기</label>
            <textarea value={customerText} onChange={(e) => setCustomerText(e.target.value)} rows={15}
              placeholder="고객이 보낸 1~5번 내용을 그대로 복사해서 붙여넣기"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-green-500 resize-y" />
            <button onClick={parseCustomer}
              className="mt-2 w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: "#1c1c1e" }}>
              AI 자동 파싱
            </button>
          </div>

          {/* 파싱 결과 */}
          {parsedName && (
            <>
              <div className="border border-green-200 rounded-xl p-3 space-y-2">
                <div className="text-xs font-bold text-green-700 mb-1">파싱 결과 확인 · 수정</div>
                <div className="flex gap-2">
                  <div className="flex-1"><label className="text-[10px] text-gray-400">1) 성함</label><input value={parsedName} onChange={(e) => setParsedName(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none" /></div>
                  <div className="flex-1"><label className="text-[10px] text-gray-400">3) 연락처</label><input value={parsedPhone} onChange={(e) => setParsedPhone(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none" /></div>
                </div>
                <div><label className="text-[10px] text-gray-400">2) 주소</label><input value={parsedAddr} onChange={(e) => setParsedAddr(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none" /></div>
                <div className="flex gap-2">
                  <div className="flex-1"><label className="text-[10px] text-gray-400">4) 청소희망날짜</label><input value={parsedWishDate} onChange={(e) => setParsedWishDate(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none" /></div>
                  <div className="flex-1"><label className="text-[10px] text-gray-400">7) 평수</label><input value={parsedPyeong} onChange={(e) => setParsedPyeong(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none" /></div>
                </div>
                <div><label className="text-[10px] text-gray-400">5) 특이사항</label><textarea value={parsedNote} onChange={(e) => setParsedNote(e.target.value)} rows={2} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none resize-none" /></div>
              </div>

              {/* 캘린더 제목 */}
              <div>
                <label className="text-xs font-bold text-green-700 mb-1 block">캘린더 저장 제목</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {services.map((s, i) => (
                    <span key={s.name} className="text-[10px] px-2 py-1 bg-green-700 text-white rounded-lg font-medium">
                      U{parsedName}/{parsedAddr?.split(" ")[0]}/{userName} [{i + 1}/{services.length}]/{s.name}
                    </span>
                  ))}
                </div>
                <input value={calendarNote} onChange={(e) => setCalendarNote(e.target.value)} placeholder="캘린더 제목 특이사항 (선택) 예) 카톡(아이디),영업폰"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-green-500" />
              </div>

              {/* 서비스별 날짜+시간대 */}
              <div>
                <label className="text-xs font-bold text-green-700 mb-2 block">일정별 날짜 <span className="text-gray-400 font-normal">캘린더에 각각 저장됩니다</span></label>
                {schedules.map((sched, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-3 mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 bg-green-700 text-white rounded-full text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm font-bold text-green-800">{sched.service}</span>
                    </div>
                    <div className="flex gap-2">
                      <input type="date" value={sched.date} onChange={(e) => {
                        const updated = [...schedules]; updated[i] = { ...sched, date: e.target.value }; setSchedules(updated);
                      }} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-green-500" />
                      <select value={sched.time} onChange={(e) => {
                        const updated = [...schedules]; updated[i] = { ...sched, time: e.target.value }; setSchedules(updated);
                      }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white focus:border-green-500">
                        <option value="선택">시간대</option>
                        {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* 확정 메시지 미리보기 */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-green-700">최종 확정 메시지 미리보기</span>
                  <button onClick={() => generateConfirmMsg()} className="text-[10px] text-green-600 font-bold">↻ 갱신</button>
                </div>
                <textarea value={confirmMsg} onChange={(e) => setConfirmMsg(e.target.value)} rows={10}
                  className="w-full text-[11px] text-gray-700 font-sans leading-relaxed bg-transparent outline-none resize-y" />
              </div>

              {/* 버튼 */}
              <div className="space-y-2">
                <button onClick={() => handleCopy(confirmMsg, "confirm")}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #1a6b3c, #22874c)" }}>
                  {copied === "confirm" ? "✅ 복사됨!" : "📋 확정 메시지 복사"}
                </button>
                <button onClick={handleConfirm} disabled={saving}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg, #0f4c81, #1a6bb5)" }}>
                  {saving ? "저장 중..." : `📅 예약 확정 (${schedules.length}건 배정탭 등록)`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
