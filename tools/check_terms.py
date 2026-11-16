"""24절기 계산 정확도 측정 (한국천문연구원 발표값과 비교).

발표값 출처: manseryeok.kr 2027년 24절기 표 (KASI 값)
"""
import os, subprocess, sys, time, json, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/workspace/.pw-browsers")
os.environ.setdefault("LD_LIBRARY_PATH", "/workspace/.pw-libs/usr/lib/x86_64-linux-gnu")
os.environ.setdefault("TMPDIR", "/workspace/tmp")
from playwright.sync_api import sync_playwright

# 발표값 (KASI, KST)
PUBLISHED_2027 = {
    "소한": "2027-01-05 23:10", "대한": "2027-01-20 16:30",
    "입춘": "2027-02-04 10:46", "우수": "2027-02-19 06:34",
    "경칩": "2027-03-06 04:39", "춘분": "2027-03-21 05:25",
    "청명": "2027-04-05 09:17", "곡우": "2027-04-20 16:17",
    "입하": "2027-05-06 02:25", "소만": "2027-05-21 15:18",
    "망종": "2027-06-06 06:25", "하지": "2027-06-21 23:11",
    "소서": "2027-07-07 16:37", "대서": "2027-07-23 10:04",
    "입추": "2027-08-08 02:26", "처서": "2027-08-23 17:14",
    "백로": "2027-09-08 05:28", "추분": "2027-09-23 15:01",
    "한로": "2027-10-08 21:17", "상강": "2027-10-24 00:33",
    "입동": "2027-11-08 00:39", "소설": "2027-11-22 22:16",
    "대설": "2027-12-07 17:38", "동지": "2027-12-22 11:42",
}
PUBLISHED_1998 = {"입하": "1998-05-06 02:03", "소만": "1998-05-21 15:05"}

srv = subprocess.Popen([sys.executable, "-m", "http.server", "8766", "--bind", "127.0.0.1"],
                       cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page()
        pg.goto("http://127.0.0.1:8766/tests/blank.html")
        rows = pg.evaluate("""() => {
          const out = [];
          for (const y of [1998, 2027]) {
            for (const t of Astro.termsInYear(y)) {
              const k = t.kst;
              out.push([y, t.name, k.y + '-' + String(k.m).padStart(2,'0') + '-' + String(k.d).padStart(2,'0') + ' ' + String(k.h).padStart(2,'0') + ':' + String(k.mi).padStart(2,'0')]);
            }
          }
          return out;
        }""")
        b.close()
finally:
    srv.terminate(); srv.wait(timeout=5)

worst = 0
for y, name, got in rows:
    pub = PUBLISHED_2027.get(name) if y == 2027 else PUBLISHED_1998.get(name)
    if not pub:
        continue
    fmt = "%Y-%m-%d %H:%M"
    diff = (datetime.datetime.strptime(got, fmt) - datetime.datetime.strptime(pub, fmt)).total_seconds() / 60
    worst = max(worst, abs(diff))
    print(f"{y} {name}\t발표 {pub}\t계산 {got}\t차이 {diff:+.0f}분")
print(f"\n최대 오차 {worst:.0f}분")
