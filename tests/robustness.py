"""여러 생년월일시로 전체 흐름을 돌려 보는 견고성 점검."""
import os
import subprocess
import sys
import time

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/workspace/.pw-browsers")
os.environ.setdefault("LD_LIBRARY_PATH", "/workspace/.pw-libs/usr/lib/x86_64-linux-gnu")
from playwright.sync_api import sync_playwright  # noqa: E402

CASES = [
    # (설명, 입력)
    ("남 1998-05-08 오시", dict(name="최재화", gender="male", year=1998, month=5, day=8, si=6)),
    ("여 1998-05-08 시모름", dict(name="", gender="female", year=1998, month=5, day=8, si=None)),
    ("음력 1998-04-13", dict(name="음력테스트", gender="male", year=1998, month=4, day=13, si=0, calendar="lunar")),
    ("음력 윤5-05", dict(name="윤달", gender="female", year=1998, month=5, day=5, si=11, calendar="lunar", leap=True)),
    ("입춘 전 2000-02-03", dict(name="입춘전", gender="male", year=2000, month=2, day=3, si=3)),
    ("1950년대", dict(name="1955", gender="female", year=1955, month=12, day=31, si=10)),
    ("2000년대", dict(name="2007", gender="male", year=2007, month=7, day=7, si=5)),
    ("1900년", dict(name="1900", gender="male", year=1900, month=1, day=1, si=0)),
    ("2026년", dict(name="2026", gender="female", year=2026, month=11, day=16, si=7)),
    ("연말 자시", dict(name="자시", gender="male", year=1999, month=12, day=31, si=0)),
]

FAILED = []


def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8793", "--bind", "127.0.0.1"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            pg = b.new_page(viewport={"width": 430, "height": 932})
            errors = []
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.on("console", lambda m: errors.append("console:" + m.text) if m.type == "error" else None)
            pg.goto("http://127.0.0.1:8793/index.html")
            for label, case in CASES:
                errors.clear()
                pg.evaluate("c => window.__saju.submit(c)", case)
                try:
                    pg.wait_for_selector("#view-result.is-active", timeout=8000)
                except Exception:
                    FAILED.append((label, "결과 화면 미전환"))
                    continue
                pg.wait_for_timeout(250)
                info = pg.evaluate("""() => {
                  const t = id => (document.getElementById(id).textContent || '').trim();
                  return {
                    meta: t('r-meta'), pillars: document.querySelectorAll('#pillars .pillar').length,
                    empty: document.querySelectorAll('#pillars .pillar.is-empty').length,
                    kw: document.querySelectorAll('#kw-list .kw').length,
                    months: document.querySelectorAll('#months .month').length,
                    cash: t('r-cashflow').length, peak: t('r-peak').length,
                    seun: t('r-seun').length, half: t('r-half1').length,
                    name: t('r-name'), balance: t('r-balance').length
                  };
                }""")
                # 전체 리포트가 잠금 없이 바로 보여야 한다
                full = pg.evaluate("""() => {
                  const paywall = document.querySelector('.paywall, #lock-zone, #locked-body, .unlocked-badge, #unlock-btn');
                  const card = document.querySelector('.money-card');
                  const cs = card ? getComputedStyle(card) : null;
                  return {
                    lockedUi: !!paywall,
                    blur: cs ? cs.filter : '',
                    money: (document.getElementById('money-score').textContent || '').trim().length,
                    months: document.querySelectorAll('#months .month').length,
                    trial: document.body.innerText.includes('체험')
                  };
                }""")
                opened = not full['lockedUi'] and full['blur'] in ('none', '') and full['money'] > 0 and not full['trial']
                print(f"{label:22s} | {info['meta'][:44]:44s} | 기둥 {info['pillars']} (모름 {info['empty']}) "
                      f"| 키워드 {info['kw']} 월 {info['months']} | 잠금없음 {opened} | 오류 {len(errors)}")
                if info["kw"] != 3 or info["months"] != 12 or not info["cash"] or not info["seun"] or not opened:
                    FAILED.append((label, info, full))
                if errors:
                    FAILED.append((label, errors[:2]))

            # URL 해시 공유: 해시로 직접 열면 계산 없이 결과 화면까지 가야 한다
            errors.clear()
            pg.goto("about:blank")   # 같은 문서의 해시 이동만으로는 새로 열리지 않으므로 완전히 띄운다
            pg.goto("http://127.0.0.1:8793/index.html#b=19980508&g=m&c=s&s=6&n=%EC%B5%9C%EC%9E%AC%ED%99%94")
            try:
                pg.wait_for_selector("#view-result.is-active", timeout=8000)
                pg.wait_for_timeout(400)
                info = pg.evaluate("""() => ({
                  name: document.getElementById('r-name').textContent,
                  hero: (document.getElementById('r-heroline').textContent || '').length,
                  wealth: document.getElementById('g-wealth').textContent,
                  daeun: document.querySelectorAll('#daeun-track .daeun-pill').length,
                  daeunNow: document.querySelectorAll('#daeun-track .daeun-pill.is-now').length,
                  luck: (document.getElementById('r-luck').textContent || '').length,
                  y2027: (document.getElementById('r-year2027').textContent || '').length,
                  months: document.querySelectorAll('#months .month').length,
                  badges: document.querySelectorAll('#months .m-badge').length
                })""")
                print(f"해시 공유 진입 | {info['name']} | 히어로 {info['hero']} 재물 {info['wealth']} "
                      f"| 대운 {info['daeun']} (현재 {info['daeunNow']}) | 처방 {info['luck']} "
                      f"| 조합 {info['y2027']} | 월 {info['months']} 배지 {info['badges']} | 오류 {len(errors)}")
                if not info["hero"] or info["daeun"] != 10 or info["daeunNow"] != 1 \
                        or not info["luck"] or info["months"] != 12 or info["badges"] != 12 or errors:
                    FAILED.append(("해시 공유 진입", info))
            except Exception:
                FAILED.append(("해시 공유 진입", "결과 화면 미전환"))

            b.close()
    finally:
        srv.terminate(); srv.wait(5)

    print("\n실패:", FAILED if FAILED else "없음")
    return 0 if not FAILED else 1


if __name__ == "__main__":
    sys.exit(main())
