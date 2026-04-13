"use client";

import { useState } from "react";
import { loginApi, registerApi } from "@/lib/api";
import { User } from "@/types";

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [residentNumber, setResidentNumber] = useState("");
  const [businessLicenseFile, setBusinessLicenseFile] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

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
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("이름, 연락처, 주소는 필수입니다"); return;
    }
    setLoading(true); setError("");
    const result = await registerApi({
      username: regUsername.trim(), password: regPassword,
      name: name.trim(), phone: phone.trim(), address: address.trim(),
      residentNumber: residentNumber.trim(), businessLicenseFile,
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-blue-500 px-6 py-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto mb-3 flex items-center justify-center">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">청소팀 일정관리</h1>
          <p className="text-blue-100 text-sm mt-1">새집느낌 관리 시스템</p>
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
            관리사 등록
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
                  className={inputClass}
                />
              </div>
              <button
                onClick={handleLogin} disabled={loading}
                className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium text-sm active:bg-blue-600 disabled:opacity-50"
              >
                {loading ? "로그인 중..." : "로그인"}
              </button>
              <p className="text-xs text-gray-400 text-center">
                관리자 계정: admin / 1234
              </p>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">아이디 *</label>
                <input
                  value={regUsername} onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="로그인에 사용할 아이디"
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
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인 *</label>
                  <input
                    type="password"
                    value={regPasswordConfirm} onChange={(e) => setRegPasswordConfirm(e.target.value)}
                    placeholder="다시 입력"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="실명" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연락처 *</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주소 *</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="활동 지역/주소" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주민등록번호</label>
                <input value={residentNumber} onChange={(e) => setResidentNumber(e.target.value)} placeholder="000000-0000000" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사업자등록증</label>
                <input
                  type="file" accept="image/*,.pdf"
                  onChange={(e) => setBusinessLicenseFile(e.target.files?.[0]?.name || "")}
                  className="w-full text-sm text-gray-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-600"
                />
                {businessLicenseFile && <p className="text-xs text-green-600 mt-1">{businessLicenseFile}</p>}
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
