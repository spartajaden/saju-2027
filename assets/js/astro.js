/* ===========================================================================
   astro.js — 천문 계산 (율리우스일 · 태양 황경 · 24절기 · 음양력 변환)
   의존: lunar-data.js (window.LUNAR_DATA)
   =========================================================================== */
(function (global) {
  'use strict';

  var KST = 9; // 한국 표준시 UTC+9

  /* ---------- 율리우스일 ---------- */
  // 그레고리력 날짜 → 율리우스일 번호(정수, 그날 정오 UT)
  function jdn(y, m, d) {
    var a = Math.floor((14 - m) / 12);
    var yy = y + 4800 - a;
    var mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy +
      Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }

  // 한국시간(KST) 날짜·시각 → 율리우스일(UT 기준)
  function jdFromKST(y, m, d, h, mi) {
    h = h || 0; mi = mi || 0;
    return jdn(y, m, d) - 0.5 + (h + mi / 60 - KST) / 24;
  }

  // 율리우스일 → 그레고리력 날짜 (UT)
  function dateFromJD(jd) {
    var z = Math.floor(jd + 0.5);
    var f = jd + 0.5 - z;
    var alpha = Math.floor((z - 1867216.25) / 36524.25);
    var a = z + 1 + alpha - Math.floor(alpha / 4);
    var b = a + 1524;
    var c = Math.floor((b - 122.1) / 365.25);
    var dd = Math.floor(365.25 * c);
    var e = Math.floor((b - dd) / 30.6001);
    var day = b - dd - Math.floor(30.6001 * e) + f;
    var month = e < 14 ? e - 1 : e - 13;
    var year = month > 2 ? c - 4716 : c - 4715;
    return { y: year, m: month, d: Math.floor(day) };
  }

  // 율리우스일 → KST 벽시계 시각
  function kstFromJD(jd) {
    var t = jd + KST / 24 + 0.5;      // 0.5는 정오 기준 보정
    var z = Math.floor(t);
    var frac = t - z;
    var dt = dateFromJD(z - 0.5);
    var minutes = Math.round(frac * 1440);
    var hh = Math.floor(minutes / 60), mm = minutes % 60;
    if (hh === 24) { hh = 0; var nx = dateFromJD(z - 0.5 + 1); dt = nx; }
    return { y: dt.y, m: dt.m, d: dt.d, h: hh, mi: mm };
  }

  function mod(a, n) { return ((a % n) + n) % n; }
  var RAD = Math.PI / 180;

  /* ---------- ΔT (TT − UT, 초) : Espenak & Meeus 다항식 ---------- */
  function deltaT(year) {
    var t;
    if (year >= 2005) { t = year - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    if (year >= 1986) {
      t = year - 2000;
      return 63.86 + 0.3345 * t - 0.060374 * Math.pow(t, 2) + 0.0017275 * Math.pow(t, 3) +
        0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5);
    }
    if (year >= 1961) { t = year - 1975; return 45.45 + 1.067 * t - t * t / 260 - Math.pow(t, 3) / 718; }
    if (year >= 1941) { t = year - 1950; return 29.07 + 0.407 * t - t * t / 233 + Math.pow(t, 3) / 2547; }
    if (year >= 1920) { t = year - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * Math.pow(t, 3); }
    t = year - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * Math.pow(t, 3) - 0.000197 * Math.pow(t, 4);
  }

  /* ---------- 태양 황경 (겉보기) ---------- */
  function sunLongitude(jdUT) {
    var d = dateFromJD(jdUT);
    var jdTT = jdUT + deltaT(d.y + (d.m - 0.5) / 12) / 86400;
    var T = (jdTT - 2451545.0) / 36525;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    var M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    var Mr = M * RAD;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) +
      (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
      0.000289 * Math.sin(3 * Mr);
    var trueLong = L0 + C;
    var omega = 125.04 - 1934.136 * T;
    var lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
    return mod(lambda, 360);
  }

  /* ---------- 24절기 ---------- */
  var TERMS = [
    { name: '입춘', han: '立春', lon: 315, m: 2, d: 4 },
    { name: '우수', han: '雨水', lon: 330, m: 2, d: 19 },
    { name: '경칩', han: '驚蟄', lon: 345, m: 3, d: 6 },
    { name: '춘분', han: '春分', lon: 0, m: 3, d: 21 },
    { name: '청명', han: '淸明', lon: 15, m: 4, d: 5 },
    { name: '곡우', han: '穀雨', lon: 30, m: 4, d: 20 },
    { name: '입하', han: '立夏', lon: 45, m: 5, d: 6 },
    { name: '소만', han: '小滿', lon: 60, m: 5, d: 21 },
    { name: '망종', han: '芒種', lon: 75, m: 6, d: 6 },
    { name: '하지', han: '夏至', lon: 90, m: 6, d: 21 },
    { name: '소서', han: '小暑', lon: 105, m: 7, d: 7 },
    { name: '대서', han: '大暑', lon: 120, m: 7, d: 23 },
    { name: '입추', han: '立秋', lon: 135, m: 8, d: 8 },
    { name: '처서', han: '處暑', lon: 150, m: 8, d: 23 },
    { name: '백로', han: '白露', lon: 165, m: 9, d: 8 },
    { name: '추분', han: '秋分', lon: 180, m: 9, d: 23 },
    { name: '한로', han: '寒露', lon: 195, m: 10, d: 8 },
    { name: '상강', han: '霜降', lon: 210, m: 10, d: 23 },
    { name: '입동', han: '立冬', lon: 225, m: 11, d: 7 },
    { name: '소설', han: '小雪', lon: 240, m: 11, d: 22 },
    { name: '대설', han: '大雪', lon: 255, m: 12, d: 7 },
    { name: '동지', han: '冬至', lon: 270, m: 12, d: 22 },
    { name: '소한', han: '小寒', lon: 285, m: 1, d: 6 },
    { name: '대한', han: '大寒', lon: 300, m: 1, d: 20 }
  ];

  // 특정 황경이 되는 순간(율리우스일 UT)을 뉴턴 반복으로 찾는다.
  function findLonInstant(targetLon, guessJD) {
    var jd = guessJD;
    for (var i = 0; i < 12; i++) {
      var lon = sunLongitude(jd);
      var diff = mod(targetLon - lon + 180, 360) - 180; // [-180, 180)
      jd += diff / 0.9856473;                          // 태양 황경 일변화량
      if (Math.abs(diff) < 1e-8) break;
    }
    return jd;
  }

  // 달력 연도 y의 24절기 (1월 소한·대한 포함), 시각 오름차순
  function termsInYear(y) {
    var out = [];
    for (var i = 0; i < TERMS.length; i++) {
      var t = TERMS[i];
      var yy = (i >= 22) ? y : y;  // 22·23번(소한·대한)은 1월에 오므로 y 그대로
      var guess = jdFromKST(yy, t.m, t.d, 12, 0);
      var jd = findLonInstant(t.lon, guess);
      var kst = kstFromJD(jd);
      out.push({ index: i, name: t.name, han: t.han, lon: t.lon, jd: jd, kst: kst });
    }
    out.sort(function (a, b) { return a.jd - b.jd; });
    return out;
  }

  // birthJD 직전·직후 절기
  function surroundingTerms(birthJD, year) {
    var all = termsInYear(year - 1).concat(termsInYear(year), termsInYear(year + 1));
    all.sort(function (a, b) { return a.jd - b.jd; });
    var prev = null, next = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].jd <= birthJD) prev = all[i];
      else { next = all[i]; break; }
    }
    return { prev: prev, next: next, all: all };
  }

  /* ---------- 음양력 변환 ---------- */
  var DATA = global.LUNAR_DATA || {};
  var cache = {};

  function decode(ly) {
    if (cache[ly]) return cache[ly];
    var e = DATA[String(ly)];
    if (!e) return null;
    var leap = e[0];
    var parts = e[1].split('-');
    var cur = { y: +parts[0], m: +parts[1], d: +parts[2] };
    var lens = e.slice(2);
    var months = [];
    var li = 0;
    for (var m = 1; m <= 12; m++) {
      months.push({ month: m, leap: false, start: cur, days: lens[li] });
      cur = addDays(cur, lens[li]); li++;
      if (leap === m) {
        months.push({ month: m, leap: true, start: cur, days: lens[li] });
        cur = addDays(cur, lens[li]); li++;
      }
    }
    var out = { leap: leap, months: months, start: months[0].start, next: cur };
    cache[ly] = out;
    return out;
  }

  function addDays(dt, n) {
    var j = jdn(dt.y, dt.m, dt.d) + n;
    return dateFromJD(j);
  }

  // 양력 → 음력
  function solarToLunar(y, m, d) {
    var target = jdn(y, m, d);
    for (var ly = y; ly >= y - 1; ly--) {
      var dec = decode(ly);
      if (!dec) continue;
      var s = jdn(dec.start.y, dec.start.m, dec.start.d);
      var e = jdn(dec.next.y, dec.next.m, dec.next.d);
      if (target >= s && target < e) {
        for (var i = dec.months.length - 1; i >= 0; i--) {
          var mo = dec.months[i];
          var ms = jdn(mo.start.y, mo.start.m, mo.start.d);
          if (target >= ms) {
            var mi = target - ms + 1;
            return { year: ly, month: mo.month, day: mi, leap: mo.leap };
          }
        }
      }
    }
    return null;
  }

  // 음력 → 양력
  function lunarToSolar(ly, lm, ld, isLeap) {
    var dec = decode(ly);
    if (!dec) return null;
    for (var i = 0; i < dec.months.length; i++) {
      var mo = dec.months[i];
      if (mo.month === lm && !!mo.leap === !!isLeap) {
        return addDays(mo.start, ld - 1);
      }
    }
    return null;
  }

  // 그 해에 윤달이 있는지 (윤N월 번호, 없으면 0)
  function leapMonthOf(ly) {
    var dec = decode(ly);
    return dec ? dec.leap : 0;
  }

  global.Astro = {
    KST: KST,
    jdn: jdn,
    jdFromKST: jdFromKST,
    kstFromJD: kstFromJD,
    dateFromJD: dateFromJD,
    sunLongitude: sunLongitude,
    TERMS: TERMS,
    termsInYear: termsInYear,
    surroundingTerms: surroundingTerms,
    solarToLunar: solarToLunar,
    lunarToSolar: lunarToSolar,
    leapMonthOf: leapMonthOf,
    addDays: addDays,
    deltaT: deltaT
  };
})(typeof window !== 'undefined' ? window : globalThis);
