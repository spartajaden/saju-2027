"""로컬 서버 없이도 돌릴 수 있는 검증 러너 (Playwright + 내장 chromium).

  python3 tests/run_tests.py            # 엔진 검증
  python3 tests/run_tests.py --shots    # + 스크린샷 생성
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/workspace/.pw-browsers")
os.environ.setdefault("LD_LIBRARY_PATH", "/workspace/.pw-libs/usr/lib/x86_64-linux-gnu")
os.environ.setdefault("TMPDIR", "/workspace/tmp")

from playwright.sync_api import sync_playwright  # noqa: E402


def serve(port=8765):
    p = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(0.8)
    return p


def main():
    srv = serve()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 900, "height": 1200})
            page.goto("http://127.0.0.1:8765/tests/calc-test.html")
            page.wait_for_function("window.__RESULTS !== undefined", timeout=60000)
            data = page.evaluate("window.__RESULTS")
            print(f"\n=== 엔진 검증: {data['pass']} / {data['total']} 통과 ===")
            for i, r in enumerate(data["results"], 1):
                markpit = "PASS" if r["ok"] else "FAIL"
                if not r["ok"]:
                    print(f"[{markpit}] {i}. {r['name']}\n       기대={json.dumps(r['expected'], ensure_ascii=False)}"
                          f"\n       실제={json.dumps(r['actual'], ensure_ascii=False)}")
            failures = [r for r in data["results"] if not r["ok"]]
            print(f"실패 {len(failures)}건")
            browser.close()
            return 0 if not failures else 1
    finally:
        srv.terminate()
        srv.wait(timeout=5)


if __name__ == "__main__":
    sys.exit(main())
