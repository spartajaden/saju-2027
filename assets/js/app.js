/* ===========================================================================
   app.js — 화면 조립 · 입력 · 잠금 해제 · 결과 카드
   =========================================================================== */
(function () {
  'use strict';
  var A = window.Astro, S = window.Saju, R = window.Report;

  var SI_OPTIONS = [
    { v: 'unknown', label: '모름', hint: true },
    { v: 0, label: '자시 (23:00~01:00)' },
    { v: 1, label: '축시 (01:00~03:00)' },
    { v: 2, label: '인시 (03:00~05:00)' },
    { v: 3, label: '묘시 (05:00~07:00)' },
    { v: 4, label: '진시 (07:00~09:00)' },
    { v: 5, label: '사시 (09:00~11:00)' },
    { v: 6, label: '오시 (11:00~13:00)' },
    { v: 7, label: '미시 (13:00~15:00)' },
    { v: 8, label: '신시 (15:00~17:00)' },
    { v: 9, label: '유시 (17:00~19:00)' },
    { v: 10, label: '술시 (19:00~21:00)' },
    { v: 11, label: '해시 (21:00~23:00)' }
  ];
  var SI_LABEL = ['자시', '축시', '인시', '묘시', '진시', '사시', '오시', '미시', '신시', '유시', '술시', '해시'];

  var state = { gender: 'male', calendar: 'solar', chart: null, report: null, unlocked: false };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 초기화 ---------- */
  function init() {
    // 연도
    var ySel = $('year');
    for (var y = 2026; y >= 1900; y--) ySel.add(new Option(y + '년', y));
    // 월
    var mSel = $('month');
    for (var m = 1; m <= 12; m++) mSel.add(new Option(m + '월', m));
    // 시진
    var sSel = $('si');
    SI_OPTIONS.forEach(function (o) { sSel.add(new Option(o.label, o.v)); });

    var saved = loadSaved();
    ySel.value = saved.year || 1998;
    mSel.value = saved.month || 5;
    fillDays(saved.day || 8);
    sSel.value = saved.si === undefined ? 'unknown' : saved.si;
    if (saved.name) $('name').value = saved.name;
    setGender(saved.gender || 'male');
    setCalendar(saved.calendar || 'solar');

    bind();
  }

  function fillDays(selected) {
    var dSel = $('day');
    var y = +$('year').value, m = +$('month').value;
    var max = new Date(y, m, 0).getDate();
    var keep = selected || +dSel.value || 1;
    dSel.innerHTML = '';
    for (var d = 1; d <= max; d++) dSel.add(new Option(d + '일', d));
    dSel.value = Math.min(keep, max);
  }

  function setGender(g) {
    state.gender = g;
    document.querySelectorAll('[data-gender]').forEach(function (b) {
      var on = b.dataset.gender === g;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  function setCalendar(c) {
    state.calendar = c;
    document.querySelectorAll('[data-cal]').forEach(function (b) {
      var on = b.dataset.cal === c;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    updateLeap();
  }

  function updateLeap() {
    var wrap = $('leap-wrap');
    if (state.calendar !== 'lunar') { wrap.classList.add('is-hidden'); return; }
    var y = +$('year').value;
    var leap = A.leapMonthOf(y);
    if (leap) {
      wrap.classList.remove('is-hidden');
      $('leap-label').textContent = '윤' + leap + '월 (이 해는 윤' + leap + '월이 있습니다)';
      $('leap').disabled = false;
    } else {
      wrap.classList.add('is-hidden');
      $('leap').checked = false;
    }
  }

  function bind() {
    document.querySelectorAll('[data-gender]').forEach(function (b) {
      b.addEventListener('click', function () { setGender(b.dataset.gender); });
    });
    document.querySelectorAll('[data-cal]').forEach(function (b) {
      b.addEventListener('click', function () { setCalendar(b.dataset.cal); });
    });
    $('year').addEventListener('change', function () { fillDays(); updateLeap(); });
    $('month').addEventListener('change', function () { fillDays(); });
    $('saju-form').addEventListener('submit', onSubmit);
    $('unlock-btn').addEventListener('click', unlock);
    $('preview-card').addEventListener('click', function () { openCard(false); });
    $('save-card').addEventListener('click', function () { openCard(true); });
    $('copy-link').addEventListener('click', copyLink);
    $('copy-summary').addEventListener('click', copySummary);
    document.querySelectorAll('[data-go="home"]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); showView('home'); });
    });
    document.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { $('modal').hidden = true; });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $('modal').hidden = true; });
  }

  /* ---------- URL 해시 공유 ---------- */
  // #b=19980508&g=m&s=6&c=solar&l=0&n=이름(URL인코딩)
  function encodeInput(o) {
    function pad(n) { return ('0' + n).slice(-2); }
    var parts = ['b=' + o.year + pad(o.month) + pad(o.day),
      'g=' + (o.gender === 'female' ? 'f' : 'm'),
      'c=' + (o.calendar === 'lunar' ? 'l' : 's')];
    if (o.siIndex !== null && o.siIndex !== undefined) parts.push('s=' + o.siIndex);
    if (o.calendar === 'lunar' && o.leap) parts.push('l=1');
    if (o.name) parts.push('n=' + encodeURIComponent(o.name));
    return '#' + parts.join('&');
  }
  function decodeHash(hash) {
    if (!hash || hash.indexOf('#') !== 0) return null;
    var q = new URLSearchParams(hash.slice(1));
    var b = q.get('b');
    if (!b || !/^\d{8}$/.test(b)) return null;
    return {
      name: q.get('n') || '',
      gender: q.get('g') === 'f' ? 'female' : 'male',
      calendar: q.get('c') === 'l' ? 'lunar' : 'solar',
      year: +b.slice(0, 4), month: +b.slice(4, 6), day: +b.slice(6, 8),
      leap: q.get('l') === '1',
      siIndex: q.get('s') === null ? null : (q.get('s') === '' ? null : Number(q.get('s')))
    };
  }
  function buildShareUrl() {
    var c = state.chart.input;
    return location.origin + location.pathname + encodeInput(c);
  }
  function showToast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { t.classList.remove('is-on'); }, 2200);
  }
  function copyText(text, okMsg) {
    function done() { showToast(okMsg); }
    if (navigator.clipboard && window.isSecureContext !== false) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { showToast('복사에 실패했습니다. 직접 선택해 주세요.'); }
    ta.remove();
  }
  function copyLink() {
    if (!state.chart) return;
    copyText(buildShareUrl(), '결과 링크가 복사되었습니다');
  }
  function copySummary() {
    if (!state.report) return;
    copyText(state.report.summary.oneLine, '한 줄 요약이 복사되었습니다');
  }

  /* ---------- 저장/복원 ---------- */
  function saveInput(o) { try { localStorage.setItem('saju2027.input', JSON.stringify(o)); } catch (e) {} }
  function loadSaved() { try { return JSON.parse(localStorage.getItem('saju2027.input') || '{}'); } catch (e) { return {}; } }

  /* ---------- 제출 ---------- */
  function onSubmit(e) {
    e.preventDefault();
    var err = $('form-error');
    err.hidden = true;

    var siVal = $('si').value;
    var input = {
      name: ($('name').value || '').trim(),
      gender: state.gender,
      calendar: state.calendar,
      year: +$('year').value,
      month: +$('month').value,
      day: +$('day').value,
      leap: $('leap').checked,
      siIndex: siVal === 'unknown' ? null : Number(siVal)
    };

    if (input.calendar === 'lunar' && input.leap && !A.leapMonthOf(input.year)) {
      err.textContent = '선택한 해에는 윤달이 없습니다. 윤달 표시를 해제해 주세요.';
      err.hidden = false;
      return;
    }

    var chart;
    try {
      chart = S.computeChart(input);
    } catch (ex) {
      err.textContent = ex.message || '날짜를 확인해 주세요.';
      err.hidden = false;
      return;
    }
    saveInput(input);
    state.chart = chart;
    state.report = R.build(chart);
    state.unlocked = false;
    try { history.replaceState(null, '', encodeInput(input)); } catch (e) {}

    showView('loading');
    runLoading(function () {
      render();
      showView('result');
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  function runLoading(done) {
    var steps = document.querySelectorAll('.loading-steps li');
    steps.forEach(function (s) { s.classList.remove('on'); });
    var i = 0;
    var tick = setInterval(function () {
      if (i < steps.length) { steps[i].classList.add('on'); i++; }
    }, 320);
    setTimeout(function () {
      clearInterval(tick);
      steps.forEach(function (s) { s.classList.add('on'); });
      setTimeout(done, 220);
    }, 1180);
  }

  function showView(name) {
    ['home', 'loading', 'result'].forEach(function (v) {
      $('view-' + v).classList.toggle('is-active', v === name);
    });
  }

  /* ---------- 렌더 ---------- */
  function render() {
    var c = state.chart, r = state.report;
    var name = (c.input.name || '') || '이름 없는 사주';

    $('r-name').textContent = name + ' 님의 2027';
    var lunarTxt = c.lunar
      ? '음력 ' + c.lunar.y + '.' + c.lunar.m + '.' + c.lunar.d + (c.lunar.leap ? ' (윤달)' : '')
      : '';
    var siTxt = c.input.siIndex === null ? '시 모름' : SI_LABEL[c.input.siIndex];
    $('r-meta').textContent = [
      c.solar.y + '년 ' + c.solar.m + '월 ' + c.solar.d + '일',
      lunarTxt, siTxt, c.input.gender === 'male' ? '남' : '여'
    ].filter(Boolean).join(' · ');

    var tags = [
      c.zodiac + '띠',
      S.STEM_KO[c.dayStem] + S.ELEM_KO[c.dayMaster.elem] + ' 일간',
      c.strength.label
    ];
    $('r-tags').innerHTML = tags.map(function (t) { return '<span>' + t + '</span>'; }).join('');

    $('chart-strength').textContent = c.strength.label + ' · ' +
      S.STEM_KO[c.dayStem] + S.ELEM_HAN[c.dayMaster.elem];

    renderPillars(c);
    renderElements(c, r);
    renderKeywords(r);
    renderSeun(c, r);
    renderDaymaster(c, r);
    renderDaeun(c, r);
    renderLuck(c, r);
    renderHero(c, r);

    $('r-half1').textContent = r.firstHalf;
    $('r-half2').textContent = r.secondHalf;
    $('r-year2027').textContent = r.year2027;

    $('r-cashflow').textContent = r.money.cashflow;
    $('r-timing').textContent = r.money.timing;
    $('r-caution').textContent = r.money.caution;
    $('r-peak').textContent = r.career.peak;
    $('r-style').textContent = r.career.style;
    $('r-advice').textContent = r.career.advice;

    $('money-score').textContent = '재성 ' + Math.round(r.natal.fin) + '%';
    $('career-score').textContent = '관성 ' + Math.round(r.natal.off) + '%';

    renderMonths(r);

    // 잠금 상태 초기화
    var zone = $('lock-zone');
    zone.classList.remove('is-open');
    var badge = zone.querySelector('.unlocked-badge');
    if (badge) badge.remove();
  }

  function renderPillars(c) {
    var order = ['hour', 'day', 'month', 'year'];
    var el = $('pillars');
    el.innerHTML = '';
    order.forEach(function (key) {
      var p = c.pillars[key];
      var g = c.tenGods[key];
      if (!p) {
        var empty = document.createElement('div');
        empty.className = 'pillar is-empty';
        empty.innerHTML = '<div class="god">시주</div><div class="han">—</div><div class="ko">모름</div>' +
          '<div class="sep"></div><div class="han">—</div><div class="ko">시간 미입력</div>' +
          '<div class="god">&nbsp;</div><div class="hidden">&nbsp;</div><div class="stage">&nbsp;</div>';
        el.appendChild(empty);
        return;
      }
      var color = S.ELEM_COLOR[S.STEM_ELEM[p.stem]];
      var hid = S.HIDDEN[p.branch].slice().reverse().map(function (i) { return S.STEM_KO[i]; }).join('·');
      var d = document.createElement('div');
      d.className = 'pillar';
      d.style.setProperty('--e', color);
      d.innerHTML =
        '<div class="god">' + (key === 'day' ? '일간' : g.stem) + '</div>' +
        '<div class="han">' + S.STEM_HAN[p.stem] + '</div>' +
        '<div class="ko">' + S.STEM_KO[p.stem] + '</div>' +
        '<div class="sep"></div>' +
        '<div class="han">' + S.BRANCH_HAN[p.branch] + '</div>' +
        '<div class="ko">' + S.BRANCH_KO[p.branch] + '</div>' +
        '<div class="god" style="color:#7B8298">' + g.branch + '</div>' +
        '<div class="hidden">' + hid + '</div>' +
        '<div class="stage">' + c.stages[key] + '</div>';
      el.appendChild(d);
    });

    var hidRow = order.filter(function (k) { return c.pillars[k]; }).map(function (k) {
      return S.HIDDEN[c.pillars[k].branch].slice().reverse().map(function (i) { return S.STEM_HAN[i]; }).join('');
    });
    $('r-hidden').textContent = hidRow.join(' / ') + ' (본기 순)';

    $('r-stages').textContent = order.filter(function (k) { return c.pillars[k]; })
      .map(function (k) { return c.stages[k]; }).join(' · ');
    $('r-gongmang').textContent = c.gongmang.map(function (b) { return S.BRANCH_KO[b]; }).join('·') + ' (일주 기준)';

    var sals = c.sals.length
      ? c.sals.map(function (s) { return s.name; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' · ')
      : '두드러진 신살 없음';
    $('r-sals').textContent = sals;
  }

  function renderElements(c, r) {
    var wrap = $('elem-bars');
    wrap.innerHTML = '';
    var pcts = c.elements.percents;
    for (var i = 0; i < 5; i++) {
      var pct = pcts[i];
      var width = Math.max(2, pct);
      var row = document.createElement('div');
      row.className = 'elem-row' + (pct < 12 ? ' is-low' : '');
      row.innerHTML =
        '<span class="elem-name"><i style="--c:' + S.ELEM_COLOR[i] + '">' + S.ELEM_HAN[i] + '</i>' + S.ELEM_KO[i] + '</span>' +
        '<span class="elem-track"><span class="elem-fill" style="--c:' + S.ELEM_COLOR[i] + ';width:' + width + '%"></span></span>' +
        '<span class="elem-pct"><b>' + pct + '%</b></span>';
      wrap.appendChild(row);
    }
    var groups = ['비겁', '식상', '재성', '관성', '인성'];
    var maxG = groups.slice().sort(function (x, y) { return c.groupPct[y] - c.groupPct[x]; })[0];
    $('group-pct').innerHTML = groups.map(function (g) {
      return '<span class="' + (g === maxG ? 'is-top' : '') + '">' + g +
        '<b>' + c.groupPct[g] + '%</b></span>';
    }).join('');
    $('r-balance').textContent = r.balance;
  }

  function renderKeywords(r) {
    $('kw-list').innerHTML = r.keywords.slice(0, 3).map(function (k, i) {
      return '<div class="kw"><i>' + ['壹', '貳', '參'][i] + '</i><b>' + k + '</b></div>';
    }).join('');
    $('r-yearline').textContent = r.yearLine;
  }

  function renderSeun(c, r) {
    var s = c.seun;
    $('seun-s1').textContent = S.STEM_HAN[s.stem];
    $('seun-s2').textContent = S.BRANCH_HAN[s.branch];
    $('seun-stage').textContent = '12운성 ' + r.seun.stage;
    $('seun-gods').innerHTML =
      '<p>천간 <b>' + S.STEM_KO[s.stem] + '(' + S.STEM_HAN[s.stem] + ')</b> <em>' + s.stemGod + '</em></p>' +
      '<p>지지 <b>' + S.BRANCH_KO[s.branch] + '(' + S.BRANCH_HAN[s.branch] + ')</b> <em>' + s.branchGod + '</em></p>';
    var rels = [];
    s.stemWithNatal.forEach(function (x) { rels.push({ cls: x.type === '합' ? 'hap' : 'chung', t: x.target + '(' + x.stemKo + ') ' + x.label }); });
    s.withNatal.forEach(function (x) {
      rels.push({ cls: x.type === '합' ? 'hap' : (x.type === '충' ? 'chung' : 'hyeong'), t: x.target + '(' + x.branchKo + ') ' + x.label });
    });
    if (!rels.length) rels.push({ cls: '', t: '원국과 직접 맞물리는 관계 없음' });
    $('seun-rels').innerHTML = rels.map(function (x) {
      return '<span class="rel ' + x.cls + '">' + x.t + '</span>';
    }).join('');
    $('r-seun').textContent = r.seun.text;
  }

  function renderDaymaster(c, r) {    $('dm-badge').textContent = S.STEM_HAN[c.dayStem];
    $('dm-title').innerHTML = S.STEM_KO[c.dayStem] + S.ELEM_KO[c.dayMaster.elem] + ' 일간 · <span>' +
      r.dayMaster.title + ', ' + r.dayMaster.key + '</span>';
    $('dm-body').textContent = r.dayMaster.body;
  }

  function renderHero(c, r) {
    $('r-heroline').textContent = r.summary.line;
    var s = r.summary.scores;
    $('g-wealth').textContent = s.wealth;
    $('g-career').textContent = s.career;
    $('g-stability').textContent = s.stability;
    // 등장 후 살짝 늦게 채워 게이지 애니메이션이 보이게
    setTimeout(function () {
      $('gf-wealth').style.width = s.wealth + '%';
      $('gf-career').style.width = s.career + '%';
      $('gf-stability').style.width = s.stability + '%';
    }, 60);
  }

  function renderDaeun(c, r) {
    var d = c.daeun;
    $('daeun-chip').textContent = '대운수 ' + d.daeunSu + ' · ' + d.directionKo + ' · 만 나이';
    var track = $('daeun-track');
    track.innerHTML = '';
    d.pillars.forEach(function (p) {
      var cur = c.currentDaeun && c.currentDaeun.index === p.index;
      var el = document.createElement('div');
      el.className = 'daeun-pill' + (cur ? ' is-now' : '');
      el.style.setProperty('--e', S.ELEM_COLOR[S.STEM_ELEM[p.stem]]);
      el.innerHTML =
        '<span class="d-age">' + p.startAge + '~' + p.endAge + '세</span>' +
        '<span class="d-han">' + p.han + '</span>' +
        '<span class="d-ko">' + p.ko + '</span>' +
        '<span class="d-god">' + p.god + '</span>' +
        (cur ? '<span class="d-now">2027</span>' : '');
      track.appendChild(el);
    });
    $('r-daeun').textContent = r.daeunText;
  }

  function renderLuck(c, r) {
    var y = r.luck.yong, h = r.luck.hui;
    $('luck-chip').textContent = '용신 ' + S.ELEM_KO[y.index] + ' · 희신 ' + S.ELEM_KO[h.index];
    $('luck-yong').textContent = S.ELEM_HAN[y.index] + ' ' + S.ELEM_KO[y.index];
    $('luck-yong').style.color = S.ELEM_COLOR[y.index];
    $('luck-yong-sub').textContent = y.grow;
    $('luck-hui').textContent = S.ELEM_HAN[h.index] + ' ' + S.ELEM_KO[h.index];
    $('luck-hui').style.color = S.ELEM_COLOR[h.index];
    $('luck-hui-sub').textContent = h.grow;
    $('luck-colors').textContent = y.colors.join(' · ');
    $('luck-dir').textContent = y.dir + ' (책상·침대 머리 방향)';
    $('luck-nums').textContent = y.nums;
    $('luck-jobs').textContent = y.jobs;
    $('luck-routines').textContent = '하루: ' + y.day + ' / 일주: ' + y.week + ' / 한 달: ' + y.month;
    $('r-luck').textContent = r.luck.text;
  }

  function renderMonths(r) {
    var wrap = $('months');
    wrap.innerHTML = '';
    var peak = r.months.slice().sort(function (a, b) { return (b.money + b.career) - (a.money + a.career); })
      .slice(0, 2).map(function (m) { return m.month; });
    r.months.forEach(function (m) {
      var d = document.createElement('div');
      d.className = 'month' + (peak.indexOf(m.month) >= 0 ? ' is-peak' : '') +
        (m.badgeTone === 'warn' ? ' is-warn' : (m.badgeTone === 'up' ? ' is-up' : ''));
      var tags = m.tags.map(function (t) { return '<span class="m-tag">' + t + '</span>'; }).join('');
      d.innerHTML =
        '<span class="m-label">' + m.month + '월</span>' +
        '<span class="m-ganji">' + m.ganjiHan + '<small>' + m.ganji + '</small></span>' +
        '<div class="m-main">' +
        '<div class="m-top"><span class="m-gods">' + m.stemGod + '·' + m.branchGod + '</span>' +
        '<span class="m-badge b-' + m.badgeTone + '">' + m.badge + '</span>' + tags +
        '<span class="m-bars"><span class="m-bar money" title="재물 ' + m.money + '"><i style="width:' + m.money + '%"></i></span>' +
        '<span class="m-bar career" title="직업 ' + m.career + '"><i style="width:' + m.career + '%"></i></span></span></div>' +
        '<p class="m-line">' + m.line + '</p>' +
        '<p class="m-action">이 달 할 일 · ' + m.action + '</p>' +
        '</div>';
      wrap.appendChild(d);
    });
  }

  /* ---------- 잠금 해제 ---------- */
  function unlock() {
    state.unlocked = true;
    var zone = $('lock-zone');
    var body = $('locked-body');
    if (!zone.querySelector('.unlocked-badge')) {
      var b = document.createElement('div');
      b.className = 'unlocked-badge';
      b.innerHTML = '🔓 <b>체험 모드</b> · 실제 서비스에서는 ₩3,900 결제 후 열리는 영역입니다';
      body.insertBefore(b, body.firstChild);
    }
    zone.classList.add('is-open');
  }

  /* ---------- 결과 카드 ---------- */
  function drawCard() {
    var c = state.chart, r = state.report;
    var W = 1080, H = 1350;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var x = cv.getContext('2d');

    // 배경
    var g = x.createLinearGradient(0, 0, W * .4, H);
    g.addColorStop(0, '#101728'); g.addColorStop(.55, '#0B101C'); g.addColorStop(1, '#080C14');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    var glow = x.createRadialGradient(W * .82, 60, 10, W * .82, 60, 620);
    glow.addColorStop(0, 'rgba(214,178,90,.22)'); glow.addColorStop(1, 'rgba(214,178,90,0)');
    x.fillStyle = glow; x.fillRect(0, 0, W, H);

    var glow2 = x.createRadialGradient(60, H * .9, 10, 60, H * .9, 520);
    glow2.addColorStop(0, 'rgba(99,195,166,.12)'); glow2.addColorStop(1, 'rgba(99,195,166,0)');
    x.fillStyle = glow2; x.fillRect(0, 0, W, H);

    // 테두리
    x.strokeStyle = 'rgba(214,178,90,.28)'; x.lineWidth = 2;
    roundRect(x, 34, 34, W - 68, H - 68, 34); x.stroke();

    var serif = '"Noto Serif KR","Noto Serif CJK KR",serif';
    var sans = '"Noto Sans KR","Noto Sans CJK KR",sans-serif';

    // 상단 라벨
    x.fillStyle = 'rgba(214,178,90,.9)'; x.font = '600 26px ' + sans;
    x.textAlign = 'left';
    x.fillText('2027 정미년 신년 사주 리포트', 84, 128);

    // 이름
    x.fillStyle = '#F4F0E4'; x.font = '600 52px ' + serif;
    x.fillText((c.input.name || '나') + ' 님의 2027', 84, 200);

    x.fillStyle = 'rgba(200,206,220,.72)'; x.font = '400 24px ' + sans;
    var meta = c.solar.y + '.' + c.solar.m + '.' + c.solar.d + ' · ' +
      (c.input.gender === 'male' ? '남' : '여') + ' · ' + c.zodiac + '띠';
    x.fillText(meta, 84, 244);

    // 일간
    x.fillStyle = 'rgba(239,217,155,.92)'; x.font = '500 26px ' + sans;
    x.fillText(S.STEM_KO[c.dayStem] + S.ELEM_KO[c.dayMaster.elem] + ' 일간 · ' + r.dayMaster.title + ', ' + r.dayMaster.key, 84, 292);

    // 4기둥
    var labels = ['년', '월', '일', '시'];
    var keys = ['year', 'month', 'day', 'hour'];
    var boxW = 200, gap = 18, startX = 84, y0 = 336;
    keys.forEach(function (k, i) {
      var p = c.pillars[k];
      var bx = startX + i * (boxW + gap);
      x.fillStyle = 'rgba(255,255,255,.035)';
      roundRect(x, bx, y0, boxW, 250, 22); x.fill();
      x.strokeStyle = 'rgba(214,178,90,.18)'; x.lineWidth = 1.5; x.stroke();
      x.textAlign = 'center';
      x.fillStyle = 'rgba(160,168,186,.9)'; x.font = '500 22px ' + sans;
      x.fillText(labels[i], bx + boxW / 2, y0 + 40);
      if (!p) {
        x.fillStyle = 'rgba(255,255,255,.28)'; x.font = '500 44px ' + serif;
        x.fillText('—', bx + boxW / 2, y0 + 132);
        x.fillStyle = 'rgba(140,147,168,.7)'; x.font = '400 20px ' + sans;
        x.fillText('모름', bx + boxW / 2, y0 + 190);
        return;
      }
      x.fillStyle = '#F7F3E7'; x.font = '500 62px ' + serif;
      x.fillText(S.STEM_HAN[p.stem], bx + boxW / 2, y0 + 128);
      x.fillText(S.BRANCH_HAN[p.branch], bx + boxW / 2, y0 + 196);
      x.fillStyle = 'rgba(214,178,90,.85)'; x.font = '400 20px ' + sans;
      x.fillText(S.STEM_KO[p.stem] + ' ' + S.BRANCH_KO[p.branch], bx + boxW / 2, y0 + 232);
    });

    // 오행 바
    var ey = 656;
    x.textAlign = 'left';
    x.fillStyle = 'rgba(190,198,214,.85)'; x.font = '600 24px ' + sans;
    x.fillText('오행 밸런스', 84, ey);
    var pcts = c.elements.percents;
    for (var i = 0; i < 5; i++) {
      var ry = ey + 34 + i * 46;
      x.fillStyle = S.ELEM_COLOR[i]; x.font = '500 24px ' + serif;
      x.fillText(S.ELEM_HAN[i], 84, ry + 20);
      x.fillStyle = 'rgba(170,178,196,.8)'; x.font = '400 22px ' + sans;
      x.fillText(S.ELEM_KO[i], 122, ry + 20);
      x.fillStyle = 'rgba(255,255,255,.07)';
      roundRect(x, 180, ry + 4, 640, 14, 7); x.fill();
      x.fillStyle = S.ELEM_COLOR[i];
      roundRect(x, 180, ry + 4, Math.max(14, 640 * pcts[i] / 100), 14, 7); x.fill();
      x.fillStyle = 'rgba(200,206,220,.75)'; x.font = '400 22px ' + sans;
      x.fillText(pcts[i] + '%', 842, ry + 20);
    }

    // 키워드
    var ky = 946;
    x.fillStyle = 'rgba(190,198,214,.85)'; x.font = '600 24px ' + sans;
    x.fillText('2027 핵심 키워드', 84, ky);
    r.keywords.slice(0, 3).forEach(function (k, i) {
      var yy = ky + 34 + i * 62;
      x.fillStyle = 'rgba(214,178,90,.1)';
      roundRect(x, 84, yy, 912, 52, 14); x.fill();
      x.strokeStyle = 'rgba(214,178,90,.2)'; x.lineWidth = 1; x.stroke();
      x.fillStyle = 'rgba(214,178,90,.9)'; x.font = '500 24px ' + serif;
      x.fillText(['壹', '貳', '參'][i], 104, yy + 35);
      x.fillStyle = '#EFD99B'; x.font = '600 26px ' + sans;
      x.fillText(k, 150, yy + 35);
    });

    // 하단
    x.textAlign = 'center';
    x.fillStyle = 'rgba(140,147,168,.75)'; x.font = '400 22px ' + sans;
    x.fillText('재물 · 취업 특화 신년 사주 리포트', W / 2, H - 110);
    x.fillStyle = 'rgba(214,178,90,.85)'; x.font = '500 22px ' + serif;
    x.fillText('丁未 · 2027', W / 2, H - 72);

    return cv;
  }

  function roundRect(x, left, top, w, h, r) {
    x.beginPath();
    x.moveTo(left + r, top);
    x.arcTo(left + w, top, left + w, top + h, r);
    x.arcTo(left + w, top + h, left, top + h, r);
    x.arcTo(left, top + h, left, top, r);
    x.arcTo(left, top, left + w, top, r);
    x.closePath();
  }

  function openCard(autoDownload) {
    var cv = drawCard();
    var url = cv.toDataURL('image/png');
    $('card-img').src = url;
    $('download-card').href = url;
    $('modal').hidden = false;
    if (autoDownload) {
      var a = document.createElement('a');
      a.href = url; a.download = 'saju2027-card.png';
      document.body.appendChild(a); a.click(); a.remove();
    }
  }

  /* 공개: 스크린샷·검증용 */
  window.__saju = {
    state: state,
    submit: function (opts) {
      $('name').value = opts.name || '';
      setGender(opts.gender || 'male');
      setCalendar(opts.calendar || 'solar');
      $('year').value = opts.year; $('month').value = opts.month; fillDays(opts.day); $('day').value = opts.day;
      $('leap').checked = !!opts.leap;
      $('si').value = opts.si === null || opts.si === undefined ? 'unknown' : opts.si;
      $('saju-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    },
    unlock: unlock,
    openCard: openCard
  };

  document.addEventListener('DOMContentLoaded', init);
  // URL 해시로 공유된 결과가 있으면 자동으로 계산해 결과 화면까지 보여 준다
  window.addEventListener('DOMContentLoaded', function () {
    var shared = decodeHash(location.hash);
    if (!shared) return;
    setTimeout(function () {
      var i = window.__saju;
      i.submit({
        name: shared.name, gender: shared.gender, calendar: shared.calendar,
        year: shared.year, month: shared.month, day: shared.day,
        leap: shared.leap, si: shared.siIndex
      });
      i.unlock();
    }, 50);
  });
})();
