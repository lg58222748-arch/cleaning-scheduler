import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text) return Response.json({ error: "text required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "no_api_key", message: "ANTHROPIC_API_KEY not set" }, { status: 200 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `다음 텍스트에서 고객 정보를 추출해주세요. 예약 양식과 함께 고객이 답변한 내용이 섞여있을 수 있습니다.

중요 구분:
- "5)고객님 특이사항" 또는 "5)신경쓰고 싶은 곳 및 특이사항" 항목의 내용은 "note" 로 추출 (고객이 요청한 것)
- "11)상담사 특이사항" 또는 "상담사 특이사항" 항목의 내용은 "salesNote" 로 추출 (상담사가 남긴 메모)
- 두 항목을 절대 섞지 말고, 해당 항목이 비어있으면 빈 문자열로 두세요
- 양식 뒤 자유 서술은 note 쪽으로

중요! 양식 뒤에 번호로 답변한 경우 (많이 나오는 케이스):
- 양식에 "1)성함 :", "2)주소 :" 등이 비어있고, 양식 뒤쪽에 "1. 홍길동", "2. 서울시...", "3. 01012345678", "4. 5월1일", "5. 꼼꼼히 청소 부탁" 식으로 답변이 오는 경우가 매우 많습니다.
- 이런 경우 반드시 그 번호별 답변을 각 항목으로 추출하세요:
  · 1. XXX → name
  · 2. XXX → addr
  · 3. XXX → phone
  · 4. XXX → date
  · 5. XXX → note
- 양식의 빈 값("1)성함 :")만 보고 빈 문자열을 반환하지 마세요. 양식 뒤의 번호 답변을 반드시 함께 보세요.

중요! 여러 줄 처리:
- "5)고객님 특이사항 :" 라벨 바로 다음 줄부터 내용이 적혀있는 경우도 있습니다 (콜론 뒤 줄바꿈). 다음 줄들의 내용을 반드시 "note" 에 포함시켜 주세요.
- note/salesNote 는 다음 섹션 라벨(──── 구분선, ► 서비스, 6)서비스, *예약금은 등)을 만나기 전까지 모든 줄을 합쳐서 주세요.
- 콜론(:) 자체만 뽑지 말고 ──── 구분선도 내용이 아닙니다. 내용이 진짜 없으면 빈 문자열("")로 주세요.

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{"name":"성함","phone":"전화번호","addr":"주소","date":"희망날짜","note":"고객 특이사항","salesNote":"상담사 특이사항"}

빈 값은 빈 문자열로 두세요.

텍스트:
${text}`
        }],
      }),
    });

    if (!res.ok) {
      return Response.json({ error: "api_error" }, { status: 200 });
    }

    const data = await res.json();
    const content = data.content?.[0]?.text || "";

    // JSON 추출
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return Response.json({ success: true, ...parsed });
    }

    return Response.json({ error: "parse_failed" }, { status: 200 });
  } catch {
    return Response.json({ error: "fetch_failed" }, { status: 200 });
  }
}
