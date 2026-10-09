// 달력 표시용 한국 공휴일·대체공휴일 + 손없는날 계산 (외부 통신 없음, 전부 계산)
//
// 음력 표: 한국천문연구원(KASI) 기준 데이터로 만든 음력 연도별 정보 (음력 2019년 ~ 2049년).
//   [음력 1월 1일의 양력 날짜, 달마다 큰달(30일)=1 / 작은달(29일)=0 (윤달 포함 순서대로), 윤달 위치(0=없음)]
// 손없는날: 음력 날짜 끝자리가 9·0 인 날 (9·10·19·20·29·30일)
// 선거일·임시공휴일은 규칙으로 계산되지 않으므로 정부 발표 때마다 SPECIAL_HOLIDAYS 에 추가해야 함.

const LUNAR_YEARS: ReadonlyArray<readonly [number, string, number]> = [
  [20190205, "101010010101", 0],
  [20200125, "1011010010101", 4],
  [20210212, "011010101010", 0],
  [20220201, "101011010101", 0],
  [20230122, "0101010110101", 2],
  [20240210, "010010110110", 0],
  [20250129, "1010010101110", 6],
  [20260217, "101001010111", 0],
  [20270207, "010100100111", 0],
  [20280127, "0110100100110", 5],
  [20290213, "110110010011", 0],
  [20300203, "010110101010", 0],
  [20310123, "1010101101010", 3],
  [20320211, "100101101101", 0],
  [20330131, "0100101011101", 11],
  [20340219, "010010101110", 0],
  [20350208, "101001001101", 0],
  [20360128, "1101001001101", 6],
  [20370215, "110100100101", 0],
  [20380204, "110101010010", 0],
  [20390124, "1101101010100", 5],
  [20400212, "101101101010", 0],
  [20410201, "100101101101", 0],
  [20420122, "0100101011011", 2],
  [20430210, "010010011011", 0],
  [20440130, "1010010010111", 7],
  [20450217, "101001001011", 0],
  [20460206, "101100100101", 0],
  [20470126, "1011010100101", 5],
  [20480214, "011011010100", 0],
  [20490202, "101011011010", 0],
];
const LUNAR_END = 20500123; // 음력 2050년 설 — 이 날부터는 음력 정보 없음

// 규칙으로 계산되지 않는 공휴일 (선거일·임시공휴일). 새로 지정되면 여기에 추가.
const SPECIAL_HOLIDAYS: Record<string, string> = {
  "2024-04-10": "국회의원선거",
  "2024-10-01": "임시공휴일",
  "2025-01-27": "임시공휴일",
  "2025-06-03": "대통령선거",
  "2026-06-03": "지방선거",
  "2028-04-12": "국회의원선거",
};
// 그 이전 해는 대체공휴일 규칙이 달라 표시하지 않음. 음력 표가 끝나는 해 이후도 표시하지 않음(설·추석 계산 불가).
const FIRST_HOLIDAY_YEAR = 2024;
const LAST_HOLIDAY_YEAR = 2049;

export interface LunarDate { year: number; month: number; day: number; leap: boolean }
export interface DayInfo { holiday: string | null; sonEomneun: boolean; lunar: LunarDate | null }

