import { NextRequest } from "next/server";
import { loginUser, registerUser, getUserByUsername, findUserForLogin } from "@/lib/store";
import { sendPushToRoles } from "@/lib/push";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "login") {
    const user = await loginUser(body.username, body.password);
    if (!user) {
      const existing = await findUserForLogin(body.username);
      if (existing && existing.password !== body.password) {
        return Response.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
      }
      if (existing && existing.status === "pending") {
        return Response.json({ error: "승인 대기 중입니다. 관리자 승인 후 사용 가능합니다.", status: "pending" }, { status: 403 });
      }
      if (existing && existing.status === "rejected") {
        return Response.json({ error: "가입이 거절되었습니다. 관리자에게 문의하세요.", status: "rejected" }, { status: 403 });
      }
      return Response.json({ error: "등록되지 않은 아이디입니다." }, { status: 401 });
    }
    return Response.json(user);
  }

  if (body.action === "register") {
    try {
      const existing = await getUserByUsername(body.username);
      if (existing) {
        return Response.json({ error: "이미 사용 중인 아이디입니다." }, { status: 400 });
      }
      const user = await registerUser({
        username: body.username,
        password: body.password,
        name: body.name,
        phone: body.phone,
        address: body.address,
        residentNumber: body.residentNumber,
        businessLicenseFile: body.businessLicenseFile || "",
        branch: body.branch || "",
      });
      // 대표 + 일정관리자에게 푸시 알림
      sendPushToRoles(["ceo", "scheduler"], "새 가입 신청", `${body.name}님이 가입 신청했습니다. 승인 대기 중입니다.`, "signup").catch(() => {});
      return Response.json(user, { status: 201 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      return Response.json({ error: "회원가입 실패: " + msg }, { status: 500 });
    }
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
