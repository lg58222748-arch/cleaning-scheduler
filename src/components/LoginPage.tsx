"use client";

import { useState } from "react";
import { loginApi, registerApi } from "@/lib/api";
import { User } from "@/types";

interface LoginPageProps {
  onLogin: (user: User) => void;
}

// 관리점 선택지 — '기타' 선택 시 직접 입력 input 노출
const BRANCH_OPTIONS = [
  "서울", "인천", "수원", "화성", "동탄", "오산", "안산",
  "천안", "아산", "평택", "대전", "청주",
  "부산", "대구", "울산",
];

type RegistrationType = "office" | "partner";

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registrationType, setRegistrationType] = useState<RegistrationType>("office");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [residentNumber, setResidentNumber] = useState("");
  // businessLicenseFile = DB에 저장될 경로(또는 비어있음). businessLicenseLocal = 실제 업로드용 File.
  const [businessLicenseFile, setBusinessLicenseFile] = useState("");
  const [businessLicenseLocal, setBusinessLicenseLocal] = useState<File | null>(null);
  const [branchSelect, setBranchSelect] = useState("");
  const [branchCustom, setBranchCustom] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Daum 우편번호 팝업 — 한국 주소 표준 (도로명/지번 자동 채움)
  function openAddressSearch() {
    const run = () => {
      const W = window as unknown as { daum?: { Postcode: new (opts: { oncomplete: (data: { roadAddress?: string; jibunAddress?: string; zonecode?: string }) => void }) => { open: () => void } } };
      if (!W.daum?.Postcode) return;
      new W.daum.Postcode({
        oncomplete: (data) => {
          const addr = data.roadAddress || data.jibunAddress || "";
          setAddress(addr);
        },
      }).open();
    };
    const W = window as unknown as { daum?: unknown };
    if (W.daum) { run(); return; }
    // 동적 로드 — 회원가입 안 들어가는 사람은 다운로드 안 함
    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    script.onload = run;
    document.body.appendChild(script);
  }

  async function handleLogin() {
    if (!username.trim()) { setError("아이디를 입력하세요"); return; }
    if (!password) { setError("비밀번호를 입력하세요"); return; }
    setLoading(true); setError("");
    const result = await loginApi(username.trim(), password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    onLogin(result as User);
  }

  async function handleRegister() {
    if (!regUsername.trim()) { setError("아이디를 입력하세요"); return; }
    if (!regPassword) { setError("비밀번호를 입력하세요"); return; }
    if (regPassword !== regPasswordConfirm) { setError("비밀번호가 일치하지 않습니다"); return; }
    if (regPassword.length < 4) { setError("비밀번호는 4자 이상이어야 합니다"); return; }
    const branchValue = branchSelect === "기타" ? branchCustom.trim() : branchSelect;
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("이름, 연락처, 주소는 필수입니다"); return;
    }
    if (!branchValue) {
      setError("관리점을 선택해주세요"); return;
    }
    // 파트너 가입은 사업자등록증 필수
    if (registrationType === "partner" && !businessLicenseLocal && !businessLicenseFile) {
      setError("파트너 가입은 사업자등록증 첨부가 필수입니다");
      return;
    }
    setLoading(true); setError("");
    // 상세주소 합치기 — DB 에는 한 줄로 저장
    const fullAddress = addressDetail.trim()
      ? `${address.trim()} ${addressDetail.trim()}`
      : address.trim();

    // 사업자등록증 업로드 — 첨부된 경우만 Storage 에 올리고 path 반환받기
    let licensePath = businessLicenseFile; // 이미 업로드된 경로가 있으면 재사용
    if (businessLicenseLocal && !licensePath) {
      try {
        const fd = new FormData();
        fd.append("file", businessLicenseLocal);
        const res = await fetch("/api/upload/business-license", { method: "POST", body: fd });
        const j = await res.json();
        if (!res.ok || !j.path) {
          setError(j.message || "사업자등록증 업로드 실패");
          setLoading(false);
          return;
        }
        licensePath = j.path;
        setBusinessLicenseFile(j.path); // 재시도 시 중복 업로드 방지
      } catch (e) {
        console.error("[license upload]", e);
        setError("사업자등록증 업로드 실패. 다시 시도해주세요.");
        setLoading(false);
        return;
      }
    }

    const result = await registerApi({
      username: regUsername.trim(), password: regPassword,
      name: name.trim(), phone: phone.trim(), address: fullAddress,
      residentNumber: residentNumber.trim(), businessLicenseFile: licensePath, branch: branchValue,
    });
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setSuccess("가입 신청이 완료되었습니다. 관리자 승인 후 사용 가능합니다.");
    setLoading(false);
  }

  const inputClass = "w-full px-4 py-3 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 overflow-y-auto" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-[#3a9ad9] px-6 py-5 text-center">
          <h1 className="text-xl font-bold text-white">새집느낌 파트너</h1>
          <p className="text-blue-100 text-sm mt-1">일정 · 검수 · 정산 · 영업</p>
        </div>

        {/* Tab toggle */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
            className={`flex-1 py-3 text-sm font-medium text-center ${mode === "login" ? "text-blue-500 border-b-2 border-blue-500" : "text-gray-400"}`}
          >
            로그인
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
            className={`flex-1 py-3 text-sm font-medium text-center ${mode === "register" ? "text-blue-500 border-b-2 border-blue-500" : "text-gray-400"}`}
          >
            회원가입
          </button>
        </div>

        <div className="p-6 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">{success}</div>
          )}

          {mode === "login" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">아이디</label>
                <input
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="아이디를 입력하세요"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  name="login-id-field"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                <input
                  type="password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="new-password"
                  name="login-pw-field"
                  className={inputClass}
                />
              </div>
              <button
                onClick={handleLogin} disabled={loading}
                className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium text-sm active:bg-blue-600 disabled:opacity-50"
              >
                {loading ? "로그인 중..." : "로그인"}
              </button>
            </>
          ) : (
            <>
              {/* 가입 유형 — 사무실 / 파트너 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">가입 유형 *</label>
                <div className="flex rounded-xl overflow-hidden border border-gray-300">
                  <button
                    type="button"
                    onClick={() => setRegistrationType("office")}
                    className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                      registrationType === "office"
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-500 active:bg-gray-50"
                    }`}
                  >
                    🏢 사무실
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegistrationType("partner")}
                    className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                      registrationType === "partner"
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-500 active:bg-gray-50"
                    }`}
                  >
                    🤝 파트너
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {registrationType === "office"
                    ? "사무실 직원 · 사업자등록증 선택"
                    : "파트너 청소업체 · 사업자등록증 필수"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">아이디 *</label>
                <input
                  value={regUsername} onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="로그인에 사용할 아이디"
                  autoComplete="off"
                  name="reg-id-field"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 *</label>
                  <input
                    type="password"
                    value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="4자 이상"
                    autoComplete="new-password"
                    name="reg-pw-field"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인 *</label>
                  <input
                    type="password"
                    value={regPasswordConfirm} onChange={(e) => setRegPasswordConfirm(e.target.value)}
                    placeholder="다시 입력"
                    autoComplete="new-password"
                    name="reg-pw-confirm-field"
                    className={inputClass}
                  />
                </div>
              </div>
              {/* 1) 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="실명" className={inputClass} />
              </div>
              {/* 2) 생년월일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">생년월일 (뒤 1자리)</label>
                <input value={residentNumber} onChange={(e) => {
                  let v = e.target.value.replace(/[^0-9]/g, "");
                  if (v.length > 7) v = v.slice(0, 7);
                  if (v.length > 6) v = v.slice(0, 6) + "-" + v.slice(6);
                  setResidentNumber(v);
                }} placeholder="990101-1" maxLength={8} className={inputClass} />
              </div>
              {/* 3) 연락처 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연락처 *</label>
                <input value={phone} onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 11);
                  const formatted = v.length <= 3 ? v : v.length <= 7 ? v.slice(0,3) + "-" + v.slice(3) : v.slice(0,3) + "-" + v.slice(3,7) + "-" + v.slice(7);
                  setPhone(formatted);
                }} placeholder="010-0000-0000" inputMode="tel" className={inputClass} />
              </div>
              {/* 4) 주소 — Daum 우편번호 검색 + 상세 주소 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주소 *</label>
                <button
                  type="button"
                  onClick={openAddressSearch}
                  className={`${inputClass} text-left ${address ? "text-gray-800" : "text-gray-400"} active:bg-gray-50`}
                >
                  {address || "🔍 주소 검색 (탭하세요)"}
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상세 주소</label>
                <input
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                  placeholder="동/호수 등 상세 입력"
                  className={inputClass}
                  disabled={!address}
                />
              </div>
              {/* 5) 관리점 — 드롭다운 + 기타 직접 입력 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">관리점 *</label>
                <select
                  value={branchSelect}
                  onChange={(e) => setBranchSelect(e.target.value)}
                  className={inputClass}
                >
                  <option value="">관리점 선택</option>
                  {BRANCH_OPTIONS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value="기타">기타 (직접 입력)</option>
                </select>
                {branchSelect === "기타" && (
                  <input
                    value={branchCustom}
                    onChange={(e) => setBranchCustom(e.target.value)}
                    placeholder="관리점 지역명을 직접 입력"
                    className={`${inputClass} mt-2`}
                  />
                )}
              </div>
              {/* 6) 사업자등록증 — 파트너는 필수, 사무실은 선택 */}
              <div className={registrationType === "partner" && !businessLicenseLocal ? "p-3 -mx-3 rounded-xl bg-red-50/40 border border-red-100" : ""}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사업자등록증 {registrationType === "partner" ? <span className="text-red-500">*</span> : "(선택)"}
                </label>
                <input
                  type="file" accept="image/*,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setBusinessLicenseLocal(f);
                    setBusinessLicenseFile(""); // 새 파일 → 이전 업로드 경로 무효화
                  }}
                  className="w-full text-sm text-gray-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-600"
                />
                {businessLicenseLocal && (
                  <p className="text-xs text-green-600 mt-1">
                    {businessLicenseLocal.name} ({(businessLicenseLocal.size / 1024).toFixed(0)} KB)
                  </p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">
                  5MB 이하 · 이미지 또는 PDF
                  {registrationType === "partner" && (
                    <span className="text-red-500 ml-1">· 파트너 가입은 필수입니다</span>
                  )}
                </p>
              </div>
              <button
                onClick={handleRegister} disabled={loading}
                className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium text-sm active:bg-blue-600 disabled:opacity-50"
              >
                {loading ? "신청 중..." : "가입 신청"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
