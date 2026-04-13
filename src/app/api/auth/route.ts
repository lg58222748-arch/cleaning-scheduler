import { NextRequest } from "next/server";
import { loginUser, registerUser, getUserByUsername, findUserForLogin } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "login") {
    const user = loginUser(body.username, body.password);
    if (!user) {
      const existing = findUserForLogin(body.username);
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
    const existing = getUserByUsername(body.username);
    if (existing) {
      return Response.json({ error: "이미 사용 중인 아이디입니다." }, { status: 400 });
    }
    const user = registerUser({
      username: body.username,
      password: body.password,
      name: body.name,
      phone: body.phone,
      address: body.address,
      residentNumber: body.residentNumber,
      businessLicenseFile: body.businessLicenseFile || "",
    });
    return Response.json(user, { status: 201 });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
