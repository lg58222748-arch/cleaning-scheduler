export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 20px", fontFamily: "sans-serif", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>개인정보처리방침</h1>
      <p><strong>새집느낌 파트너</strong> (이하 "앱")는 사용자의 개인정보를 중요하게 생각하며, 아래와 같이 개인정보를 처리합니다.</p>

      <h2 style={{ fontSize: 18, fontWeight: "bold", marginTop: 30 }}>1. 수집하는 개인정보</h2>
      <p>앱은 서비스 제공을 위해 다음 정보를 수집합니다:</p>
      <ul style={{ paddingLeft: 20 }}>
        <li>이름, 연락처, 주소</li>
        <li>아이디, 비밀번호</li>
        <li>생년월일 (뒤 1자리)</li>
        <li>관리점 정보</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: "bold", marginTop: 30 }}>2. 개인정보 이용 목적</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li>일정 관리 및 배정 서비스 제공</li>
        <li>정산서 발행</li>
        <li>알림 전송</li>
        <li>사용자 인증</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: "bold", marginTop: 30 }}>3. 개인정보 보관 기간</h2>
      <p>회원 탈퇴 시 즉시 삭제됩니다.</p>

      <h2 style={{ fontSize: 18, fontWeight: "bold", marginTop: 30 }}>4. 개인정보 제3자 제공</h2>
      <p>사용자의 동의 없이 제3자에게 제공하지 않습니다.</p>

      <h2 style={{ fontSize: 18, fontWeight: "bold", marginTop: 30 }}>5. 문의</h2>
      <p>개인정보 관련 문의: 주식회사 새집느낌</p>
      <p>이메일: lg58222748@gmail.com</p>

      <p style={{ marginTop: 40, color: "#999", fontSize: 13 }}>시행일: 2026년 4월 16일</p>
    </div>
  );
}
