import { NextRequest } from "next/server";
import { getMember, updateMember, deleteMember } from "@/lib/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const member = getMember(id);
  if (!member) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(member);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const member = updateMember(id, body);
  if (!member) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(member);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteMember(id);
  if (!deleted) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ success: true });
}
