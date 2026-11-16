"""최종 산출물 스크린샷 → /workspace/downloads/

  saju_2027_home.png        랜딩·입력 화면 (모바일 430x932)
  saju_2027_result.png      2027 리포트 (데스크톱 전체, 잠금 해제 상태)
  saju_2027_paywall.png     결제 유도(잠금) 화면 (모바일)
  saju_2027_card.png        결과 카드 미리보기
  saju_2027_result_v2.png   v2 데스크톱 전체 (히어로·대운·개운 처방 포함)
  saju_2027_mobile_v2.png   v2 모바일 결과 화면
"""
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path("/workspace/downloads")
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/workspace/.pw-browsers")
os.environ.setdefault("LD_LIBRARY_PATH", "/workspace/.pw-libs/usr/lib/x86_64-linux-gnu")
os.environ.setdefault("TMPDIR", "/workspace/tmp")
from playwright.sync_api import sync_playwright  # noqa: E402

PORT = 8794
URL = f"http://127.0.0.1:{PORT}/index.html"
CASE = """() => window.__saju.submit({name:'최재화', gender:'male', year:1998, month:5, day:8, si:6})"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                           cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()

            # 1) 모바일 랜딩/입력
            m = browser.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=2,
                                 is_mobile=True, has_touch=True, locale="ko-KR")
            m.goto(URL)
            m.wait_for_timeout(800)
            m.screenshot(path=str(OUT / "saju_2027_home.png"))

            # 2) 모바일 잠금(페이월) 화면
            m.evaluate(CASE)
            m.wait_for_selector("#view-result.is-active", timeout=15000)
            m.wait_for_timeout(1200)
            m.locator("#lock-zone").scroll_into_view_if_needed()
            m.wait_for_timeout(600)
            m.locator("#lock-zone").screenshot(path=str(OUT / "saju_2027_paywall.png"))
            # 스티키 헤더 자리에 걸린 윗단 몇 px을 잘라 낸다
            from PIL import Image
            pw_img = Image.open(OUT / "saju_2027_paywall.png")
            pw_img.crop((0, 22, pw_img.width, pw_img.height)).save(OUT / "saju_2027_paywall.png")

            # 3) 결과 카드
            m.evaluate("window.__saju.openCard(false)")
            m.wait_for_timeout(600)
            m.screenshot(path=str(OUT / "saju_2027_card.png"))
            m.evaluate("document.getElementById('modal').hidden = true")

            # 4) 데스크톱 결과 (잠금 해제)
            d = browser.new_page(viewport={"width": 1180, "height": 1000}, device_scale_factor=1.5, locale="ko-KR")
            d.goto(URL)
            d.wait_for_timeout(600)
            d.evaluate(CASE)
            d.wait_for_selector("#view-result.is-active", timeout=15000)
            d.wait_for_timeout(900)
            d.click("#unlock-btn")
            d.wait_for_timeout(1000)
            d.screenshot(path=str(OUT / "saju_2027_result.png"), full_page=True)
            d.screenshot(path=str(OUT / "saju_2027_result_v2.png"), full_page=True)

            # 5) v2 모바일 결과 화면 (잠금 해제 상태)
            mv = browser.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True, locale="ko-KR")
            mv.goto(URL)
            mv.wait_for_timeout(600)
            mv.evaluate(CASE)
            mv.wait_for_selector("#view-result.is-active", timeout=15000)
            mv.wait_for_timeout(900)
            mv.click("#unlock-btn")
            mv.wait_for_timeout(1000)
            mv.screenshot(path=str(OUT / "saju_2027_mobile_v2.png"), full_page=True)

            browser.close()
    finally:
        srv.terminate()
        srv.wait(timeout=5)

    for name in ["saju_2027_home.png", "saju_2027_result.png", "saju_2027_paywall.png", "saju_2027_card.png",
                 "saju_2027_result_v2.png", "saju_2027_mobile_v2.png"]:
        p = OUT / name
        print(f"{name}\t{p.stat().st_size // 1024} KB\t{p}")


if __name__ == "__main__":
    main()
