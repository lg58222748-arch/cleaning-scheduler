// 일정을 등록한 실장 이름 — DB 칸은 따로 없고, 영업탭 '캘린더 저장' 때 제목·본문에 들어가는 실장 이름을 읽음.
// (그래서 예전 일정도 바로 보임)
//   제목: "u실장/미입금/고객"  → 입금확인 뒤 "[오전] U고객/지역/실장 [1/2]/서비스"
//   본문 첫 줄: "원래제목: [오전] U고객/지역/실장 [1/2]/서비스"
// 영업탭을 거치지 않은 일정(달력에 직접 추가·휴무 등)은 빈 문자열.

const slotName = (s: string) => s.match(/\/([^/\n]+?)\s*\[\d+\/\d+\]/)?.[1].trim() || "";

/** 제목만으로 — 배정탭 목록처럼 본문이 없을 때 */
export function registrantFromTitle(title: string): string {
  return slotName(title) || title.match(/^u([^/\n]+)\/미입금\//)?.[1].trim() || "";
}

/** 본문 '원래제목' 먼저 (제목은 나중에 바뀔 수 있음), 없으면 제목 */
export function registrantName(title: string, note?: string): string {
  const firstLine = (note || "").trimStart().split("\n")[0];
  if (/^원래제목\s*[:：]/.test(firstLine)) {
    const fromNote = slotName(firstLine);
    if (fromNote) return fromNote;
  }
  return registrantFromTitle(title);
}
