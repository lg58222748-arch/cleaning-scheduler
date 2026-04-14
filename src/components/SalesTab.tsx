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
  const [step, setStep] = useState<1 | 2 | 3>(1);

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
    text += `7)평수 : ${pyeong ? pyeong + "평" : ""}\n`;

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

  const [parsing, setParsing] = useState(false);

  // AI 파싱 - Claude API 우선, 실패시 regex fallback
  async function parseCustomer() {
    setParsing(true);

    // 1차: Claude API 시도
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: customerText }),
      });
      const data = await res.json();
      if (data.success) {
        setParsedName(data.name || "");
        setParsedPhone(data.phone || "");
        setParsedAddr(data.addr || "");
        setParsedWishDate(data.date || "");
        setParsedNote(data.note || "");
        setParsedPyeong(pyeong);
        setSchedules(services.map((s) => ({ service: s.name, date: "", time: "선택" })));
        generateConfirmMsg(data.name, data.addr, data.phone, data.date, data.note);
        setParsing(false);
        return;
      }
    } catch {}

    // 2차: regex fallback
    regexParse();
    setParsing(false);
  }

  function regexParse() {
    const t = customerText;
    const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);

    let name = "", phone = "", addr = "", wish = "", note = "";

    // 1차: 양식 번호로 파싱
    let parsedSvcFromText = "";
    let parsedPyeongFromText = "";
    for (const line of lines) {
      const m1 = line.match(/1\)\s*성함\s*[:：]\s*(.+)/); if (m1 && m1[1].trim()) name = m1[1].trim();
      const m2 = line.match(/2\)\s*주소\s*[:：]\s*(.+)/); if (m2 && m2[1].trim()) addr = m2[1].trim();
      const m3 = line.match(/3\)\s*연락처\s*[:：]\s*(.+)/); if (m3 && m3[1].trim()) phone = m3[1].trim();
      const m4 = line.match(/4\)\s*.*날짜\s*[:：]?\s*(.+)/); if (m4 && m4[1].trim()) wish = m4[1].trim();
      const m5 = line.match(/5\)\s*.*특이사항\s*[:：]?\s*(.+)/); if (m5 && m5[1].trim()) note = m5[1].trim();
      // 서비스/평수도 양식에서 추출
      const m6 = line.match(/6\)\s*서비스\s*종류\s*[:：]\s*(.+)/); if (m6) parsedSvcFromText = m6[1].trim();
      const m7 = line.match(/7\)\s*평수\s*[:：]\s*(.+)/); if (m7) parsedPyeongFromText = m7[1].trim();
    }

    // Step1에서 서비스 선택 안 했으면 양식에서 추출한 서비스로 설정
    if (services.length === 0 && parsedSvcFromText) {
      const svcNames = parsedSvcFromText.split(/[,，\s]+/).filter(Boolean);
      setServices(svcNames.map((n) => {
        // 양식에서 견적/예약금도 추출
        let quote = "", deposit = "";
        let inSvc = false;
        for (const line of lines) {
          if (line.includes(`► ${n}`)) { inSvc = true; continue; }
          if (inSvc && line.includes("►")) break;
          if (inSvc) {
            const qm = line.match(/견적금액.*[:：]\s*([\d,]+)/); if (qm) quote = qm[1].replace(/,/g, "");
            const dm = line.match(/예\s*약\s*금.*[:：]\s*([\d,]+)/); if (dm) deposit = dm[1].replace(/,/g, "");
          }
        }
        return { name: n, quote, deposit };
      }));
    }
    if (!pyeong && parsedPyeongFromText) setPyeong(parsedPyeongFromText);

    // 2차: 양식 뒤 자유형식 답변 추출
    // 마지막 "*" 줄 이후의 내용물을 모두 수집
    const freeLines: string[] = [];
    let lastStarIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith("*")) { lastStarIdx = i; break; }
    }
    if (lastStarIdx >= 0) {
      for (let i = lastStarIdx + 1; i < lines.length; i++) {
        const l = lines[i].trim();
        if (l) freeLines.push(l);
      }
    }

    // 자유형식: 각 줄을 타입별로 분류
    const classified: { type: string; value: string }[] = [];
    for (const line of freeLines) {
      const stripped = line.replace(/[-\s]/g, "");
      // 전화번호 (010으로 시작하는 10-11자리)
      if (/^01[016789]\d{7,8}$/.test(stripped)) {
        classified.push({ type: "phone", value: stripped }); continue;
      }
      // 이름+전화 같은 줄 "김개똥 01058222748"
      const namePhone = line.match(/^([가-힣]{2,4})\s+(01[016789][\d\-]{7,9})$/);
      if (namePhone) {
        classified.push({ type: "name", value: namePhone[1] });
        classified.push({ type: "phone", value: namePhone[2].replace(/-/g, "") }); continue;
      }
      // 날짜 패턴 (4.21, 4/21, 0421, 4월21일, 2026-05-20 등)
      if (/^\d{1,2}[\.\/-]\d{1,2}$/.test(line) || /^\d{4}$/.test(line) || /\d+월\s*\d+일/.test(line) || /^\d{4}-\d{2}-\d{2}$/.test(line)) {
        classified.push({ type: "date", value: line }); continue;
      }
      // 주소 (시/도/구/동/길/로 또는 아파트 이름)
      if (/[시도군구읍면동리로길]/.test(line) || /아파트|오피스텔|빌라|맨션|자이|푸르지오|래미안|힐스|센트럴/.test(line)) {
        classified.push({ type: "addr", value: line }); continue;
      }
      // 한글 2-4자 = 이름
      if (/^[가-힣]{2,4}$/.test(line)) {
        classified.push({ type: "name", value: line }); continue;
      }
      // 나머지 = 특이사항
      classified.push({ type: "note", value: line });
    }

    // 분류 결과 적용
    for (const c of classified) {
      if (c.type === "name" && !name) name = c.value;
      else if (c.type === "phone" && !phone) phone = c.value;
      else if (c.type === "addr" && !addr) addr = c.value;
      else if (c.type === "date" && !wish) wish = c.value;
      else if (c.type === "note" && !note) note = c.value;
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
    msg += `6)서비스 종류 : ${svcList}\n7)평수 : ${(parsedPyeong || pyeong) ? (parsedPyeong || pyeong) + "평" : ""}\n`;

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
  const [confirmed, setConfirmed] = useState(false);
  const [postDone, setPostDone] = useState<number[]>([]);

  const POST_MSGS = [
    { label: "1. 최종 확정 예약 양식", getText: () => confirmMsg },
    { label: "2. 사전 고지사항", getText: () => `안녕하세요 청소로 행복을 드리는 새집느낌입니다.\n입주청소를 처음 받아보는 분들을 위해 드리는 방문 전 사전 진행 약관 및 고지사항입니다.\n\n방문 전 고객님들과 원활한 소통을 위해 드리는 Qna 고지사항이므로 꼭 읽어주세요!\n\nQ.외창 청소는 기본인가요?\nA.입주청소는 기본적으로 내부 공간 케어를 진행하기 때문에 외창은 추가비용이 발생 되는 부분입니다.\n\nQ.빌트인 가전,블라인드 청소도 해주시나요?\nA.입주청소는 비어져 있는 공간을 청소하는 것이기 때문에, 가전과 커튼 블라인드가 있는 상태에서 내부까지 청소하게 되는것은 거주 청소로 분류 됩니다.\n\nQ.추가비용이 나올 상황들은 어떤것들이 있을까요?\nA.저희 업체는 현장 추가비용은 만들지 않으려고 노력하고 있습니다.\n왠만한 적은 범위들은 모두 서비스로 진행되시며\n추가 견적이 나올 수 있는 상황은 다음과 같습니다.\n\n-상담때 확인이 안된 인테리어로 인한 심각한 분진 및 먼지\n-가전 내부청소\n-천장, 몰딩의 심각한 니코틴 오염\n-별도로 설치한 서랍장, 붙박이장\n-3층 이상으로 엘레베이터가 없을경우\n-다량의 심각한 곰팡이/스티커/시트지\n-주차비가 별도로 필요할 경우\n\n감사합니다.` },
    { label: "3. 예약/변경/취소 안내", getText: () => `📌 [입주청소 예약 / 변경 / 취소 안내]\n\n📢 예약금 결제 후 24시간 경과 시 취소하실 경우, 예약금의 50%만 환불됩니다.\n📢 1주 내 변경 / 취소 : 예약 변경 or 취소 예약금 환불 불가\n📢 1주 전 변경 : 1회만 가능. 변경 후 취소는 예약금 환불 불가\n📢 당일 현장 철수 시 청소비용의 20% 위약금으로 발생\n📢 탄성코트와 입주청소 날짜는 최소 7일입니다.\n\n위 내용 꼭 숙지해주시길 부탁드립니다!` },
    { label: "4. 확인 안내", getText: () => `확인했습니다!\n\n해피콜은 보통 1일전 오후 12시~18시 사이 드리고 있으니 참고 부탁드리며,\n방문에 필요한 집 비밀번호, 임시 방문증 등은 1일 전 해피콜 드린 관리사님께 전달주시면 감사드리겠습니다.\n\n그럼 1일 전날 해피콜 연락 드리고 방문드리겠습니다.\n\n믿고 맡겨주신만큼 최선을 다해서 꼼꼼하게 작업해드리겠습니다^^` },
    { label: "5. 인터넷 할인 안내", getText: () => `아참 그리구요 이번에 이사하실때 인터넷도 알아보고 계시다면 1644-0199로 연락주시면\n\n저희 새집느낌 인터넷 센터 통해서 48만원 지원금도 받고 청소 비용도 10~20만원 할인받을 수 있으셔서 참고하시면 좋으실거 같으세용\n\n참고해보세요 고객님^^\n오늘도 좋은 하루되세요!` },
  ];

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
    setConfirmed(true);
    setPostDone([]);
    onCreated();
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      {/* 탭 */}
      <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
        <button onClick={() => setStep(1)} className={`flex-1 py-2.5 text-xs font-bold text-center ${step === 1 ? "text-green-700 border-b-2 border-green-700 bg-green-50" : "text-gray-400"}`}>
          양식 발송
        </button>
        <button onClick={() => setStep(2)} className={`flex-1 py-2.5 text-xs font-bold text-center ${step === 2 ? "text-green-700 border-b-2 border-green-700 bg-green-50" : "text-gray-400"}`}>
          예약 확정
        </button>
        <button onClick={() => setStep(3)} className={`flex-1 py-2.5 text-xs font-bold text-center ${step === 3 ? "text-green-700 border-b-2 border-green-700 bg-green-50" : "text-gray-400"}`}>
          안내 양식
        </button>
      </div>

      {/* ===== STEP 1 ===== */}
      {step === 1 && (
        <div className="p-4 flex flex-col md:flex-row md:gap-6">
        <div className="space-y-4 md:flex-1">
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
                    <span className="w-5 h-5 bg-green-700 text-white rounded-full text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-xs font-medium flex-1">{s.name}</span>
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
                <label className="text-xs text-gray-400 mb-0.5 block">평수</label>
                <input value={pyeong} onChange={(e) => setPyeong(e.target.value)} placeholder="예) 34평" type="tel"
                  style={{ fontSize: "12px" }} className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-green-500" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-0.5 block">타입</label>
                <select value={buildType} onChange={(e) => setBuildType(e.target.value)}
                  style={{ fontSize: "12px" }} className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none bg-white focus:border-green-500">
                  <option value="선택">선택</option>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* 서비스별 견적 */}
            {services.map((s, i) => (
              <div key={s.name} className="border border-gray-200 rounded-xl p-3 mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 bg-green-700 text-white rounded-full text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm font-bold text-green-800">{s.name}</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block">견적금액</label>
                    <input value={s.quote} onChange={(e) => updateService(s.name, "quote", e.target.value)} placeholder="예) 418000원" type="tel"
                      style={{ fontSize: "12px" }} className="w-full px-2 py-1.5 border border-gray-200 rounded outline-none focus:border-green-500" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block">예약금</label>
                    <input value={s.deposit} onChange={(e) => updateService(s.name, "deposit", e.target.value)} placeholder="예) 108000원" type="tel"
                      style={{ fontSize: "12px" }} className="w-full px-2 py-1.5 border border-gray-200 rounded outline-none focus:border-green-500" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block">잔금 (자동)</label>
                    <div className="px-2 py-1.5 bg-gray-50 rounded text-xs text-blue-700 font-bold">
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
              style={{ fontSize: "12px" }} className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-green-500 resize-none" />
          </div>

        </div>

        {/* 오른쪽: 미리보기 (PC) */}
        <div className="space-y-4 mt-4 md:mt-0 md:flex-1 md:sticky md:top-0 md:self-start">
          {/* 캘린더 제목 미리보기 */}
          {services.length > 0 && (
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">캘린더 저장 제목 미리보기</label>
              <div className="flex flex-wrap gap-1.5">
                {services.map((s, i) => (
                  <span key={s.name} className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-lg font-medium">
                    {getCalTitle(s.name, i)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* 미리보기 */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <div className="text-xs font-bold text-green-700 mb-2">고객에게 보낼 양식 미리보기</div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-[250px] md:max-h-none overflow-y-auto">{getFormText()}</pre>
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
        </div>
      )}

      {/* ===== STEP 2 ===== */}
      {step === 2 && (
        <div className="p-4 flex flex-col md:flex-row md:gap-6">
        <div className="space-y-4 md:flex-1">
          {/* 예약 보관함 */}
          <SavedBookings onLoad={(data) => {
            if (data.services) setServices(data.services);
            if (data.parsedName) setParsedName(data.parsedName);
            if (data.parsedPhone) setParsedPhone(data.parsedPhone);
            if (data.parsedAddr) setParsedAddr(data.parsedAddr);
            if (data.parsedWishDate) setParsedWishDate(data.parsedWishDate);
            if (data.confirmMsg) setConfirmMsg(data.confirmMsg);
            if (data.customerText) setCustomerText(data.customerText);
            setParsedPyeong(data.pyeong || pyeong);
          }} onSave={() => ({
            services, parsedName, parsedPhone, parsedAddr, parsedWishDate, confirmMsg, userName, customerText, pyeong,
          })} />

          {/* 고객 답장 붙여넣기 */}
          <div>
            <label className="text-xs font-bold text-green-700 mb-1 block">고객 답장 붙여넣기</label>
            <textarea value={customerText} onChange={(e) => setCustomerText(e.target.value)} rows={20}
              placeholder="고객이 보낸 1~5번 내용을 그대로 복사해서 붙여넣기&#10;&#10;양식 전체 + 고객 답변을 함께 붙여넣으세요"
              style={{ fontSize: "12px" }} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-green-500 resize-y min-h-[300px]" />
            <button onClick={parseCustomer} disabled={parsing}
              className="mt-2 w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-70" style={{ background: "#1c1c1e" }}>
              {parsing ? "🔄 AI 파싱 처리중..." : "🤖 AI 자동 파싱"}
            </button>
          </div>

          {/* 파싱 결과 */}
          {parsedName && (
            <div className="flex flex-col md:flex-row md:gap-6">
            <div className="space-y-4 md:flex-1">
              <div className="border border-green-200 rounded-xl p-3 space-y-2">
                <div className="text-xs font-bold text-green-700 mb-1">파싱 결과 확인 · 수정</div>
                <div className="flex gap-2">
                  <div className="flex-1"><label className="text-xs text-gray-400">1) 성함</label><input value={parsedName} onChange={(e) => setParsedName(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded outline-none" style={{ fontSize: "12px" }} /></div>
                  <div className="flex-1"><label className="text-xs text-gray-400">3) 연락처</label><input value={parsedPhone} onChange={(e) => setParsedPhone(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded outline-none" style={{ fontSize: "12px" }} /></div>
                </div>
                <div><label className="text-xs text-gray-400">2) 주소</label><input value={parsedAddr} onChange={(e) => setParsedAddr(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded outline-none" style={{ fontSize: "12px" }} /></div>
                <div className="flex gap-2">
                  <div className="flex-1"><label className="text-xs text-gray-400">4) 청소희망날짜</label><input value={parsedWishDate} onChange={(e) => setParsedWishDate(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded outline-none" style={{ fontSize: "12px" }} /></div>
                  <div className="flex-1"><label className="text-xs text-gray-400">7) 평수</label><input value={parsedPyeong} onChange={(e) => setParsedPyeong(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded outline-none" style={{ fontSize: "12px" }} /></div>
                </div>
                <div>
                  <label className="text-xs text-gray-400">5) 특이사항</label>
                  <textarea value={parsedNote} onChange={(e) => setParsedNote(e.target.value)} rows={2} style={{ fontSize: "12px" }} className="w-full px-2 py-1.5 border border-gray-200 rounded outline-none resize-none" />
                </div>
              </div>

              {/* 서비스별 날짜+시간대 */}
              <div>
                <label className="text-xs font-bold text-green-700 mb-2 block">일정별 날짜 <span className="text-gray-400 font-normal">캘린더에 각각 저장됩니다</span></label>
                {schedules.map((sched, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-3 mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 bg-green-700 text-white rounded-full text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm font-bold text-green-800">{sched.service}</span>
                    </div>
                    <div className="flex gap-2">
                      <input type="date" value={sched.date} onChange={(e) => {
                        const updated = [...schedules]; updated[i] = { ...sched, date: e.target.value }; setSchedules(updated);
                      }} style={{ fontSize: "12px" }} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-green-500" />
                      <select value={sched.time} onChange={(e) => {
                        const updated = [...schedules]; updated[i] = { ...sched, time: e.target.value }; setSchedules(updated);
                      }} style={{ fontSize: "12px" }} className="px-3 py-2 border border-gray-200 rounded-lg outline-none bg-white focus:border-green-500">
                        <option value="선택">시간대</option>
                        {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

            </div>
            {/* 오른쪽: 미리보기 (PC) */}
            <div className="space-y-4 mt-4 md:mt-0 md:flex-1 md:sticky md:top-0 md:self-start">
              {/* 캘린더 제목 */}
              <div>
                <label className="text-xs font-bold text-green-700 mb-1 block">캘린더 저장 제목</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {services.map((s, i) => (
                    <span key={s.name} className="text-xs px-2 py-1 bg-green-700 text-white rounded-lg font-medium">
                      U{parsedName}/{parsedAddr?.split(" ")[0]}/{userName} [{i + 1}/{services.length}]/{s.name}
                    </span>
                  ))}
                </div>
                <input value={calendarNote} onChange={(e) => setCalendarNote(e.target.value)} placeholder="캘린더 제목 특이사항 (선택) 예) 카톡(아이디),영업폰"
                  style={{ fontSize: "12px" }} className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-green-500" />
              </div>

              {/* 확정 메시지 미리보기 */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-green-700">최종 확정 메시지 미리보기</span>
                  <button onClick={() => generateConfirmMsg()} className="text-xs text-green-600 font-bold">↻ 갱신</button>
                </div>
                <textarea value={confirmMsg} onChange={(e) => setConfirmMsg(e.target.value)} rows={10}
                  className="w-full text-xs text-gray-700 font-sans leading-relaxed bg-transparent outline-none resize-y" />
              </div>

              {/* 버튼: 예약 확정 → 5개 복사 → 캘린더 저장 */}
              {!confirmed ? (
                <div className="space-y-2">
                  <button onClick={() => { setConfirmed(true); setPostDone([]); }}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #1a6b3c, #22874c)" }}>
                    예약 확정
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-green-700">고객 전송 (순서대로 📋 복사 → 붙여넣기)</div>

                  <div className="text-xs font-bold text-green-700 mb-1">고객 전송 (순서대로 복사 → 붙여넣기)</div>
                  {POST_MSGS.map((msg, i) => (
                    <div key={i} className={`border rounded-xl p-3 ${postDone.includes(i) ? "border-green-300 bg-green-50" : "border-gray-200"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${postDone.includes(i) ? "text-green-600" : "text-green-800"}`}>
                          {postDone.includes(i) ? "✅ " : ""}{msg.label}
                        </span>
                        <button onClick={() => {
                          handleCopy(msg.getText(), `post${i}`);
                          if (!postDone.includes(i)) setPostDone((p) => [...p, i]);
                        }} className="px-3 py-1 bg-green-700 text-white rounded-lg text-xs font-bold active:bg-green-800">
                          {copied === `post${i}` ? "✅" : "📋 복사"}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* 6. 캘린더 저장 - 5개 모두 복사 후 활성화 */}
                  <div className={`border rounded-xl p-3 ${postDone.length >= 5 ? "border-blue-300 bg-blue-50" : "border-gray-200 opacity-50"}`}>
                    <button onClick={handleConfirm} disabled={saving || postDone.length < 5}
                      className="w-full py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #0f4c81, #1a6bb5)" }}>
                      {saving ? "저장 중..." : `6. 📅 캘린더 저장 (${schedules.length}건)`}
                    </button>
                    {postDone.length < 5 && <p className="text-xs text-gray-400 text-center mt-1">위 5개 항목을 모두 복사해야 저장이 활성화됩니다</p>}
                  </div>

                  {postDone.length >= 5 && saving === false && (
                    <div className="text-center text-xs text-green-600 font-bold py-2">
                      🎉 모든 전송 완료!
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>
          )}
        </div>
        </div>
      )}

      {/* ===== STEP 3 · 안내 양식 ===== */}
      {step === 3 && (
        <div className="p-4 space-y-3">
          {/* 안내 양식 모음 */}
          <div className="text-xs font-bold text-green-700 mb-2">📋 안내 양식 모음</div>
          {TEMPLATES.map((tpl, i) => (
            <TemplateCard key={i} title={tpl.title} content={tpl.content} onCopy={(text) => handleCopy(text, `tpl${i}`)} copied={copied === `tpl${i}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ===== 안내 양식 데이터 =====
const TEMPLATES = [
  { title: "📢 사전 고지사항 (QnA)", content: `안녕하세요 청소로 행복을 드리는 새집느낌입니다.\n입주청소를 처음 받아보는 분들을 위해 드리는 방문 전 사전 진행 약관 및 고지사항입니다.\n\nQ.외창 청소는 기본인가요?\nA.입주청소는 기본적으로 내부 공간 케어를 진행하기 때문에 외창은 추가비용이 발생 되는 부분입니다.\n\nQ.빌트인 가전,블라인드 청소도 해주시나요?\nA.가전과 커튼 블라인드가 있는 상태에서 내부까지 청소하게 되는것은 거주 청소로 분류 됩니다.\n\nQ.입주청소에 곰팡이도 포함되나요?\nA.곰팡이 같은 특수 오염은 추가 비용에 의한 서비스 사항으로 분류됩니다.\n\nQ.추가비용이 나올 상황들은?\nA.-심각한 분진 및 먼지\n-가전 내부청소\n-심각한 니코틴 오염\n-별도 설치한 서랍장, 붙박이장\n-3층 이상 엘레베이터 없을 경우\n-다량의 곰팡이/스티커/시트지\n-주차비 필요 시\n\n감사합니다.` },
  { title: "📌 예약/변경/취소 안내", content: `📌 [입주청소 예약 / 변경 / 취소 안내]\n\n📢 예약금 결제 후 24시간 경과 시 취소 → 예약금 50%만 환불\n📢 1주 내 변경/취소 → 예약금 환불 불가\n📢 1주 전 변경 → 1회만 가능, 변경 후 취소는 환불 불가\n📢 당일 현장 철수 시 → 청소비용 20% 위약금\n📢 탄성코트+입주청소 날짜는 최소 7일\n\n위 내용 꼭 숙지해주시길 부탁드립니다!` },
  { title: "✅ 확인 안내 (해피콜)", content: `확인했습니다!\n\n해피콜은 보통 1일전 오후 12시~18시 사이 드리고 있으니 참고 부탁드리며,\n방문에 필요한 집 비밀번호, 임시 방문증 등은 1일 전 해피콜 드린 관리사님께 전달주시면 감사드리겠습니다.\n\n그럼 1일 전날 해피콜 연락 드리고 방문드리겠습니다.\n\n믿고 맡겨주신만큼 최선을 다해서 꼼꼼하게 작업해드리겠습니다^^` },
  { title: "📶 인터넷 할인 안내", content: `아참 그리구요 이번에 이사하실때 인터넷도 알아보고 계시다면 1644-0199로 연락주시면\n\n저희 새집느낌 인터넷 센터 통해서 48만원 지원금도 받고 청소 비용도 10~20만원 할인받을 수 있으셔서 참고하시면 좋으실거 같으세용\n\n참고해보세요 고객님^^\n오늘도 좋은 하루되세요!` },
  { title: "🔧 AS 고지사항", content: `[AS 관련 안내]\n\n작업 완료 후 현장에서 바로 검수를 진행해 주시기 바랍니다.\n현장 철수 이후 발생하는 오염이나 하자는 AS 대상에 포함되지 않을 수 있습니다.\n\n작업 당일 검수 시 발견된 미흡한 부분은 즉시 보완 작업 진행해 드립니다.\n\nAS 접수: 작업 완료 후 3일 이내\n- 사진 촬영 후 담당자에게 전달\n- 확인 후 일정 조율하여 재방문\n\n감사합니다.` },
  { title: "💰 추가비용 안내", content: `[추가비용 안내]\n\n다음 항목은 기본 청소에 포함되지 않아 추가 비용이 발생할 수 있습니다:\n\n- 외부 유리창 청소\n- 에어컨 완전분해 청소\n- 세탁기 청소\n- 곰팡이 제거\n- 니코틴 제거\n- 스티커/시트지 제거\n- 걸레받이 시공\n- 탄성코트\n- 줄눈시공\n\n상담 시 확인되지 않은 현장 상황에 따라 추가 비용이 발생할 수 있으며,\n작업 전 고객님께 안내 후 진행됩니다.\n\n감사합니다.` },
  { title: "📅 일정 변경 양식", content: `[일정 변경 요청]\n\n기존 예약일: \n변경 희망일: \n변경 사유: \n\n※ 1주 전 변경: 1회만 가능\n※ 변경 후 취소 시 예약금 환불 불가\n※ 1주 이내 변경은 예약금 환불 불가` },
  { title: "❌ 일정 취소 양식", content: `[일정 취소 요청]\n\n예약일: \n취소 사유: \n\n※ 예약금 결제 후 24시간 경과 → 50%만 환불\n※ 1주 이내 취소 → 예약금 환불 불가\n※ 당일 취소/철수 → 청소비용 20% 위약금` },
];

// ===== 안내 양식 카드 =====
function TemplateCard({ title, content, onCopy, copied }: { title: string; content: string; onCopy: (text: string) => void; copied: boolean }) {
  const [open, setOpen] = useState(false);
  const [editText, setEditText] = useState(content);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => { setOpen(!open); setEditText(content); }} className="w-full px-3 py-2.5 flex items-center justify-between active:bg-gray-50">
        <span className="text-sm font-medium text-gray-800">{title}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-gray-100">
          <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={8}
            className="w-full mt-2 text-xs text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-2 outline-none resize-y" />
          <button onClick={() => onCopy(editText)} className="mt-2 w-full py-2 bg-green-700 text-white rounded-lg text-xs font-bold active:bg-green-800">
            {copied ? "✅ 복사됨!" : "📋 복사"}
          </button>
        </div>
      )}
    </div>
  );
}

// ===== 예약 보관함 =====
interface BookingData {
  services: ServiceEntry[];
  parsedName: string;
  parsedPhone: string;
  parsedAddr: string;
  parsedWishDate?: string;
  confirmMsg: string;
  userName: string;
  customerText?: string;
  pyeong?: string;
  savedAt: string;
}

function SavedBookings({ onLoad, onSave }: {
  onLoad: (data: BookingData) => void;
  onSave: () => Omit<BookingData, "savedAt">;
}) {
  const [items, setItems] = useState<BookingData[]>([]);
  const [showList, setShowList] = useState(false);

  function loadItems() {
    try {
      const saved = localStorage.getItem("savedBookings");
      if (saved) setItems(JSON.parse(saved));
    } catch {}
  }

  function saveCurrentBooking() {
    const currentData = onSave();
    if (!currentData.parsedName && !currentData.confirmMsg) {
      alert("저장할 예약 내용이 없습니다. 파싱 후 저장해주세요.");
      return;
    }
    const newItem: BookingData = { ...currentData, savedAt: new Date().toISOString() };
    loadItems();
    const updated = [newItem, ...items].slice(0, 50);
    setItems(updated);
    localStorage.setItem("savedBookings", JSON.stringify(updated));
    alert("임시 저장 완료!");
  }

  function deleteItem(idx: number) {
    const updated = items.filter((_, i) => i !== idx);
    setItems(updated);
    localStorage.setItem("savedBookings", JSON.stringify(updated));
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <button onClick={saveCurrentBooking} className="flex-1 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold active:bg-blue-100">
          💾 현재 예약 저장
        </button>
        <button onClick={() => { setShowList(!showList); if (!showList) loadItems(); }} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold active:bg-gray-200">
          📂 보관함 ({items.length || "불러오기"})
        </button>
      </div>

      {showList && (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-4 text-center text-xs text-gray-400">저장된 예약이 없습니다</div>
          ) : items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onLoad(item)}>
                <div className="text-sm font-medium text-gray-800 truncate">{item.parsedName || "이름없음"} · {item.parsedAddr || "주소없음"}</div>
                <div className="text-xs text-gray-400">{item.services?.map((s) => s.name).join(", ")} · {new Date(item.savedAt).toLocaleDateString("ko")}</div>
              </div>
              <button onClick={() => deleteItem(i)} className="text-red-400 text-xs shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
