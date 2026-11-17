/* ===========================================================================
   방문자 수 카운터 — Abacus (https://abacus.jasoncameron.dev)
   · 첫 방문(세션)에서만 +1, 같은 세션의 새로고침은 현재 값만 읽습니다.
   · 3초 안에 응답이 없거나 요청이 실패하면 카운터를 조용히 숨깁니다.
     (페이지 동작·다른 기능에는 영향 없음, 콘솔 오류도 남기지 않습니다)
   =========================================================================== */
(function () {
  var API = 'https://abacus.jasoncameron.dev';
  var NS = 'spartajaden.github.io';
  var KEY = 'saju-2027-visits';
  var TIMEOUT_MS = 3000;
  var SESSION_KEY = 'saju2027.counted';

  var nodes = [];
  var shown = false;

  function format(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function reveal(value) {
    if (shown || !nodes.length) return;
    if (typeof value !== 'number' || !isFinite(value) || value < 0) return;
    var text = format(Math.floor(value));
    nodes.forEach(function (el) {
      var num = el.querySelector('.visit-num');
      if (num) num.textContent = text;
      el.hidden = false;
    });
    shown = true;
  }

  /* 세션 저장소가 막힌 브라우저(사생활 보호 모드 등)에서는 매 방문을 셉니다. */
  function alreadyCounted() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; }
  }
  function markCounted() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
  }

  function request(path) {
    if (!window.fetch) return Promise.reject(new Error('no fetch'));
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
    function fail(err) { clearTimeout(timer); throw err; }
    return fetch(API + path, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (res.status !== 200) fail(new Error('status ' + res.status));
      return res.json();
    }).then(function (data) {
      var v = data && data.value;
      if (typeof v !== 'number' || !isFinite(v)) fail(new Error('bad payload'));
      clearTimeout(timer);
      return v;
    }, fail);
  }

  function start() {
    nodes = Array.prototype.slice.call(document.querySelectorAll('[data-visit-count]'));
    if (!nodes.length) return;
    /* 오프라인이면 요청 자체를 보내지 않고(불필요한 네트워크 오류 방지) 연결되면 다시 시도합니다. */
    if (navigator.onLine === false) {
      window.addEventListener('online', start, { once: true });
      return;
    }
    var count = !alreadyCounted();
    var path = '/' + (count ? 'hit' : 'get') + '/' + NS + '/' + KEY;
    request(path).then(function (value) {
      if (count) markCounted();
      reveal(value);
    }).catch(function () {
      /* 실패: 카운터는 hidden 상태로 남고, 화면은 그대로 동작합니다. */
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
