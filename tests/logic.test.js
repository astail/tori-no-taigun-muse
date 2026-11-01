'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/logic.js');

test('chart has exactly 50 notes so max score is 100', () => {
  assert.equal(L.TOTAL_NOTES, 50);
  assert.equal(L.MAX_SCORE, 100);
  assert.equal(L.CHART.length, 50);
});

test('chart times are strictly increasing and inside the song', () => {
  for (let i = 1; i < L.CHART.length; i++) {
    assert.ok(L.CHART[i].time > L.CHART[i - 1].time, `note ${i} out of order`);
  }
  const last = L.CHART[L.CHART.length - 1];
  assert.ok(last.time < L.SONG_DURATION_SEC);
});

test('song is about one minute', () => {
  assert.ok(L.SONG_DURATION_SEC >= 55 && L.SONG_DURATION_SEC <= 75,
    `duration was ${L.SONG_DURATION_SEC}s`);
});

test('judging windows: perfect 2pt, good 1pt, miss 0pt', () => {
  assert.deepEqual(L.judge(0), { result: 'perfect', points: 2 });
  assert.deepEqual(L.judge(0.09), { result: 'perfect', points: 2 });
  assert.deepEqual(L.judge(-0.09), { result: 'perfect', points: 2 });
  assert.deepEqual(L.judge(0.1), { result: 'good', points: 1 });
  assert.deepEqual(L.judge(-0.18), { result: 'good', points: 1 });
  assert.deepEqual(L.judge(0.19), { result: 'miss', points: 0 });
  assert.deepEqual(L.judge(-1), { result: 'miss', points: 0 });
});

test('a perfect run scores exactly 100', () => {
  const total = L.CHART.reduce((sum) => sum + L.judge(0).points, 0);
  assert.equal(total, 100);
});

test('chart contains jump notes and step notes', () => {
  const types = new Set(L.CHART.map((n) => n.type));
  assert.ok(types.has('step') && types.has('jump'));
});

test('cues exist before jump sections', () => {
  const cues = L.buildCues();
  assert.ok(cues.length >= 3);
  cues.forEach((c) => assert.ok(c.beat < L.SONG_BEATS));
});

test('rank thresholds', () => {
  assert.equal(L.rankFor(100).id, 'perfect');
  assert.equal(L.rankFor(70).id, 'high');
  assert.equal(L.rankFor(40).id, 'ok');
  assert.equal(L.rankFor(0).id, 'retry');
});

test('share URL is properly encoded and targets X intent', () => {
  const url = L.buildShareUrl(82, { perfect: 30, good: 22, miss: 0 }, 'https://example.com/game/?a=1&b=2');
  assert.ok(url.startsWith('https://twitter.com/intent/tweet?text='));
  assert.ok(url.includes('82'));
  assert.ok(!url.includes(' '), 'URL must not contain raw spaces');
  assert.ok(url.includes(encodeURIComponent('https://example.com/game/?a=1&b=2')));
});
