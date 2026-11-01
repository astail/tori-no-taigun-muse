/*
 * tori-no-taigun-muse - game runtime (DOM + Web Audio).
 * Original code, characters and music. No external resources are loaded,
 * no user data is collected or sent anywhere.
 */
(function () {
  'use strict';
  var L = window.ToriLogic;

  /* ---------------- flock ---------------- */
  var BIRD_COLORS = [
    { body: '#ffe066', dark: '#f4a950' },
    { body: '#95d5b2', dark: '#52b788' },
    { body: '#a2d2ff', dark: '#5e9bd6' },
    { body: '#ff8fb2', dark: '#e56b93' }, // player (pink)
    { body: '#ffc8a2', dark: '#e08e45' },
    { body: '#caffbf', dark: '#7fbc5e' },
    { body: '#bdb2ff', dark: '#7d6fd1' }
  ];
  var PLAYER_INDEX = 3;

  var flockEl = document.getElementById('flock');
  var template = document.getElementById('bird-template');
  var birds = [];
  BIRD_COLORS.forEach(function (c, i) {
    var node = template.content.firstElementChild.cloneNode(true);
    node.style.setProperty('--bird-color', c.body);
    node.style.setProperty('--bird-dark', c.dark);
    if (i === PLAYER_INDEX) node.classList.add('is-player');
    flockEl.appendChild(node);
    birds.push(node);
  });
  var playerBird = birds[PLAYER_INDEX];
  var npcBirds = birds.filter(function (_, i) { return i !== PLAYER_INDEX; });

  /* ---------------- UI refs ---------------- */
  var $ = function (id) { return document.getElementById(id); };
  var stageEl = $('stage'), scoreEl = $('score'), comboEl = $('combo');
  var cueBanner = $('cue-banner'), cueText = $('cue-text');
  var startPanel = $('start-panel'), resultPanel = $('result-panel');
  var judgeResult = $('judge-result'), judgeDetail = $('judge-detail');
  var gaugeMarker = $('gauge-marker'), historyEl = $('history');
  var progressBar = $('progress-bar');

  /* ---------------- audio ---------------- */
  var audio = null;
  function createAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    var ctx = new Ctx();
    var master = ctx.createGain();
    master.gain.value = 0.42;
    var comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    return { ctx: ctx, master: master };
  }
  function tone(opts) {
    if (!audio) return;
    var ctx = audio.ctx, t = opts.time;
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = opts.type || 'triangle';
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t + opts.dur);
    var peak = opts.gain || 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    osc.connect(g); g.connect(audio.master);
    osc.start(t); osc.stop(t + opts.dur + 0.05);
  }
  function noiseBurst(opts) {
    if (!audio) return;
    var ctx = audio.ctx, t = opts.time, dur = opts.dur;
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var filter = ctx.createBiquadFilter();
    filter.type = opts.type || 'bandpass';
    filter.frequency.setValueAtTime(opts.from || 800, t);
    if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    filter.Q.value = opts.q || 1;
    var g = ctx.createGain(); g.gain.value = opts.gain || 0.2;
    src.connect(filter); filter.connect(g); g.connect(audio.master);
    src.start(t);
  }
  /* Synthesized bird voice: quick pitch-swept syllables (no samples used). */
  function birdSyllable(time, from, to, dur, gain) {
    tone({ time: time, freq: from, glideTo: to, dur: dur, type: 'sawtooth', gain: (gain || 0.06) * 0.6 });
    tone({ time: time, freq: from * 2, glideTo: to * 2, dur: dur, type: 'triangle', gain: gain || 0.06 });
  }
  function playCueVoice(time) {
    // 「ピーピャコ　ピャッコ」 (the "ビャー！" is the jump itself)
    birdSyllable(time + 0.0, 1500, 2100, 0.13, 0.07); // ピー
    birdSyllable(time + 0.25, 1300, 1900, 0.09, 0.06); // ピャ
    birdSyllable(time + 0.36, 1100, 1500, 0.1, 0.06); // コ
    birdSyllable(time + 0.55, 1350, 1950, 0.09, 0.07); // ピャッ
    birdSyllable(time + 0.68, 1050, 1450, 0.12, 0.07); // コ
  }
  function playByaa(time, strong) {
    birdSyllable(time, 900, 2400, 0.22, strong ? 0.11 : 0.08); // ビャー！
  }
  function playStepSE(time) {
    noiseBurst({ time: time, dur: 0.07, from: 500, type: 'lowpass', gain: 0.12 });
    tone({ time: time, freq: 170, glideTo: 90, dur: 0.08, type: 'sine', gain: 0.12 });
  }
  function playFlapSE(time) {
    noiseBurst({ time: time, dur: 0.28, from: 600, to: 2400, gain: 0.1 });
  }
  function playMissSE(time) {
    tone({ time: time, freq: 420, glideTo: 130, dur: 0.3, type: 'square', gain: 0.05 });
  }

  /* ---------------- music (original, procedural) ---------------- */
  var CHORDS = [
    { bass: 110.0, pad: [220.0, 261.63, 329.63] }, // Am
    { bass: 87.31, pad: [174.61, 220.0, 261.63] }, // F
    { bass: 130.81, pad: [261.63, 329.63, 392.0] }, // C
    { bass: 98.0, pad: [196.0, 246.94, 293.66] } // G
  ];
  // Original pentatonic melody, one entry per beat over a 16-beat phrase. 0 = rest.
  var MELODY = [659.25, 0, 783.99, 0, 880.0, 0, 783.99, 659.25,
                587.33, 0, 659.25, 0, 783.99, 0, 0, 0];
  function scheduleBeat(beat, time) {
    var beatInBar = beat % 8, bar = Math.floor(beat / 8);
    var chord = CHORDS[bar % 4];
    // kick on every beat, snare on 2 & 4, hats off-beat
    tone({ time: time, freq: 150, glideTo: 55, dur: 0.12, type: 'sine', gain: 0.32 });
    if (beat % 4 === 1 || beat % 4 === 3) {
      noiseBurst({ time: time, dur: 0.09, from: 1800, type: 'highpass', gain: 0.1 });
    }
    noiseBurst({ time: time + L.BEAT_SEC / 2, dur: 0.04, from: 6000, type: 'highpass', gain: 0.045 });
    // bass
    var bassFreq = beatInBar % 2 === 0 ? chord.bass : chord.bass * 1.5;
    tone({ time: time, freq: bassFreq, dur: 0.32, type: 'triangle', gain: 0.16 });
    // pad at bar start
    if (beatInBar === 0) {
      chord.pad.forEach(function (f) {
        tone({ time: time, freq: f, dur: L.BEAT_SEC * 8 * 0.95, type: 'sine', gain: 0.028 });
      });
    }
    // melody (quieter during the final silent-ish bar approach is kept simple)
    var m = MELODY[beat % 16];
    if (m) tone({ time: time, freq: m, dur: 0.3, type: 'square', gain: 0.045 });
    // marching step SE from the flock on every beat
    playStepSE(time);
  }

  /* ---------------- game state ---------------- */
  var state = null;
  function newState() {
    return {
      playing: false, finished: false,
      startAt: 0, nextBeat: 0, nextCue: 0,
      notes: L.CHART.map(function (n) {
        return { time: n.time, type: n.type, judged: false, acted: false };
      }),
      nextNoteIdx: 0,
      score: 0, combo: 0,
      counts: { perfect: 0, good: 0, miss: 0 },
      cues: L.buildCues(),
      lastBeatShown: -1, raf: 0, scheduler: 0
    };
  }
  function songTime() { return audio ? audio.ctx.currentTime - state.startAt : 0; }

  function setJudge(result, detail) {
    var label = { perfect: 'ピッタリ！', good: '普通', miss: '失敗…' }[result] || '―';
    judgeResult.textContent = label;
    judgeResult.className = 'judge-result ' + (result || '');
    judgeDetail.textContent = detail || '';
    var dot = document.createElement('i');
    if (result) { dot.className = result; historyEl.appendChild(dot); }
  }
  function showGauge(offsetSec) {
    var pct = 50 + (offsetSec / 0.25) * 50; // gauge range: -250ms .. +250ms
    pct = Math.max(2, Math.min(98, pct));
    gaugeMarker.style.left = pct + '%';
    gaugeMarker.style.opacity = '1';
    setTimeout(function () { gaugeMarker.style.opacity = '0'; }, 650);
  }
  function updateScore() {
    scoreEl.textContent = String(state.score);
    comboEl.textContent = state.combo >= 3 ? state.combo + ' コンボ' : '';
  }
  function doAction(bird, type) {
    bird.classList.remove('do-step', 'do-jump');
    void bird.offsetWidth; // restart animation
    bird.classList.add(type === 'jump' ? 'do-jump' : 'do-step');
  }
  function failBird(bird) {
    bird.classList.remove('fail');
    void bird.offsetWidth;
    bird.classList.add('fail');
    setTimeout(function () { bird.classList.remove('fail'); }, 430);
  }

  function judgeNote(note, offsetSec) {
    var j = L.judge(offsetSec);
    note.judged = true;
    state.counts[j.result] += 1;
    state.score += j.points;
    if (j.result === 'miss') {
      state.combo = 0;
      failBird(playerBird);
      playMissSE(audio.ctx.currentTime);
      setJudge('miss', '押すのが遅れた…');
    } else {
      state.combo += 1;
      doAction(playerBird, note.type);
      var now = audio.ctx.currentTime;
      if (note.type === 'jump') { playFlapSE(now); playByaa(now, j.result === 'perfect'); }
      var ms = Math.round(offsetSec * 1000);
      var when = ms === 0 ? 'ジャスト！' : ms < 0 ? Math.abs(ms) + 'ms はやい' : ms + 'ms おそい';
      setJudge(j.result, when + (note.type === 'jump' ? ' ・ ジャンプ成功！' : ''));
      showGauge(offsetSec);
    }
    updateScore();
  }
  function missNote(note) {
    note.judged = true;
    state.counts.miss += 1;
    state.combo = 0;
    failBird(playerBird);
    if (audio) playMissSE(audio.ctx.currentTime);
    setJudge('miss', '押しそびれた…');
    showGauge(L.GOOD_WINDOW_SEC + 0.05);
    updateScore();
  }

  function handleInput() {
    if (!state || !state.playing || state.finished) return;
    var t = songTime();
    // nearest unjudged note
    var best = null, bestAbs = Infinity;
    for (var i = state.nextNoteIdx; i < state.notes.length; i++) {
      var n = state.notes[i];
      if (n.time - t > L.GOOD_WINDOW_SEC) break;
      if (!n.judged && Math.abs(t - n.time) < bestAbs) { best = n; bestAbs = Math.abs(t - n.time); }
    }
    if (best) {
      judgeNote(best, t - best.time);
    } else {
      // stray input: fail motion, no score change (original games do the same)
      failBird(playerBird);
      judgeDetail.textContent = 'タイミングがちがう！ リズムを聞いてね';
    }
  }

  /* ---------------- main loop & scheduler ---------------- */
  function tick() {
    if (!state.playing) return;
    var t = songTime();
    progressBar.style.width = Math.max(0, Math.min(100, (t / L.SONG_DURATION_SEC) * 100)) + '%';

    // visual marching on each beat
    var beat = Math.floor(t / L.BEAT_SEC);
    if (beat !== state.lastBeatShown && t >= 0) {
      state.lastBeatShown = beat;
      var cls = beat % 2 === 0 ? 'step-a' : 'step-b';
      birds.forEach(function (b) { b.classList.remove('step-a', 'step-b'); b.classList.add(cls); });
    }
    // NPC birds always perform the chart actions exactly on time
    for (var i = state.nextNoteIdx; i < state.notes.length; i++) {
      var n = state.notes[i];
      if (t >= n.time) {
        if (!n.acted) {
          n.acted = true;
          npcBirds.forEach(function (b) { doAction(b, n.type); });
        }
        if (!n.judged && t - n.time > L.GOOD_WINDOW_SEC) missNote(n);
        if (n.judged) state.nextNoteIdx = i + 1;
      } else break;
    }
    if (t > L.SONG_DURATION_SEC + 0.4) { finish(); return; }
    state.raf = requestAnimationFrame(tick);
  }
  function schedule() {
    if (!state.playing || !audio) return;
    var ahead = audio.ctx.currentTime + 0.15;
    while (state.nextBeat < L.SONG_BEATS) {
      var bt = state.startAt + state.nextBeat * L.BEAT_SEC;
      if (bt > ahead) break;
      if (state.nextBeat >= L.INTRO_BEATS) {
        scheduleBeat(state.nextBeat - L.INTRO_BEATS, bt);
      }
      state.nextBeat++;
    }
    while (state.nextCue < state.cues.length) {
      var cue = state.cues[state.nextCue];
      var ct = state.startAt + cue.beat * L.BEAT_SEC;
      if (ct > ahead) break;
      playCueVoice(ct);
      state.nextCue++;
    }
  }

  function start() {
    if (!audio) audio = createAudio();
    if (!audio) { judgeDetail.textContent = 'このブラウザでは音声が使えません'; return; }
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    cancelAnimationFrame(state ? state.raf : 0);
    if (state && state.scheduler) clearInterval(state.scheduler);
    state = newState();
    // reset UI
    scoreEl.textContent = '0'; comboEl.textContent = '';
    historyEl.textContent = ''; progressBar.style.width = '0%';
    setJudge('', '鳥たちが飛んでくるよ…');
    judgeResult.textContent = '―';
    birds.forEach(function (b) { b.classList.remove('fail', 'do-step', 'do-jump'); b.classList.add('flying'); });
    flockEl.classList.remove('fly-out'); void flockEl.offsetWidth;
    flockEl.classList.add('fly-in');
    startPanel.hidden = true; resultPanel.hidden = true;

    state.startAt = audio.ctx.currentTime + 1.7; // fly-in, then the song starts
    state.playing = true;
    setTimeout(function () {
      birds.forEach(function (b) { b.classList.remove('flying'); });
      flockEl.classList.remove('fly-in');
    }, 1650);
    // voice + banner cues are shown from the chart timing in a light timer
    state.cues.forEach(function (cue) {
      var ms = (1.7 + cue.beat * L.BEAT_SEC) * 1000;
      setTimeout(function () {
        if (!state.playing || state.finished) return;
        cueText.textContent = cue.kind === 'finale'
          ? 'さいごだよ！ ピーピャコ ピャッコ ビャー！ ビャー！！'
          : 'ピーピャコ　ピャッコ　ビャー！　ビャー！！';
        cueBanner.hidden = false;
        setTimeout(function () { cueBanner.hidden = true; }, 1900);
      }, ms);
    });
    state.scheduler = setInterval(schedule, 40);
    state.raf = requestAnimationFrame(tick);
  }

  function finish() {
    state.finished = true; state.playing = false;
    clearInterval(state.scheduler);
    flockEl.classList.add('fly-out');
    birds.forEach(function (b) { b.classList.add('flying'); });
    var rank = L.rankFor(state.score);
    $('final-score').textContent = String(state.score);
    $('rank-label').textContent = rank.label;
    $('counts-label').textContent =
      'ピッタリ ' + state.counts.perfect + ' / 普通 ' + state.counts.good + ' / 失敗 ' + state.counts.miss;
    var share = $('share-x');
    share.href = L.buildShareUrl(state.score, state.counts, window.location.href.split('#')[0]);
    setTimeout(function () { resultPanel.hidden = false; }, 900);
    setJudge('', 'おつかれさま！');
  }

  /* ---------------- input ---------------- */
  stageEl.addEventListener('pointerdown', function (ev) {
    if (ev.target.closest('.panel')) return; // buttons inside panels are not game input
    handleInput();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.code === 'Space' || ev.key === ' ') {
      if (ev.repeat) return;
      // do not hijack Space when a button/link is focused (accessibility)
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'BUTTON' || tag === 'A') return;
      ev.preventDefault();
      handleInput();
    }
  });
  $('start-button').addEventListener('click', start);
  $('retry-button').addEventListener('click', start);
})();
