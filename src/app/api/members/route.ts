import { NextRequest } from "next/server";
import { getMembers, addMember } from "@/lib/store";

export async function GET() {
  return Response.json(await getMembers());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const member = await addMember({
    name: body.name,
    phone: body.phone || "",
    availableDays: body.availableDays || [1, 2, 3, 4, 5],
    active: true,
  });
  return Response.json(member, { status: 201 });
}
