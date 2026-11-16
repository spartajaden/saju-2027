"""음양력 변환 데이터 생성 스크립트.

korean_lunar_calendar (한국천문연구원 음양력 데이터 기반)를 정답지로 삼아
브라우저에서 쓸 수 있는 압축 테이블(assets/js/lunar-data.js)을 만든다.

양력 날짜를 하루씩 훑어 '음력 1일'인 날을 모으는 방식이라 윤달 판별이 확실하다.

출력 형식
  window.LUNAR_DATA = {
    "1998": [5, "1998-01-28", 30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30],
    ...
  }
  [윤달번호(없으면 0), 음력 1월 1일의 양력 날짜, 각 달의 일수...]
  달 순서: 1월, 2월, ..., (윤N월), ..., 12월
"""
import json
import datetime
from collections import defaultdict
from korean_lunar_calendar import KoreanLunarCalendar

START_YEAR = 1900
END_YEAR = 2049

cal = KoreanLunarCalendar()

# (음력연, 월, 윤달여부) -> 그 달 1일의 양력 날짜
starts = defaultdict(dict)
day = datetime.date(START_YEAR - 1, 11, 1)
end = datetime.date(END_YEAR + 1, 6, 1)
while day <= end:
    cal.setSolarDate(day.year, day.month, day.day)
    if cal.lunarDay == 1:
        key = (cal.lunarYear, cal.lunarMonth, bool(cal.isIntercalation))
        starts[cal.lunarYear][key] = day
    day += datetime.timedelta(days=1)

table = {}
for y in range(START_YEAR, END_YEAR + 1):
    months = starts[y]
    if not months:
        raise RuntimeError(f"{y}년 음력 데이터 없음")
    ordered = sorted(months.items(), key=lambda kv: kv[1])
    leap_month = 0
    for (ly, m, leap), _ in ordered:
        if leap:
            leap_month = m
    seq = [d for _, d in ordered]
    lengths = [(seq[i + 1] - seq[i]).days for i in range(len(seq) - 1)]
    nxt = starts[y + 1][(y + 1, 1, False)]
    lengths.append((nxt - seq[-1]).days)
    assert len(seq) in (12, 13), (y, len(seq))
    assert all(l in (29, 30) for l in lengths), (y, lengths)
    table[str(y)] = [leap_month, seq[0].isoformat()] + lengths

with open("assets/js/lunar-data.js", "w", encoding="utf-8") as f:
    f.write("// 자동 생성 파일 (tools/gen_lunar_data.py) — 직접 수정하지 마세요.\n")
    f.write("// 데이터 출처: 한국천문연구원 음양력 (korean_lunar_calendar 0.4.0)\n")
    f.write("window.LUNAR_DATA = ")
    json.dump(table, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

print("years:", len(table))
print("1998:", table["1998"])
print("2027:", table["2027"])
print("leap years:", sum(1 for v in table.values() if v[0]))
