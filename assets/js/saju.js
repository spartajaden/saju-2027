/* ===========================================================================
   saju.js — 사주(四柱) 산출 엔진
   입력: 양력/음력 생년월일 + 시진(12시진, 모름 가능) + 성별
   출력: 사주팔자·십성·오행·십이운성·지장간·신살·공망·2027 세운·월별 운
   =========================================================================== */
(function (global) {
  'use strict';
  var A = global.Astro;

  /* ---------- 기본 상수 ---------- */
  var STEM_HAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var STEM_KO = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  var BRANCH_HAN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var BRANCH_KO = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  var STEM_ELEM = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];          // 목화토금수
  var BRANCH_ELEM = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  var STEM_YANG = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
  var BRANCH_YANG = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
  var ELEM_KO = ['목', '화', '토', '금', '수'];
  var ELEM_HAN = ['木', '火', '土', '金', '水'];
  var ELEM_COLOR = ['#6FBF8B', '#E0705F', '#D6B25A', '#BFD0DA', '#6E9BE0'];
  var ZODIAC = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];

  // 지장간 (여기 → 중기 → 본기 순, 마지막이 본기)
  var HIDDEN = [
    [9],                 // 子 계
    [9, 7, 5],           // 丑 계 신 기
    [4, 2, 0],           // 寅 무 병 갑
    [1],                 // 卯 을
    [1, 9, 4],           // 辰 을 계 무
    [4, 6, 2],           // 巳 무 경 병
    [2, 5, 3],           // 午 병 기 정
    [1, 3, 5],           // 未 을 정 기
    [4, 8, 6],           // 申 무 임 경
    [6, 7],              // 酉 경 신
    [7, 3, 4],           // 戌 신 정 무
    [0, 8]               // 亥 갑 임
  ];

  // 십이운성
  var STAGE_NAMES = ['장생', '목욕', '관대', '임관', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];
  var STAGE_START = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3]; // 갑해 을오 병인 정유 무인 기유 경사 신자 임신 계묘

  // 육합 · 충 · 형 · 파 · 해
  var YUKHAP = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
  var CHUNG = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
  var HYEONG = [[2, 5], [5, 8], [2, 8], [1, 10], [10, 7], [1, 7], [0, 3], [4, 4], [6, 6], [9, 9], [11, 11]];
  var PA = [[0, 9], [6, 3], [4, 1], [10, 7], [2, 11], [5, 8]];
  var HAE = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
  var CHEONGAN_HAP = [[0, 5], [1, 6], [2, 7], [3, 8], [4, 9]];
  var CHEONGAN_CHUNG = [[0, 6], [1, 7], [2, 8], [3, 9]];

  var CHEONEUL = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [3, 5], [3, 5]];
  var MUNCHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3];
  var DOHWA = { 0: 9, 1: 6, 2: 3, 3: 0 };   // 삼합(신자진/인오술/사유축/해묘미) → 도화
  var YEOKMA = { 0: 2, 1: 8, 2: 11, 3: 5 };
  var HWAGAE = { 0: 4, 1: 10, 2: 1, 3: 7 };
  var GONGMANG = [[10, 11], [8, 9], [6, 7], [4, 5], [2, 3], [0, 1]];

  function mod(a, n) { return ((a % n) + n) % n; }
  function isPair(list, a, b) {
    for (var i = 0; i < list.length; i++) {
      if ((list[i][0] === a && list[i][1] === b) || (list[i][0] === b && list[i][1] === a)) return true;
    }
    return false;
  }
  function pairName(list, names, a, b) {
    return names[list.indexOf(list.filter(function (p) {
      return (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a);
    })[0])] || null;
  }
  function elemOfStem(i) { return STEM_ELEM[i]; }
  function elemOfBranch(i) { return BRANCH_ELEM[i]; }
  function elemProduces(e) { return (e + 1) % 5; }   // 목→화→토→금→수→목
  function elemControls(e) { return (e + 2) % 5; }   // 목→토→수→화→금→목

  /* ---------- 십성 ---------- */
  function tenGod(dayStem, otherStem) {
    var de = STEM_ELEM[dayStem], oe = STEM_ELEM[otherStem];
    var same = STEM_YANG[dayStem] === STEM_YANG[otherStem];
    if (de === oe) return same ? '비견' : '겁재';
    if (elemProduces(de) === oe) return same ? '식신' : '상관';
    if (elemControls(de) === oe) return same ? '편재' : '정재';
    if (elemControls(oe) === de) return same ? '편관' : '정관';
    if (elemProduces(oe) === de) return same ? '편인' : '정인';
    return '비견';
  }
  var GROUP_OF = {
    '비견': '비겁', '겁재': '비겁', '식신': '식상', '상관': '식상',
    '편재': '재성', '정재': '재성', '편관': '관성', '정관': '관성',
    '편인': '인성', '정인': '인성'
  };
  var GROUP_KO = { '비겁': '비겁', '식상': '식상', '재성': '재성', '관성': '관성', '인성': '인성' };

  /* ---------- 십이운성 ---------- */
  function stageOf(dayStem, branch) {
    var start = STAGE_START[dayStem];
    var dir = STEM_YANG[dayStem] ? 1 : -1;
    var idx = mod((branch - start) * dir, 12);
    return STAGE_NAMES[idx];
  }

  /* ---------- 사주 계산 ---------- */
  function computeChart(input) {
    var solar = { y: input.year, m: input.month, d: input.day };
    var lunar = null;
    if (input.calendar === 'lunar') {
      var s = A.lunarToSolar(input.year, input.month, input.day, !!input.leap);
      if (!s) throw new Error('해당 음력 날짜를 찾을 수 없습니다. (지원 범위 1900~2049년)');
      solar = { y: s.y, m: s.m, d: s.d };
      lunar = { y: input.year, m: input.month, d: input.day, leap: !!input.leap };
    } else {
      var l0 = A.solarToLunar(solar.y, solar.m, solar.d);
      lunar = l0 && { y: l0.year, m: l0.month, d: l0.day, leap: l0.leap };
    }

    var si = input.siIndex;                    // 0=자시 ... 11=해시, null=모름
    var hour = si === null || si === undefined ? null : mod(si * 2 + 23, 24); // 자시 0시, 축시 2시 ...
    var birthJD = hour === null
      ? A.jdFromKST(solar.y, solar.m, solar.d, 12, 0)
      : A.jdFromKST(solar.y, solar.m, solar.d, hour, 0);

    // --- 년주: 입춘 기준 ---
    var termsThis = A.termsInYear(solar.y);
    var ipchun = termsThis.filter(function (t) { return t.lon === 315; })[0];
    var sajuYear = birthJD >= ipchun.jd ? solar.y : solar.y - 1;
    var yIdx = mod(sajuYear - 1984, 60);
    var yStem = yIdx % 10, yBranch = yIdx % 12;

    // --- 월주: 태양 황경으로 절기월 판정 ---
    var lon = A.sunLongitude(birthJD);
    var monthIdx = Math.floor(mod(lon - 315, 360) / 30);      // 0=인월
    var inStem = [2, 4, 6, 8, 0][yStem % 5];                  // 인월 천간
    var mStem = mod(inStem + monthIdx, 10);
    var mBranch = mod(2 + monthIdx, 12);

    // --- 일주 ---
    var dIdx = mod(A.jdn(solar.y, solar.m, solar.d) + 49, 60);
    var dStem = dIdx % 10, dBranch = dIdx % 12;

    // --- 시주 ---
    var hStem = null;
    if (si !== null && si !== undefined) {
      var jaStem = [0, 2, 4, 6, 8][dStem % 5];
      hStem = mod(jaStem + si, 10);
    }
    var hBranch = (si === null || si === undefined) ? null : si;

    var pillars = {
      hour: hStem === null ? null : { stem: hStem, branch: hBranch },
      day: { stem: dStem, branch: dBranch },
      month: { stem: mStem, branch: mBranch },
      year: { stem: yStem, branch: yBranch }
    };

    // --- 십성 ---
    function gods(p) {
      if (!p) return null;
      return {
        stem: tenGod(dStem, p.stem),
        branch: tenGod(dStem, HIDDEN[p.branch][HIDDEN[p.branch].length - 1]),
        hidden: HIDDEN[p.branch].map(function (s) { return { stem: s, god: tenGod(dStem, s) }; })
      };
    }
    var tenGods = {
      hour: gods(pillars.hour), day: gods(pillars.day),
      month: gods(pillars.month), year: gods(pillars.year)
    };
    // 일간 자신은 십성이 아니라 '일간'
    tenGods.day.stem = '일간';

    // --- 오행 분포 (글자 수 기준) ---
    var counts = [0, 0, 0, 0, 0];
    var chars = [
      { p: pillars.year, pos: '년' }, { p: pillars.month, pos: '월' },
      { p: pillars.day, pos: '일' }
    ];
    if (pillars.hour) chars.push({ p: pillars.hour, pos: '시' });
    chars.forEach(function (c) {
      counts[elemOfStem(c.p.stem)]++;
      counts[elemOfBranch(c.p.branch)]++;
    });
    var total = chars.length * 2;
    var percents = counts.map(function (c) { return Math.round(c / total * 1000) / 10; });

    // --- 오행 가중 점수 (월령 반영, 강약 판정용) ---
    var weighted = [0, 0, 0, 0, 0];
    chars.forEach(function (c) {
      var w = c.pos === '월' ? 1.4 : 1.0;
      weighted[elemOfStem(c.p.stem)] += 1.0 * w;
      var hid = HIDDEN[c.p.branch];
      for (var i = 0; i < hid.length; i++) {
        var part = i === hid.length - 1 ? 1.0 : (i === hid.length - 2 ? 0.4 : 0.2);
        weighted[STEM_ELEM[hid[i]]] += part * w;
      }
    });

    // --- 신강 · 신약 ---
    var myElem = elemOfStem(dStem);
    var support = weighted[myElem] + weighted[mod(myElem + 4, 5)];      // 비겁 + 인성
    var consume = weighted[elemProduces(myElem)] + weighted[elemControls(myElem)] +
      weighted[mod(myElem + 2, 5)];                                     // 식상 + 재성 + 관성
    var ratio = support / (support + consume);
    var strengthLabel = ratio >= 0.60 ? '신강' : (ratio >= 0.50 ? '중화' : (ratio >= 0.42 ? '중화신약' : '신약'));

    // --- 십성 그룹 점수 ---
    var groupScore = { '비겁': 0, '식상': 0, '재성': 0, '관성': 0, '인성': 0 };
    var groupChars = { '비겁': [], '식상': [], '재성': [], '관성': [], '인성': [] };
    chars.forEach(function (c) {
      var gs = tenGod(dStem, c.p.stem);
      if (c.pos !== '일') {
        groupScore[GROUP_OF[gs]] += 1.0;
        groupChars[GROUP_OF[gs]].push(c.pos + '간 ' + STEM_KO[c.p.stem] + '(' + gs + ')');
      }
      var hid = HIDDEN[c.p.branch];
      var mainGod = tenGod(dStem, hid[hid.length - 1]);
      groupScore[GROUP_OF[mainGod]] += 1.0;
      groupChars[GROUP_OF[mainGod]].push(c.pos + '지 ' + BRANCH_KO[c.p.branch] + '(' + mainGod + ')');
      for (var i = 0; i < hid.length - 1; i++) {
        var g2 = tenGod(dStem, hid[i]);
        groupScore[GROUP_OF[g2]] += i === hid.length - 2 ? 0.4 : 0.2;
      }
    });
    var groupTotal = 0;
    for (var k in groupScore) groupTotal += groupScore[k];
    var groupPct = {};
    for (var k2 in groupScore) groupPct[k2] = Math.round(groupScore[k2] / groupTotal * 1000) / 10;

    // --- 십이운성 ---
    var stages = {};
    ['year', 'month', 'day', 'hour'].forEach(function (pos) {
      stages[pos] = pillars[pos] ? stageOf(dStem, pillars[pos].branch) : null;
    });

    // --- 신살 ---
    var natalBranches = ['year', 'month', 'day', 'hour']
      .filter(function (p) { return pillars[p]; })
      .map(function (p) { return pillars[p].branch; });
    function has(b) { return natalBranches.indexOf(b) >= 0; }
    var sals = [];
    CHEONEUL[dStem].forEach(function (b) { if (has(b)) sals.push({ name: '천을귀인', where: BRANCH_KO[b] + '지' }); });
    if (has(MUNCHANG[dStem])) sals.push({ name: '문창성', where: BRANCH_KO[MUNCHANG[dStem]] + '지' });
    [pillars.year.branch, pillars.day.branch].forEach(function (ref, i) {
      var grp = ref % 4 === 0 ? 0 : (ref % 4 === 2 ? 1 : (ref % 4 === 1 ? 2 : 3));
      // 삼합 그룹: 신자진(8,0,4)=0, 인오술(2,6,10)=1, 사유축(5,9,1)=2, 해묘미(11,3,7)=3
      var g = ([8, 0, 4].indexOf(ref) >= 0) ? 0 : ([2, 6, 10].indexOf(ref) >= 0) ? 1 : ([5, 9, 1].indexOf(ref) >= 0) ? 2 : 3;
      var tag = i === 0 ? '년지' : '일지';
      if (has(DOHWA[g])) sals.push({ name: '도화', where: tag + ' 기준 ' + BRANCH_KO[DOHWA[g]] + '지' });
      if (has(YEOKMA[g])) sals.push({ name: '역마', where: tag + ' 기준 ' + BRANCH_KO[YEOKMA[g]] + '지' });
      if (has(HWAGAE[g])) sals.push({ name: '화개', where: tag + ' 기준 ' + BRANCH_KO[HWAGAE[g]] + '지' });
    });
    var gongmang = GONGMANG[Math.floor(dIdx / 10)];

    // --- 원국 내 지지 관계 ---
    var relNames = { hap: '합', chung: '충', hyeong: '형', pa: '파', hae: '해' };
    var innerRelations = [];
    var posNames = { year: '년지', month: '월지', day: '일지', hour: '시지' };
    var posList = ['year', 'month', 'day', 'hour'].filter(function (p) { return pillars[p]; });
    for (var i = 0; i < posList.length; i++) {
      for (var j = i + 1; j < posList.length; j++) {
        var a = pillars[posList[i]].branch, b = pillars[posList[j]].branch;
        var tag = posNames[posList[i]] + '·' + posNames[posList[j]];
        if (isPair(YUKHAP, a, b)) innerRelations.push({ type: '합', label: '육합', pair: tag, a: a, b: b });
        if (isPair(CHUNG, a, b)) innerRelations.push({ type: '충', label: '충', pair: tag, a: a, b: b });
        if (isPair(HYEONG, a, b)) innerRelations.push({ type: '형', label: '형', pair: tag, a: a, b: b });
        if (isPair(PA, a, b)) innerRelations.push({ type: '파', label: '파', pair: tag, a: a, b: b });
        if (isPair(HAE, a, b)) innerRelations.push({ type: '해', label: '해', pair: tag, a: a, b: b });
      }
    }
    var stemRelations = [];
    for (var m = 0; m < posList.length; m++) {
      for (var n = m + 1; n < posList.length; n++) {
        var sa = pillars[posList[m]].stem, sb = pillars[posList[n]].stem;
        if (isPair(CHEONGAN_HAP, sa, sb)) stemRelations.push({ type: '합', pair: posNames[posList[m]] + '·' + posNames[posList[n]] });
        if (isPair(CHEONGAN_CHUNG, sa, sb)) stemRelations.push({ type: '충', pair: posNames[posList[m]] + '·' + posNames[posList[n]] });
      }
    }

    // --- 대운 ---
    var daeun = computeDaeun(birthJD, solar.y, input.gender, yStem, mStem, mBranch, dStem);
    var age2027 = 2027 - solar.y;                  // 만 나이 기준 (2027년 생일 기준)
    var currentDaeun = daeun.pillars.filter(function (p) {
      return age2027 >= p.startAge && age2027 <= p.endAge;
    })[0] || null;

    // --- 2027 정미년 세운 ---
    var seun = buildYear(2027, dStem, pillars, natalBranches, posList, posNames, innerRelations);

    // --- 2027 월별 ---
    var months = [];
    for (var mm = 1; mm <= 12; mm++) {
      var mid = A.jdFromKST(2027, mm, 15, 12, 0);
      var yP = yearPillarAt(mid);
      var mp = monthPillarAt(mid, yP.stem);
      var stemGod = tenGod(dStem, mp.stem);
      var branchGod = tenGod(dStem, HIDDEN[mp.branch][HIDDEN[mp.branch].length - 1]);
      var rel = relationFlags(mp.branch, natalBranches);
      var relAdj = rel.chung * -11 + rel.hyeong * -7 + rel.hap * 7 + (rel.pa + rel.hae) * -3;
      var money = 55 + (GROUP_OF[stemGod] === '재성' ? 14 : 0) + (GROUP_OF[branchGod] === '재성' ? 14 : 0) +
        (GROUP_OF[stemGod] === '식상' ? 8 : 0) + (GROUP_OF[branchGod] === '식상' ? 8 : 0) -
        (GROUP_OF[stemGod] === '비겁' ? 8 : 0) - (GROUP_OF[branchGod] === '비겁' ? 6 : 0) + relAdj;
      var career = 55 + (GROUP_OF[stemGod] === '관성' ? 14 : 0) + (GROUP_OF[branchGod] === '관성' ? 14 : 0) +
        (GROUP_OF[stemGod] === '인성' ? 10 : 0) + (GROUP_OF[branchGod] === '인성' ? 10 : 0) +
        (GROUP_OF[stemGod] === '식상' ? 4 : 0) - (GROUP_OF[stemGod] === '비겁' ? 7 : 0) +
        (ratio < 0.5 ? (GROUP_OF[stemGod] === '인성' ? 5 : 0) : 0) + relAdj;
      months.push({
        month: mm, label: mm + '월',
        stem: mp.stem, branch: mp.branch,
        stemGod: stemGod, branchGod: branchGod,
        termMonth: BRANCH_KO[mp.branch] + '월',
        money: clamp(Math.round(money), 25, 95),
        career: clamp(Math.round(career), 25, 95),
        rel: rel
      });
    }

    var chart = {
      input: input,
      solar: solar,
      lunar: lunar,
      pillars: pillars,
      tenGods: tenGods,
      dayStem: dStem,
      dayMaster: { han: STEM_HAN[dStem], ko: STEM_KO[dStem], elem: elemOfStem(dStem), yang: !!STEM_YANG[dStem] },
      elements: { counts: counts, percents: percents, weighted: weighted, total: total },
      strength: { support: support, consume: consume, ratio: ratio, label: strengthLabel },
      groupScore: groupScore,
      groupPct: groupPct,
      groupChars: groupChars,
      stages: stages,
      sals: sals,
      gongmang: gongmang,
      innerRelations: innerRelations,
      stemRelations: stemRelations,
      seun: seun,
      daeun: daeun,
      currentDaeun: currentDaeun,
      age2027: age2027,
      months2027: months,
      zodiac: ZODIAC[pillars.year.branch],
      hasHour: !!pillars.hour
    };

    // 월별 점수에 순위 부여
    var byMoney = months.slice().sort(function (a, b) { return b.money - a.money; });
    var byCareer = months.slice().sort(function (a, b) { return b.career - a.career; });
    chart.rank = {
      moneyTop: byMoney.slice(0, 3).map(function (x) { return x.month; }),
      moneyLow: byMoney.slice(-3).map(function (x) { return x.month; }),
      careerTop: byCareer.slice(0, 3).map(function (x) { return x.month; }),
      careerLow: byCareer.slice(-3).map(function (x) { return x.month; })
    };
    chart.halfYear = {
      first: avg(months.slice(0, 6).map(function (x) { return x.money + x.career; })) / 2,
      second: avg(months.slice(6, 12).map(function (x) { return x.money + x.career; })) / 2
    };
    return chart;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function avg(arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length; }

  function yearPillarAt(jd) {
    var dt = A.kstFromJD(jd);
    var terms = A.termsInYear(dt.y);
    var ip = terms.filter(function (t) { return t.lon === 315; })[0];
    var y = jd >= ip.jd ? dt.y : dt.y - 1;
    var idx = mod(y - 1984, 60);
    return { year: y, stem: idx % 10, branch: idx % 12 };
  }
  function monthPillarAt(jd, yStem) {
    var lon = A.sunLongitude(jd);
    var mi = Math.floor(mod(lon - 315, 360) / 30);
    var inStem = [2, 4, 6, 8, 0][yStem % 5];
    return { stem: mod(inStem + mi, 10), branch: mod(2 + mi, 12) };
  }
  function relationFlags(branch, natal) {
    var f = { hap: 0, chung: 0, hyeong: 0, pa: 0, hae: 0 };
    natal.forEach(function (b) {
      if (isPair(YUKHAP, branch, b)) f.hap++;
      if (isPair(CHUNG, branch, b)) f.chung++;
      if (isPair(HYEONG, branch, b)) f.hyeong++;
      if (isPair(PA, branch, b)) f.pa++;
      if (isPair(HAE, branch, b)) f.hae++;
    });
    return f;
  }

  function buildYear(year, dStem, pillars, natalBranches, posList, posNames, innerRelations) {
    var idx = mod(year - 1984, 60);
    var stem = idx % 10, branch = idx % 12;
    var stemGod = tenGod(dStem, stem);
    var branchGod = tenGod(dStem, HIDDEN[branch][HIDDEN[branch].length - 1]);
    var withNatal = [];
    natalBranches.forEach(function (b, i) {
      var target = posNames[posList[i]];
      if (isPair(YUKHAP, branch, b)) withNatal.push({ type: '합', label: '육합', target: target, branchKo: BRANCH_KO[b] });
      if (isPair(CHUNG, branch, b)) withNatal.push({ type: '충', label: '충', target: target, branchKo: BRANCH_KO[b] });
      if (isPair(HYEONG, branch, b)) withNatal.push({ type: '형', label: '형', target: target, branchKo: BRANCH_KO[b] });
      if (isPair(PA, branch, b)) withNatal.push({ type: '파', label: '파', target: target, branchKo: BRANCH_KO[b] });
      if (isPair(HAE, branch, b)) withNatal.push({ type: '해', label: '해', target: target, branchKo: BRANCH_KO[b] });
    });
    var stemWithNatal = [];
    ['year', 'month', 'day', 'hour'].forEach(function (p) {
      if (!pillars[p]) return;
      var s = pillars[p].stem;
      if (isPair(CHEONGAN_HAP, stem, s)) stemWithNatal.push({ type: '합', label: '천간합', target: posNames[p], stemKo: STEM_KO[s] });
      if (isPair(CHEONGAN_CHUNG, stem, s)) stemWithNatal.push({ type: '충', label: '천간충', target: posNames[p], stemKo: STEM_KO[s] });
    });
    return {
      year: year, stem: stem, branch: branch,
      stemKo: STEM_KO[stem], branchKo: BRANCH_KO[branch],
      han: STEM_HAN[stem] + BRANCH_HAN[branch],
      stemGod: stemGod, branchGod: branchGod,
      withNatal: withNatal, stemWithNatal: stemWithNatal
    };
  }

  /* ---------- 대운(大運) ----------
     양남음녀 순행 · 음남양녀 역행 (년간 음양 기준)
     대운수 = 절입까지 일수 ÷ 3 (반올림). 순행은 다음 절입, 역행은 이전 절입 기준.
     첫 대운은 월주에서 한 칸(순행 +1 / 역행 -1) 이동한 간지부터 10년 주기. */
  function computeDaeun(birthJD, birthYear, gender, yStem, mStem, mBranch, dStem) {
    var yangYear = !!STEM_YANG[yStem];
    var forward = gender === 'male' ? yangYear : !yangYear;
    // 대운수는 24절기 중 '절'(立春·경칩 등, 황경 30° 간격의 홀수 배) 기준으로만 잰다 (중기 제외)
    var jeol = A.surroundingTerms(birthJD, birthYear).all.filter(function (t) { return t.lon % 30 === 15; });
    var prev = null, next = null;
    for (var i = 0; i < jeol.length; i++) {
      if (jeol[i].jd <= birthJD) prev = jeol[i];
      else { next = jeol[i]; break; }
    }
    var ref = forward ? next : prev;
    var days = ref ? Math.abs(ref.jd - birthJD) : 0;
    var daeunSu = Math.round(days / 3);
    if (daeunSu > 20) daeunSu = 20;               // 안전 상한 (실측 최대 10년대 초반)
    var step = forward ? 1 : -1;
    var pillars = [];
    for (var i = 0; i < 10; i++) {
      var st = mod(mStem + step * (i + 1), 10);
      var br = mod(mBranch + step * (i + 1), 12);
      pillars.push({
        index: i,
        stem: st, branch: br,
        han: STEM_HAN[st] + BRANCH_HAN[br],
        ko: STEM_KO[st] + BRANCH_KO[br],
        stemHan: STEM_HAN[st], branchHan: BRANCH_HAN[br],
        stemKo: STEM_KO[st], branchKo: BRANCH_KO[br],
        god: tenGod(dStem, st),
        branchGod: tenGod(dStem, HIDDEN[br][HIDDEN[br].length - 1]),
        startAge: daeunSu + i * 10,
        endAge: daeunSu + i * 10 + 9
      });
    }
    return {
      forward: forward,
      directionKo: forward ? '순행' : '역행',
      daeunSu: daeunSu,
      fromTerm: ref ? ref.name : null,
      fromTermKo: ref ? (forward ? '다음 절입 ' + ref.name : '이전 절입 ' + ref.name) : null,
      pillars: pillars
    };
  }

  /* ---------- 표시용 헬퍼 ---------- */
  function pillarLabel(p) {
    if (!p) return null;
    return {
      han: STEM_HAN[p.stem] + BRANCH_HAN[p.branch],
      ko: STEM_KO[p.stem] + BRANCH_KO[p.branch],
      stemHan: STEM_HAN[p.stem], stemKo: STEM_KO[p.stem],
      branchHan: BRANCH_HAN[p.branch], branchKo: BRANCH_KO[p.branch],
      stemElem: elemOfStem(p.stem), branchElem: elemOfBranch(p.branch)
    };
  }

  global.Saju = {
    computeChart: computeChart,
    computeDaeun: computeDaeun,
    tenGod: tenGod,
    STEM_HAN: STEM_HAN, STEM_KO: STEM_KO,
    BRANCH_HAN: BRANCH_HAN, BRANCH_KO: BRANCH_KO,
    STEM_ELEM: STEM_ELEM, BRANCH_ELEM: BRANCH_ELEM,
    ELEM_KO: ELEM_KO, ELEM_HAN: ELEM_HAN, ELEM_COLOR: ELEM_COLOR,
    HIDDEN: HIDDEN, ZODIAC: ZODIAC, STAGE_NAMES: STAGE_NAMES,
    GROUP_OF: GROUP_OF, pillarLabel: pillarLabel, stageOf: stageOf,
    yearPillarAt: yearPillarAt, monthPillarAt: monthPillarAt
  };
})(typeof window !== 'undefined' ? window : globalThis);
