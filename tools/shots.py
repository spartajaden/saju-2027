"""화면 캡처 스크립트 (Playwright).

  python3 tools/shots.py            # 기본 세트 생성
"""
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = Path("/workspace")
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/workspace/.pw-browsers")
os.environ.setdefault("LD_LIBRARY_PATH", "/workspace/.pw-libs/usr/lib/x86_64-linux-gnu")
os.environ.setdefault("TMPDIR", "/workspace/tmp")
from playwright.sync_api import sync_playwright  # noqa: E402

PORT = 8791
URL = f"http://127.0.0.1:{PORT}/index.html"


def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                           cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    out = WORK / "tmp" / "shots"
    out.mkdir(parents=True, exist_ok=True)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()

            # --- 1) 모바일 홈 ---
            m = browser.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=2,
                                 is_mobile=True, has_touch=True, locale="ko-KR")
            m.goto(URL)
            m.wait_for_timeout(700)
            m.screenshot(path=str(out / "home-mobile.png"))
            m.screenshot(path=str(out / "home-mobile-full.png"), full_page=True)

            # --- 2) 모바일 결과 (잠금 상태) ---
            m.evaluate("""() => window.__saju.submit({name:'최재화', gender:'male', year:1998, month:5, day:8, si:6})""")
            m.wait_for_selector("#view-result.is-active", timeout=15000)
            m.wait_for_timeout(1200)
            m.screenshot(path=str(out / "result-mobile-locked.png"))
            m.screenshot(path=str(out / "result-mobile-locked-full.png"), full_page=True)

            # --- 3) 모바일 결과 (잠금 해제) ---
            m.click("#unlock-btn")
            m.wait_for_timeout(900)
            m.screenshot(path=str(out / "result-mobile-open-full.png"), full_page=True)

            # --- 4) 카드 미리보기 모달 ---
            m.evaluate("window.__saju.openCard(false)")
            m.wait_for_timeout(500)
            m.screenshot(path=str(out / "card-modal.png"))
            m.evaluate("document.getElementById('modal').hidden = true")

            # --- 5) 데스크톱 결과 전체 ---
            d = browser.new_page(viewport={"width": 1180, "height": 1000}, device_scale_factor=1.5, locale="ko-KR")
            d.goto(URL)
            d.wait_for_timeout(500)
            d.screenshot(path=str(out / "home-desktop.png"), full_page=True)
            d.evaluate("""() => window.__saju.submit({name:'최재화', gender:'male', year:1998, month:5, day:8, si:6})""")
            d.wait_for_selector("#view-result.is-active", timeout=15000)
            d.wait_for_timeout(1000)
            d.screenshot(path=str(out / "result-desktop-locked.png"), full_page=True)
            d.click("#unlock-btn")
            d.wait_for_timeout(900)
            d.screenshot(path=str(out / "result-desktop-open.png"), full_page=True)

            browser.close()
    finally:
        srv.terminate()
        srv.wait(timeout=5)

    for f in sorted(out.glob("*.png")):
        print(f.name, f.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
