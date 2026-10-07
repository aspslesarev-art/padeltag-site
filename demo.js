(function () {
  var T = window.PT_T || {};
  var TAG = (document.querySelector('img.pt-float') || {}).getAttribute ? document.querySelector('img.pt-float').getAttribute('src') : '/tag.png';
  var fills = ['#D4F03C', '#FFC2B0'];
  var names = [T.us || 'Us', T.them || 'Them'];
  var players = T.players || ['Alex', 'Maya', 'Leo', 'Nina'];
  var s, clicks = {}, timers = {}, flashT;
  var touched = false; // пока не нажали ни разу — теги пульсируют: «жми сюда»

  function fresh(mode) { return { mode: mode, pts: [0, 0], pp: [0, 0, 0, 0], hist: [] }; }
  function label(p) { return ['0', '15', '30', '40'][Math.min(p, 3)]; }
  function word(v) { return (T.words || { '0': 'love', '15': 'fifteen', '30': 'thirty', '40': 'forty' })[v]; }
  function q(t) { return (T.q1 || '"') + t + (T.q2 || '"'); }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function $(id) { return document.getElementById(id); }
  function clearClicks() { for (var k in timers) clearTimeout(timers[k]); clicks = {}; timers = {}; }
  function slots() { return s.mode === 1 ? [0] : s.mode === 2 ? [0, 2] : [0, 1, 2, 3]; }

  function say(t) { $('pt-said').textContent = t; }

  // Звук: щелчок кнопки сразу и голос счёта из приложения (записи Андрея) на языке страницы.
  // Web Audio: включается первым нажатием и потом играет и после паузы на двойное нажатие (iPhone тоже).
  var LANG = document.documentElement.lang || 'en';
  var CLIPS = ['game', 'golden', 'undo'];
  ['0', '15', '30', '40'].forEach(function (a) { ['0', '15', '30', '40'].forEach(function (b) {
    if (a !== b || (a !== '0' && a !== '40')) CLIPS.push('p_' + a + '_' + b);
  }); });
  var ctx = null, buf = {}, voice = null;
  function audio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    CLIPS.forEach(function (k) {
      fetch('/voice/' + LANG + '/' + k + '.m4a').then(function (r) { if (!r.ok) throw r.status; return r.arrayBuffer(); })
        .then(function (data) { return new Promise(function (ok, bad) { ctx.decodeAudioData(data, ok, bad); }); })
        .then(function (b) { buf[k] = b; })
        .catch(function (e) { console.warn('PadelTag voice', k, e); });
    });
    return ctx;
  }
  function tick() {
    var c = audio(); if (!c) return;
    var t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.08);
  }
  function speak(k) {
    if (!ctx || !buf[k]) return;
    if (voice) { try { voice.stop(); } catch (e) {} }
    voice = ctx.createBufferSource(); voice.buffer = buf[k]; voice.connect(ctx.destination); voice.start();
  }

  function renderScore() {
    for (var t = 0; t < 2; t++) {
      $('pt-score-' + t).textContent = label(s.pts[t]);
      var box = $('pt-players-' + t);
      box.className = 'pt-players' + (s.mode === 4 ? ' on' : '');
      box.innerHTML = '';
      [t * 2, t * 2 + 1].forEach(function (p) {
        var sp = document.createElement('span');
        sp.textContent = players[p] + ' ';
        var b = document.createElement('b'); b.textContent = s.pp[p];
        sp.appendChild(b); box.appendChild(sp);
      });
    }
  }

  function flash(team) {
    var el = $('pt-panel-' + team);
    el.classList.add('flash');
    clearTimeout(flashT);
    flashT = setTimeout(function () { el.classList.remove('flash'); }, 400);
  }

  function renderTags() {
    var wrap = $('pt-tags'); wrap.innerHTML = '';
    wrap.style.gridTemplateColumns = s.mode === 4 ? 'repeat(2, minmax(0, 1fr))' : '';
    slots().forEach(function (slot) {
      var team = Math.floor(slot / 2);
      var name = s.mode === 1 ? T.score_btn || 'Score button' : s.mode === 2 ? names[team] : players[slot];
      var b = document.createElement('button');
      b.className = 'pt-card pt-tag' + (touched ? '' : ' hint');
      // Каждый тег «пикает» в своё время и в своём ритме — вразнобой, а не хором.
      b.style.setProperty('--hl', (Math.random() * 3).toFixed(2) + 's');
      b.style.setProperty('--hd', (2.4 + Math.random() * 1.6).toFixed(2) + 's');
      b.setAttribute('aria-label', (T.click_aria || 'Click button: ') + name);
      b.innerHTML = '<span class="pt-glow" style="background:' + (s.mode === 1 ? '#F1F5E8' : fills[team]) + '"><img src="' + TAG + '" alt=""></span>' +
        '<span class="pt-name"><span class="pt-dot" style="background:' + (s.mode === 1 ? '#15201A' : (team === 0 ? '#8FB31C' : '#FF8C6B')) + '"></span></span>';
      b.querySelector('.pt-name').appendChild(document.createTextNode(name));
      b.addEventListener('click', function () {
        b.classList.add('down');
        setTimeout(function () { b.classList.remove('down'); }, 160);
        if (!touched) { touched = true; var h = document.querySelectorAll('.pt-card.hint'); for (var i = 0; i < h.length; i++) h[i].classList.remove('hint'); }
        tick();
        press(slot);
      });
      wrap.appendChild(b);
    });
    var legend = s.mode === 1
      ? [[1, T.leg_us || 'Point for Us'], [2, T.leg_them || 'Point for Them'], [3, T.leg_undo || 'Undo']]
      : [[1, T.leg_point || 'Point'], [2, T.leg_undo || 'Undo']];
    var lg = $('pt-legend'); lg.innerHTML = '';
    legend.forEach(function (l) {
      var c = document.createElement('div'); c.className = 'pt-chip';
      c.innerHTML = '<span>' + new Array(l[0] + 1).join('<i></i>') + '</span>';
      c.appendChild(document.createTextNode(l[1]));
      lg.appendChild(c);
    });
  }

  function press(slot) {
    var mode = s.mode;
    var n = (clicks[slot] || 0) + 1;
    clicks[slot] = n;
    clearTimeout(timers[slot]);
    if (n >= (mode === 1 ? 3 : 2)) { clicks[slot] = 0; undo(); return; }
    timers[slot] = setTimeout(function () {
      var k = clicks[slot]; clicks[slot] = 0;
      if (mode === 1) point(k === 1 ? 0 : 1, null);
      else point(Math.floor(slot / 2), mode === 4 ? slot : null);
    }, 450);
  }

  function point(team, player) {
    s.hist.push({ pts: s.pts.slice(), pp: s.pp.slice() });
    s.pts[team] += 1;
    if (player !== null) s.pp[player] += 1;
    if (s.pts[team] >= 4) { s.pts = [0, 0]; say(q(T.game || 'Game!')); speak('game'); }
    else {
      // Как в приложении: первым называется счёт того, кто взял очко.
      var a = label(s.pts[team]), b = label(s.pts[1 - team]);
      if (a === '40' && b === '40') { say(q(T.golden || 'Golden point')); speak('golden'); }
      else { say(q(cap(word(a)) + (T.sep || ', ') + word(b))); speak('p_' + a + '_' + b); }
    }
    renderScore(); flash(team);
  }

  function undo() {
    if (!s.hist.length) { say(T.nothing || 'Nothing to undo'); return; }
    var last = s.hist.pop();
    s.pts = last.pts; s.pp = last.pp;
    say(q(T.leg_undo || 'Undo')); speak('undo'); renderScore();
  }

  // Высоту кнопок и подсказок держим по самому большому режиму — при переключении экран не прыгает.
  function lockHeights() {
    var keep = s, tags = $('pt-tags'), lg = $('pt-legend'), ht = 0, hl = 0;
    tags.style.minHeight = ''; lg.style.minHeight = '';
    [1, 2, 4].forEach(function (m) {
      s = fresh(m); renderTags();
      ht = Math.max(ht, tags.offsetHeight); hl = Math.max(hl, lg.offsetHeight);
    });
    s = keep; renderTags();
    tags.style.minHeight = ht + 'px'; lg.style.minHeight = hl + 'px';
  }

  function setMode(m) {
    clearClicks(); s = fresh(m);
    var btns = document.querySelectorAll('.pt-mode');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-mode') == m ? 'true' : 'false');
    say(T.said_init || 'Click a button'); renderTags(); renderScore();
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Тег в начале страницы тоже живой: 1 нажатие — очко «нам» на маленьком телефоне, 2 — отмена.
    var ht = $('pt-hero-tag');
    if (ht) {
      var hp = [3, 2], hh = [], hn = 0, htm;
      var show = function (t) {
        for (var i = 0; i < 2; i++) $('pt-hero-' + i).textContent = label(hp[i]);
        var el = $('pt-hero-' + t); el.classList.add('pt-pop');
        setTimeout(function () { el.classList.remove('pt-pop'); }, 160);
      };
      var heroPress = function () {
        tick();
        ht.classList.add('down'); setTimeout(function () { ht.classList.remove('down'); }, 140);
        hn += 1; clearTimeout(htm);
        if (hn >= 2) {
          hn = 0;
          if (hh.length) { hp = hh.pop(); show(0); speak('undo'); }
          return;
        }
        htm = setTimeout(function () {
          hn = 0; hh.push(hp.slice());
          hp[0] += 1;
          if (hp[0] >= 4) { hp = [0, 0]; speak('game'); }
          else {
            var a = label(hp[0]), b = label(hp[1]);
            speak(a === '40' && b === '40' ? 'golden' : 'p_' + a + '_' + b);
          }
          show(0);
        }, 450);
      };
      ht.addEventListener('pointerenter', function () { audio(); }); // голос начнёт грузиться ещё до нажатия
      ht.addEventListener('click', heroPress);
      ht.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); heroPress(); } });
    }
    var btns = document.querySelectorAll('.pt-mode');
    for (var i = 0; i < btns.length; i++) btns[i].addEventListener('click', function () { setMode(+this.getAttribute('data-mode')); });
    $('pt-reset').addEventListener('click', function () { setMode(s.mode); });
    setMode(4);
    // Голос подгружаем, как только блок показался на экране, — к первому нажатию он уже готов.
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { audio(); io.disconnect(); } }, { rootMargin: '300px' });
      io.observe($('try'));
    }
    lockHeights();
    var rt, lastW = innerWidth;
    addEventListener('resize', function () {
      if (innerWidth === lastW) return; lastW = innerWidth;
      clearTimeout(rt); rt = setTimeout(lockHeights, 150);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(lockHeights);
  });
})();