const DAY_MS = 86400000;
const pad = (n: number) => String(n).padStart(2, "0");
const ymdToDn = (ymd: number) => Date.UTC(Math.floor(ymd / 10000), (Math.floor(ymd / 100) % 100) - 1, ymd % 100) / DAY_MS;
const strToDn = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY_MS;
const dnToStr = (n: number) => { const t = new Date(n * DAY_MS); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
const weekday = (n: number) => new Date(n * DAY_MS).getUTCDay();
const monthLen = (bits: string, k: number) => (bits[k] === "1" ? 30 : 29);

const YEAR_START = LUNAR_YEARS.map((r) => ymdToDn(r[0]));
const TABLE_END = ymdToDn(LUNAR_END);

/** 양력 "yyyy-MM-dd" → 음력. 표 범위 밖이면 null */
export function toLunar(dateStr: string): LunarDate | null {
  const n = strToDn(dateStr);
  if (!(n >= YEAR_START[0] && n < TABLE_END)) return null;
  let i = YEAR_START.length - 1;
  while (YEAR_START[i] > n) i--;
  const [ymd, bits, leapMonth] = LUNAR_YEARS[i];
  let offset = n - YEAR_START[i];
  for (let k = 0; k < bits.length; k++) {
    const len = monthLen(bits, k);
    if (offset < len) {
      return {
        year: Math.floor(ymd / 10000),
        month: leapMonth > 0 && k >= leapMonth ? k : k + 1,
        day: offset + 1,
        leap: leapMonth > 0 && k === leapMonth,
      };
    }
    offset -= len;
  }
  return null;
}

// 음력(평달) 연·월·일 → 양력 일련번호
function lunarToDn(year: number, month: number, day: number): number | null {
  const i = LUNAR_YEARS.findIndex((r) => Math.floor(r[0] / 10000) === year);
  if (i < 0) return null;
  const [, bits, leapMonth] = LUNAR_YEARS[i];
  const idx = leapMonth > 0 && month > leapMonth ? month : month - 1;
  let n = YEAR_START[i];
  for (let k = 0; k < idx; k++) n += monthLen(bits, k);
  return n + day - 1;
}

const holidayCache = new Map<number, Map<string, string>>();

/** 해당 양력 연도의 공휴일 { "yyyy-MM-dd": "이름" } (같은 날 여러 개면 "·" 로 이어붙임) */
export function getHolidays(year: number): Map<string, string> {
  const hit = holidayCache.get(year);
  if (hit) return hit;
  const result = new Map<string, string>();
  holidayCache.set(year, result);
  if (year < FIRST_HOLIDAY_YEAR || year > LAST_HOLIDAY_YEAR) return result;

  const names = new Map<number, string[]>();
  const add = (n: number, name: string) => {
    const list = names.get(n);
    if (!list) names.set(n, [name]);
    else if (!list.includes(name)) list.push(name);
  };
  const solar = (m: number, d: number) => Date.UTC(year, m - 1, d) / DAY_MS;

  // 설날·추석 연휴 (전날·당일·다음날)
  const groups: number[][] = [];
  for (const [m, d, name] of [[1, 1, "설날"], [8, 15, "추석"]] as const) {
    const c = lunarToDn(year, m, d);
    if (c == null) continue;
    const g = [c - 1, c, c + 1];
    g.forEach((n) => add(n, name));
    groups.push(g);
  }
  // 하루짜리 공휴일 — sub=true 면 토·일·다른 공휴일과 겹칠 때 대체공휴일 (신정·현충일은 대상 아님)
  const subTargets: number[] = [];
  const fixed: [number, number, string, boolean][] = [
    [1, 1, "신정", false],
    [3, 1, "삼일절", true],
    ...(year >= 2026 ? [[5, 1, "노동절", true] as [number, number, string, boolean]] : []),
    [5, 5, "어린이날", true],
    [6, 6, "현충일", false],
    ...(year >= 2026 ? [[7, 17, "제헌절", true] as [number, number, string, boolean]] : []),
    [8, 15, "광복절", true],
    [10, 3, "개천절", true],
    [10, 9, "한글날", true],
    [12, 25, "성탄절", true],
  ];
  for (const [m, d, name, sub] of fixed) {
    const n = solar(m, d);
    add(n, name);
    if (sub) subTargets.push(n);
  }
  const buddha = lunarToDn(year, 4, 8);
  if (buddha != null) { add(buddha, "부처님오신날"); subTargets.push(buddha); }
  for (const [ds, name] of Object.entries(SPECIAL_HOLIDAYS)) {
    if (ds.startsWith(`${year}-`)) add(strToDn(ds), name);
  }

  // 대체공휴일: 그 날(연휴면 연휴 마지막 날) 다음의 첫 평일. 같은 날 공휴일이 여러 개 겹쳐도 하루만
  // (연휴와 겹치면 연휴 뒤 하루 — 예: 2028 추석·개천절), 대체일끼리 겹치면 그다음 평일로 밀림.
  const overlaps = (n: number) => (names.get(n)?.length ?? 0) >= 2;
  const inGroup = new Set(groups.flat());
  const triggers = new Set<number>();
  for (const n of subTargets) {
    if (inGroup.has(n)) continue;
    const w = weekday(n);
    if (w === 0 || w === 6 || overlaps(n)) triggers.add(n);
  }
  for (const g of groups) {
    if (g.some((n) => weekday(n) === 0 || overlaps(n))) triggers.add(g[2]);
  }
  const isOff = (n: number) => { const w = weekday(n); return w === 0 || w === 6 || names.has(n); };
  for (const t of [...triggers].sort((a, b) => a - b)) {
    let n = t + 1;
    while (isOff(n)) n++;
    add(n, "대체공휴일");
  }

  for (const [n, list] of [...names.entries()].sort((a, b) => a[0] - b[0])) result.set(dnToStr(n), list.join("·"));
  return result;
}

/** 달력 칸 하나에 필요한 정보 (공휴일 이름, 손없는날, 음력) */
export function getDayInfo(dateStr: string): DayInfo {
  const lunar = toLunar(dateStr);
  return {
    holiday: getHolidays(+dateStr.slice(0, 4)).get(dateStr) ?? null,
    sonEomneun: !!lunar && (lunar.day % 10 === 9 || lunar.day % 10 === 0),
    lunar,
  };
}

/** "음력 10.9" / "음력 윤6.9" */
export function lunarLabel(l: LunarDate): string {
  return `음력 ${l.leap ? "윤" : ""}${l.month}.${l.day}`;
}
