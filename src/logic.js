/*
 * tori-no-taigun-muse - pure game logic (no DOM, no Audio).
 * Works in the browser (window.ToriLogic) and in Node.js for tests.
 * All music, characters and code in this project are original.
 */
(function (global) {
  'use strict';

  var BPM = 120;
  var BEAT_SEC = 60 / BPM; // 0.5s
  var INTRO_BEATS = 4; // birds fly in / count-in before the first bar
  var PERFECT_WINDOW_SEC = 0.09;
  var GOOD_WINDOW_SEC = 0.18;

  /*
   * Chart: 16 bars x 8 beats.
   * Each bar lists the beats (0-7) that require a player input.
   * Types: most notes are "step"; bars listed in JUMP_BARS are "jump"
   * (the flock squats and jumps together). Exactly 50 notes in total,
   * so PERFECT(2pt) x 50 = 100 points max.
   */
  var BAR_PATTERNS = [
    [], // bar 0: intro march, no input
    [0, 2, 4, 6], // 4  (4)
    [0, 2, 4, 6], // 4  (8)
    [2, 6], //       2 jump (10)
    [0, 2, 4, 6], // 4  (14)
    [0, 2, 4, 6], // 4  (18)
    [0, 2, 5, 6], // 4 syncopation (22)
    [0, 4], //       2 jump (24)
    [0, 2, 4, 6], // 4  (28)
    [0, 1, 2, 4, 6], // 5 quick steps (33)
    [0, 2, 4, 6], // 4  (37)
    [4], //          1 big jump (38)
    [0, 2, 3, 4, 6], // 5 (43)
    [0, 2, 4, 6], // 4  (47)
    [0, 4, 7], //    3 finale (50)
    [] // bar 15: outro, birds fly away
  ];
  var JUMP_BARS = { 3: true, 7: true, 11: true };
  var FINALE_BAR = 14;

  function buildChart() {
    var notes = [];
    BAR_PATTERNS.forEach(function (pattern, bar) {
      pattern.forEach(function (beatInBar) {
        var beat = INTRO_BEATS + bar * 8 + beatInBar;
        var type = 'step';
        if (JUMP_BARS[bar]) type = 'jump';
        if (bar === FINALE_BAR && beatInBar === 7) type = 'jump';
        notes.push({ beat: beat, time: beat * BEAT_SEC, bar: bar, type: type });
      });
    });
    return notes;
  }

  var CHART = buildChart();
  var TOTAL_NOTES = CHART.length; // 50
  var MAX_SCORE = TOTAL_NOTES * 2; // 100
  var SONG_BEATS = INTRO_BEATS + 16 * 8; // 132 beats
  var SONG_DURATION_SEC = SONG_BEATS * BEAT_SEC; // 66 seconds

  /* Cue beats: one bar (with voice cue) before each jump bar / finale. */
  function buildCues() {
    var cues = [];
    Object.keys(JUMP_BARS).forEach(function (bar) {
      cues.push({ beat: INTRO_BEATS + (Number(bar) - 1) * 8 + 4, kind: 'jump' });
    });
    cues.push({ beat: INTRO_BEATS + (FINALE_BAR - 1) * 8 + 4, kind: 'finale' });
    return cues.sort(function (a, b) { return a.beat - b.beat; });
  }

  /** Judge one input. offsetSec = inputTime - noteTime (negative = early). */
  function judge(offsetSec) {
    var abs = Math.abs(offsetSec);
    if (abs <= PERFECT_WINDOW_SEC) return { result: 'perfect', points: 2 };
    if (abs <= GOOD_WINDOW_SEC) return { result: 'good', points: 1 };
    return { result: 'miss', points: 0 };
  }

  function rankFor(score) {
    if (score >= 90) return { id: 'perfect', label: 'パーフェクト級！ 群れと完全シンクロ' };
    if (score >= 70) return { id: 'high', label: 'ハイレベル！ 息がぴったり' };
    if (score >= 40) return { id: 'ok', label: '平凡。群れについて行けた' };
    return { id: 'retry', label: 'やりなおし。リズムを聞いてもう一度' };
  }

  function buildShareText(score, counts) {
    return (
      '鳥の大群みたいなリズムゲーム（非公式ファンメイド）で ' +
      score +
      ' / 100 点でした！ ' +
      '（ピッタリ ' + counts.perfect + ' / 普通 ' + counts.good + ' / 失敗 ' + counts.miss + '） ' +
      '#鳥の大群風ゲーム'
    );
  }

  function buildShareUrl(score, counts, pageUrl) {
    var text = buildShareText(score, counts);
    var url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
    if (pageUrl) url += '&url=' + encodeURIComponent(pageUrl);
    return url;
  }

  var api = {
    BPM: BPM,
    BEAT_SEC: BEAT_SEC,
    INTRO_BEATS: INTRO_BEATS,
    PERFECT_WINDOW_SEC: PERFECT_WINDOW_SEC,
    GOOD_WINDOW_SEC: GOOD_WINDOW_SEC,
    BAR_PATTERNS: BAR_PATTERNS,
    CHART: CHART,
    TOTAL_NOTES: TOTAL_NOTES,
    MAX_SCORE: MAX_SCORE,
    SONG_BEATS: SONG_BEATS,
    SONG_DURATION_SEC: SONG_DURATION_SEC,
    buildChart: buildChart,
    buildCues: buildCues,
    judge: judge,
    rankFor: rankFor,
    buildShareText: buildShareText,
    buildShareUrl: buildShareUrl
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ToriLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
