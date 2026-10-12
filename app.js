// Живое приложение на сайте: главная → «Кто играет?» → табло → «Завершить» → «Мои цифры».
// Повторяет экраны iPhone-приложения в упрощённом виде. Брелки под телефоном нажимаются.
(function () {
  var T = window.PT_T || {}, A = T.app || {};
  var P = T.players || ['Alex', 'Maya', 'Leo', 'Nina'];
  var LANG = document.documentElement.lang || 'en';
  var TEAM = ['#D4F03C', '#FFC2B0'], DOT = ['#8FB31C', '#FF8C6B'];
  var W = 390, H = 844; // экран приложения в точках iPhone, потом масштабируется под рамку
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(s, o) { return String(s || '').replace(/\{(\w+)\}/g, function (_, k) { return o[k]; }); }
  function t(k) { return A[k] == null ? k : A[k]; }
  function pair(a) { return esc(P[a[0]]) + ' · ' + esc(P[a[1]]); }

  // ---------- Звук: щелчок кнопки и голос счёта из приложения ----------
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
        .then(function (d) { return new Promise(function (ok, bad) { ctx.decodeAudioData(d, ok, bad); }); })
        .then(function (b) { buf[k] = b; })
        .catch(function (e) { console.warn('PadelTag voice', k, e); });
    });
    return ctx;
  }
  function tick() {
    var c = audio(); if (!c) return;
    var n = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(1900, n); o.frequency.exponentialRampToValueAtTime(900, n + 0.05);
    g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(0.25, n + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.07);
    o.connect(g); g.connect(c.destination); o.start(n); o.stop(n + 0.08);
  }
  function speak(k) {
    if (!ctx || !buf[k]) return;
    if (voice) { try { voice.stop(); } catch (e) {} }
    voice = ctx.createBufferSource(); voice.buffer = buf[k]; voice.connect(ctx.destination); voice.start();
  }

  // ---------- Состояние ----------
  // slot[s] = какой игрок стоит на месте s. Места 0,1 — команда 1 (левый столбец), 2,3 — команда 2.
  var st = {
    screen: 'home', slot: [0, 1, 2, 3], linked: [0, 0, 0, 0], bat: [85, 62, 91, 74], m: null, sheet: false, seen: 1,
    // Пример прошлых матчей. Я — игрок 0.
    history: [
      { a: [0, 1], b: [2, 3], g: [4, 2], win: 0, pp: [12, 9, 8, 7], when: t('d1') },
      { a: [0, 2], b: [1, 3], g: [2, 4], win: 1, pp: [8, 11, 6, 10], when: t('d2') },
      { a: [0, 3], b: [1, 2], g: [5, 4], win: 0, pp: [13, 10, 11, 9], when: t('d3') }
    ]
  };
  function slotOf(p) { return st.slot.indexOf(p); }
  function teamOf(p) { return slotOf(p) < 2 ? 0 : 1; }
  function teamPlayers(team) { return [st.slot[team * 2], st.slot[team * 2 + 1]]; }
  function newMatch() { return { pts: [0, 0], games: [0, 0], tb: false, pp: [0, 0, 0, 0], hist: [], winner: null, t0: Date.now() }; }

  var STEP = { home: 1, lobby: 2, score: 3, win: 4, numbers: 5 };
  var app, timeT;

  // ---------- Общие куски экрана ----------
  var ICON = {
    plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
    people: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.2A5 5 0 0 1 21.5 19"/></svg>',
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    play: '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5Z"/></svg>',
    cup: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>'
  };
  function status(dark) {
    return '<div class="pa-status' + (dark ? ' dark' : '') + '"><span>9:41</span><i class="pa-island"></i>' +
      '<span class="pa-sig"><b></b><b></b><b></b><b></b><em></em></span></div>';
  }
  function matchCard(h, fresh) {
    return '<div class="pa-mc' + (fresh ? ' fresh' : '') + '"><div class="pa-mc-top"><span class="pa-pill">' + esc(t('onphone')) + '</span><b>' + h.g[0] + ':' + h.g[1] + '</b><span class="pa-mc-when">' + esc(h.when) + '</span></div>' +
      '<div class="pa-mc-w">' + esc(t('win')) + ': ' + pair(h.win === 0 ? h.a : h.b) + '</div>' +
      '<div class="pa-mc-l">' + esc(t('vs')) + ': ' + pair(h.win === 0 ? h.b : h.a) + '</div></div>';
  }

  // ---------- Экраны ----------
  function show(screen) {
    st.screen = screen; st.sheet = false;
    clearInterval(timeT); clearClicks();
    var html = '';
    if (screen === 'home') {
      html = status() + '<div class="pa-home">' +
        '<div class="pa-head"><span class="pa-logo"><i></i>PadelTag</span><span class="pa-round">' + ICON.plus + '</span><span class="pa-round">' + ICON.gear + '</span></div>' +
        '<button class="pa-me" data-go="numbers"><span class="pa-av">' + esc(P[0].charAt(0)) + '</span><span class="pa-me-t"><b>' + esc(P[0]) + '</b><span>' + esc(t('mine')) + '</span></span>' + ICON.chev + '</button>' +
        '<div class="pa-sec"><span>' + esc(t('recent')) + '</span></div>' +
        '<div class="pa-list">' + st.history.slice(0, 3).map(function (h, i) { return matchCard(h, i === 0 && h.fresh); }).join('') + '</div>' +
        '<button class="pa-play" data-go="lobby"><span class="pa-play-i">' + ICON.play + '</span><span><b>' + esc(t('play')) + '</b><small>' + esc(t('play_sub')) + '</small></span></button>' +
        '</div>';
    } else if (screen === 'lobby') {
      html = status() + '<div class="pa-dim"></div><div class="pa-sheet pa-lobby">' +
        '<div class="pa-grab"></div>' +
        '<div class="pa-lhead"><span class="pa-pill big">' + esc(t('fast')) + '</span><button class="pa-x" data-go="home" aria-label="' + esc(t('close')) + '">' + ICON.close + '</button></div>' +
        '<div class="pa-h1">' + esc(t('who')) + '</div>' +
        '<div class="pa-tl"><span>' + esc(t('team1')) + '</span><span>' + esc(t('team2')) + '</span></div>' +
        '<div class="pa-grid" id="pa-grid">' + [0, 1, 2, 3].map(function (p) { return '<div class="pa-card" data-p="' + p + '"></div>'; }).join('') + '</div>' +
        '<p class="pa-note">' + esc(t('drag_hint')) + '</p>' +
        '<button class="pa-start" id="pa-start" data-go="score"></button>' +
        '</div>';
    } else if (screen === 'score') {
      if (!st.m || st.m.winner !== null) st.m = newMatch();
      html = status(true) + '<div class="pa-score">' +
        '<div class="pa-bar"><span class="pa-pill light">' + esc(t('set_chip')) + '</span><span class="pa-time" id="pa-time">0:00</span><span class="pa-round light">' + ICON.people + '</span><span class="pa-round light">' + ICON.gear + '</span></div>' +
        [0, 1].map(function (tm) {
          var pl = teamPlayers(tm);
          return '<button class="pa-half" data-team="' + tm + '" id="pa-half' + tm + '" style="background:' + TEAM[tm] + '" aria-label="' + esc(fmt(t('point_for'), { n: P[pl[0]] + ' · ' + P[pl[1]] })) + '">' +
            '<span class="pa-names"><span><b id="pa-pp' + pl[0] + '">0</b>' + esc(P[pl[0]]) + '</span><span><b id="pa-pp' + pl[1] + '">0</b>' + esc(P[pl[1]]) + '</span></span>' +
            '<span class="pa-big" id="pa-big' + tm + '">0</span>' +
            '<span class="pa-foot"><span>' + esc(t('games')) + ' <b id="pa-g' + tm + '">0</b></span><span class="pa-tb" id="pa-tb' + tm + '">' + esc(t('tiebreak')) + '</span></span>' +
            '</button>';
        }).join('') +
        '<div class="pa-said" id="pa-said" aria-live="polite"></div>' +
        '<div class="pa-btns"><button id="pa-undo">' + esc(t('undo')) + '</button><button id="pa-end">' + esc(t('end')) + '</button></div>' +
        '</div><div id="pa-over"></div>';
    } else if (screen === 'win') {
      var h = st.history[0];
      html = status(true) + '<div class="pa-win">' +
        '<div class="pa-wcard" style="background:' + TEAM[h.win] + '"><span class="pa-wcup">' + ICON.cup + '</span><span class="pa-wl">' + esc(t('win')) + '</span>' +
        '<b class="pa-wn">' + pair(h.win === 0 ? h.a : h.b) + '</b><span class="pa-ws">' + h.g[0] + ':' + h.g[1] + '</span></div>' +
        '<div class="pa-saved">' + ICON.check + esc(t('saved')) + '</div>' +
        '<div class="pa-wbtns"><button class="pa-wb main" data-go="numbers">' + esc(t('finish')) + '</button><button class="pa-wb" data-go="score">' + esc(t('again')) + '</button></div>' +
        '</div>';
    } else if (screen === 'numbers') {
      html = status() + '<div class="pa-num">' + numbersHtml() + '</div>';
    }
    app.innerHTML = html;
    app.setAttribute('data-screen', screen);
    if (screen === 'lobby') layoutCards();
    if (screen === 'score') { renderScore(); timeT = setInterval(renderTime, 1000); }
    st.seen = Math.max(st.seen, STEP[screen]);
    renderSteps(); renderTags(); renderTip();
  }

  function numbersHtml() {
    var me = 0, n = st.history.length, wins = 0, pts = 0, mate = {};
    function side(h) { var mine = h.a.indexOf(me) >= 0 ? 0 : 1, my = mine === 0 ? h.a : h.b; return { mine: mine, partner: my[0] === me ? my[1] : my[0], rivals: mine === 0 ? h.b : h.a }; }
    st.history.forEach(function (h) {
      var sd = side(h);
      if (h.win === sd.mine) { wins++; mate[sd.partner] = (mate[sd.partner] || 0) + 1; }
      pts += h.pp ? h.pp[me] : h.pts;
    });
    var best = null; for (var k in mate) if (best === null || mate[k] > mate[best]) best = k;
    var pct = n ? Math.round(wins * 100 / n) : 0;
    // Последний матч: с кем, против кого, сколько очков взял каждый (их считают теги).
    var h = st.history[0], sd = side(h), won = h.win === sd.mine, sum = h.pp ? h.pp.reduce(function (a, b) { return a + b; }, 0) : 0;
    var max = h.pp ? Math.max.apply(null, h.pp) || 1 : 1;
    var bars = sum ? h.a.concat(h.b).map(function (p, i) {
      var tm = i < 2 ? 0 : 1;
      return '<div class="pa-pr"><span class="pa-prn' + (p === me ? ' me' : '') + '">' + esc(P[p]) + '</span><span class="pa-prb"><i style="width:' + Math.round(h.pp[p] * 100 / max) + '%;background:' + (tm === 0 ? '#B9D62A' : '#FF9F80') + '"></i></span><b>' + h.pp[p] + '</b></div>';
    }).join('') : '<p class="pa-demo" style="margin:0">' + esc(t('pts_none')) + '</p>';
    return '<button class="pa-back" data-go="home" aria-label="' + esc(t('home')) + '">' + ICON.back + '</button>' +
      '<div class="pa-h1 xl">' + esc(t('mine')) + '</div>' +
      '<div class="pa-last' + (h.fresh ? ' fresh' : '') + '">' +
      '<div class="pa-lt"><span>' + esc(t('last')) + ' · ' + esc(h.when) + '</span><span class="pa-res' + (won ? ' w' : '') + '">' + esc(won ? t('win') : t('loss')) + ' ' + h.g[sd.mine] + ':' + h.g[1 - sd.mine] + '</span></div>' +
      '<div class="pa-lr"><span>' + esc(t('partner')) + '</span><b>' + esc(P[sd.partner]) + '</b></div>' +
      '<div class="pa-lr"><span>' + esc(t('rivals')) + '</span><b>' + pair(sd.rivals) + '</b></div>' +
      '<div class="pa-k" style="margin:12px 0 6px">' + esc(t('pts_by')) + '</div>' + bars +
      '</div>' +
      '<div class="pa-tiles">' +
      '<div class="pa-tile" style="background:#D4F03C"><b>' + n + '</b><span>' + esc(t('matches')) + '</span></div>' +
      '<div class="pa-tile" style="background:#1F4FA3;color:#FFFFFF"><b>' + pct + '%</b><span>' + esc(fmt(t('wins_n'), { n: wins })) + '</span></div>' +
      '<div class="pa-tile" style="background:#F1F5E8"><b>' + (n ? Math.round(pts / n) : 0) + '</b><span>' + esc(t('points')) + '</span></div>' +
      '<div class="pa-tile" style="background:#FFC2B0"><b class="sm">' + (best === null ? '-' : esc(P[best])) + '</b><span>' + esc(t('best')) + '</span></div>' +
      '</div>' +
      '<div class="pa-sec"><span>' + esc(t('history')) + '</span></div>' +
      '<div class="pa-list">' + st.history.slice(1, 4).map(function (x) { return matchCard(x); }).join('') + '</div>' +
      '<p class="pa-demo">' + esc(t('demo')) + '</p>';
  }

  // ---------- «Кто играет?»: карточки и перетаскивание пальцем ----------
  var GAP = 8, CW = (W - 40 - GAP) / 2, CH = 150, drag = null;
  var RTL = document.documentElement.dir === 'rtl'; // справа налево команда 1 стоит справа, как подписи над карточками
  function slotPos(s) { var col = s < 2 ? 0 : 1; if (RTL) col = 1 - col; return { x: col * (CW + GAP), y: (s % 2) * (CH + GAP) }; }
  function layoutCards() {
    var grid = $('pa-grid'); if (!grid) return;
    var cards = grid.querySelectorAll('.pa-card');
    for (var i = 0; i < cards.length; i++) {
      var el = cards[i], p = +el.getAttribute('data-p'), s = slotOf(p), pos = slotPos(s), eff = s, lift = false;
      if (drag && drag.on) {
        if (p === drag.p) { pos = { x: slotPos(drag.from).x + drag.dx, y: slotPos(drag.from).y + drag.dy }; eff = drag.target == null ? drag.from : drag.target; lift = true; }
        else if (drag.target === s) { pos = slotPos(drag.from); eff = drag.from; }
      }
      el.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)' + (lift ? ' scale(1.05)' : '');
      el.style.background = TEAM[eff < 2 ? 0 : 1];
      el.classList.toggle('lift', lift);
      el.classList.toggle('linked', !!st.linked[p]);
      var key = p + ':' + st.linked[p];
      if (el.getAttribute('data-k') !== key) {
        el.setAttribute('data-k', key);
        el.innerHTML = '<span class="pa-cav">' + esc(P[p].charAt(0)) + '</span>' +
          (st.linked[p] ? '<span class="pa-bat"><i style="width:' + st.bat[p] + '%"></i></span><span class="pa-batn">' + st.bat[p] + '%</span>' : '') +
          '<span class="pa-grip" aria-hidden="true"></span>' +
          '<b class="pa-cn">' + esc(P[p]) + '</b>' +
          (st.linked[p] ? '<span class="pa-cs ok">' + ICON.check + esc(t('tag_ok')) + '</span>' : '<span class="pa-cs"><i></i>' + esc(t('press_tag')) + '</span>');
      }
    }
    var n = st.linked.reduce(function (a, b) { return a + b; }, 0), b = $('pa-start');
    if (b) b.textContent = n ? fmt(t('start'), { n: n }) : t('start0');
  }
  function nearest(fx, fy) {
    var best = null, bd = 1e9;
    for (var s = 0; s < 4; s++) {
      var o = slotPos(s), gx = Math.max(o.x - fx, 0, fx - (o.x + CW)), gy = Math.max(o.y - fy, 0, fy - (o.y + CH)), d = Math.hypot(gx, gy);
      if (d < bd) { bd = d; best = s; }
    }
    return bd < 40 ? best : null;
  }
  function scale() { return app.getBoundingClientRect().width / W; }
  function cardDown(e) {
    var el = e.target.closest('.pa-card'); if (!el || (e.button && e.button > 0)) return;
    var p = +el.getAttribute('data-p');
    drag = { p: p, from: slotOf(p), x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, on: false, target: null, id: e.pointerId, el: el };
    try { el.setPointerCapture(e.pointerId); } catch (er) {}
  }
  function cardMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var k = scale(), dx = (e.clientX - drag.x0) / k, dy = (e.clientY - drag.y0) / k;
    if (!drag.on && Math.hypot(dx, dy) < 6) return;
    if (!drag.on) { drag.on = true; app.classList.add('dragging'); }
    e.preventDefault();
    drag.dx = dx; drag.dy = dy;
    var r = $('pa-grid').getBoundingClientRect();
    var tg = nearest((e.clientX - r.left) / k, (e.clientY - r.top) / k); // цель — место под кончиком пальца
    drag.target = tg === drag.from ? null : tg;
    layoutCards();
  }
  function cardUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null; app.classList.remove('dragging');
    if (d.on && d.target != null) {
      var q = st.slot[d.target]; st.slot[d.target] = d.p; st.slot[d.from] = q;
      renderTags();
    }
    layoutCards();
  }

  // ---------- Табло ----------
  function label(m, tm) { return m.tb ? String(m.pts[tm]) : ['0', '15', '30', '40'][Math.min(m.pts[tm], 3)]; }
  function word(v) { return (T.words || { '0': 'love', '15': 'fifteen', '30': 'thirty', '40': 'forty' })[v]; }
  function q(s) { return (T.q1 || '"') + s + (T.q2 || '"'); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var saidT;
  function said(s) {
    var el = $('pa-said'); if (!el) return;
    el.textContent = s; el.classList.add('on');
    clearTimeout(saidT); saidT = setTimeout(function () { el.classList.remove('on'); }, 1600);
  }
  function renderScore() {
    var m = st.m; if (!m || !$('pa-big0')) return;
    for (var tm = 0; tm < 2; tm++) {
      $('pa-big' + tm).textContent = label(m, tm);
      $('pa-g' + tm).textContent = m.games[tm];
      $('pa-tb' + tm).classList.toggle('on', m.tb);
    }
    for (var p = 0; p < 4; p++) { var b = $('pa-pp' + p); if (b) b.textContent = m.pp[p]; }
    renderTime();
  }
  function renderTime() {
    var el = $('pa-time'); if (!el || !st.m) return;
    var s = Math.floor((Date.now() - st.m.t0) / 1000);
    el.textContent = Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2);
  }
  function flash(tm) {
    var el = $('pa-half' + tm); if (!el) return;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }
  function point(tm, player) {
    var m = st.m; if (!m || m.winner !== null || st.sheet) return;
    m.hist.push(JSON.stringify({ pts: m.pts, games: m.games, tb: m.tb, pp: m.pp }));
    m.pts[tm]++; if (player != null) m.pp[player]++;
    var a = m.pts[tm], b = m.pts[1 - tm];
    var won = m.tb ? (a >= 7 && a - b >= 2) : a >= 4; // золотое очко: при 40:40 следующее решает гейм
    if (won) {
      m.pts = [0, 0]; m.games[tm]++;
      m.winner = tm; // на сайте матч идёт до одного гейма — чтобы дойти до победы за минуту
      said(q(T.game || 'Game!')); speak('game');
    } else if (m.tb) {
      said(a + ' - ' + b);
    } else {
      var la = label(m, tm), lb = label(m, 1 - tm);
      if (la === '40' && lb === '40') { said(q(T.golden || 'Golden point')); speak('golden'); }
      else { said(q(cap(word(la)) + (T.sep || ', ') + word(lb))); speak('p_' + la + '_' + lb); }
    }
    renderScore(); flash(tm);
    if (m.winner !== null) setTimeout(function () { finish(m.winner); }, 900);
  }
  function undo() {
    var m = st.m; if (!m || st.sheet) return;
    if (!m.hist.length) { said(T.nothing || 'Nothing to undo'); return; }
    var l = JSON.parse(m.hist.pop()); m.pts = l.pts; m.games = l.games; m.tb = l.tb; m.pp = l.pp;
    said(q(T.leg_undo || 'Undo')); speak('undo'); renderScore();
  }
  function finish(tm) {
    var m = st.m;
    var g = m.games.slice();
    if (m.winner === null) { // закончили раньше: победитель по выбору, в счёт идут сыгранные геймы
      m.winner = tm;
    }
    st.history.unshift({ a: teamPlayers(0), b: teamPlayers(1), g: g, win: tm, pp: m.pp.slice(), when: t('just'), fresh: true });
    show('win');
  }
  function openEnd() {
    var m = st.m; if (!m) return;
    var sd = $('pa-said'); if (sd) sd.classList.remove('on');
    st.sheet = true;
    var line = m.games[0] + ':' + m.games[1] + ((m.pts[0] || m.pts[1]) ? ' · ' + label(m, 0) + ':' + label(m, 1) : '');
    $('pa-over').innerHTML = '<div class="pa-dim on" data-act="cont"></div><div class="pa-sheet pa-end">' +
      '<div class="pa-grab"></div><div class="pa-h2">' + esc(t('end_t')) + '</div>' +
      '<div class="pa-sub">' + esc(t('now')) + esc(line) + '</div>' +
      '<div class="pa-k">' + esc(t('who_won')) + '</div>' +
      [0, 1].map(function (tm) {
        return '<button class="pa-wbtn" data-act="win" data-team="' + tm + '" style="background:' + TEAM[tm] + '"><span><small>' + esc(t('win')) + '</small><b>' + pair(teamPlayers(tm)) + '</b></span>' + ICON.cup + '</button>';
      }).join('') +
      '<p class="pa-note">' + esc(t('end_note')) + '</p>' +
      '<button class="pa-abandon" data-act="abandon"><b>' + esc(t('abandon')) + '</b><small>' + esc(t('abandon_d')) + '</small></button>' +
      '<button class="pa-cont" data-act="cont">' + esc(t('cont')) + '</button></div>';
    st.seen = Math.max(st.seen, 4); renderSteps(); renderTip();
  }
  function closeEnd() { st.sheet = false; $('pa-over').innerHTML = ''; renderSteps(); renderTip(); }

  // ---------- Брелки под телефоном ----------
  var clicks = {}, timers = {};
  function clearClicks() { for (var k in timers) clearTimeout(timers[k]); clicks = {}; timers = {}; }
  function renderTags() {
    var box = $('pa-tags'); if (!box) return;
    var hint = st.screen === 'lobby' || (st.screen === 'score' && !st.sheet);
    box.innerHTML = '';
    st.slot.forEach(function (p, s) {
      var tm = s < 2 ? 0 : 1, b = document.createElement('button');
      b.className = 'pa-tag' + ((st.screen === 'lobby' && !st.linked[p]) || (st.screen === 'score' && !st.m.hist.length && !st.sheet) ? ' hint' : '');
      b.style.setProperty('--hl', (s * 0.45).toFixed(2) + 's');
      b.setAttribute('aria-label', (T.click_aria || 'Click button: ') + P[p]);
      b.innerHTML = '<span class="pa-tag-i" style="background:' + TEAM[tm] + '"><img src="/tag.png" alt="" width="64" height="64"></span><span class="pa-tag-n"><i style="background:' + DOT[tm] + '"></i></span>';
      b.querySelector('.pa-tag-n').appendChild(document.createTextNode(P[p]));
      b.addEventListener('click', function () {
        b.classList.add('down'); setTimeout(function () { b.classList.remove('down'); }, 160);
        tagPress(p);
      });
      box.appendChild(b);
    });
    box.classList.toggle('idle', !hint);
  }
  function tagPress(p) {
    tick();
    if (st.screen === 'lobby') {
      if (!st.linked[p]) { st.linked[p] = 1; layoutCards(); renderTags(); renderTip(); }
      var el = document.querySelector('.pa-card[data-p="' + p + '"]');
      if (el) { el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping'); }
      return;
    }
    if (st.screen === 'score' && !st.sheet && st.m.winner === null) {
      var n = (clicks[p] || 0) + 1; clicks[p] = n; clearTimeout(timers[p]);
      if (n >= 2) { clicks[p] = 0; undo(); return; }
      timers[p] = setTimeout(function () {
        clicks[p] = 0; point(teamOf(p), p);
        var hn = document.querySelectorAll('.pa-tag.hint'); for (var i = 0; i < hn.length; i++) hn[i].classList.remove('hint');
      }, 450);
      return;
    }
    nudge();
  }
  function nudge() { // нажали брелок не там, где он нужен — подсказка под телефоном вздрагивает
    var el = $('pa-tip'); if (!el) return;
    el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge');
  }
  function renderTip() {
    var el = $('pa-tip'); if (!el) return;
    var k = st.screen === 'score' && st.sheet ? 'end' : st.screen === 'lobby' && st.linked.indexOf(0) < 0 ? 'lobby_ok' : st.screen;
    el.textContent = A.tips ? A.tips[k] || '' : '';
  }
  // Теги открываются под тем шагом, где их жмут: «Кто играет» (привязать) и «Играй» (очки).
  // На остальных шагах их нет. На узком экране — под текстом шага, над телефоном.
  var wide = window.matchMedia('(min-width: 960px)'), tagsAt = null;
  function placeTags() {
    var tags = $('pa-tags'); if (!tags) return;
    var n = st.screen === 'lobby' ? 2 : st.screen === 'score' && !st.sheet ? 3 : 0;
    var at = n ? (wide.matches ? 'li' + n : 'side' + n) : 'none';
    if (at === tagsAt) return;
    tagsAt = at;
    if (!n) { tags.hidden = true; return; }
    var dest = wide.matches ? document.querySelector('.pa-step[data-step="' + n + '"]').parentNode : null;
    if (dest) dest.appendChild(tags);
    else { var ol = document.querySelector('.pa-steps'); ol.parentNode.insertBefore(tags, ol.nextSibling); }
    tags.hidden = false;
    tags.classList.remove('pa-in'); void tags.offsetWidth; tags.classList.add('pa-in');
  }
  function renderSteps() {
    placeTags();
    var cur = st.screen === 'score' && st.sheet ? 4 : STEP[st.screen];
    var li = document.querySelectorAll('.pa-step');
    for (var i = 0; i < li.length; i++) {
      var n = +li[i].getAttribute('data-step');
      li[i].classList.toggle('on', n === cur);
      li[i].classList.toggle('done', n < cur);
      li[i].setAttribute('aria-current', n === cur ? 'step' : 'false');
    }
    var c = $('pa-count'); if (c) c.textContent = fmt(t('step_of'), { n: cur, all: 5 });
  }
  function goStep(n) {
    if (n === 1) show('home');
    else if (n === 2) show('lobby');
    else if (n === 3) show('score');
    else if (n === 4) { if (st.screen !== 'score') show('score'); openEnd(); }
    else show('numbers');
  }

  // ---------- Масштаб и события ----------
  function fit() {
    var scr = app.parentNode, k = scr.clientWidth / W;
    app.style.transform = 'scale(' + k + ')';
    scr.style.height = Math.round(H * k) + 'px';
  }
  document.addEventListener('DOMContentLoaded', function () {
    app = $('pa-app'); if (!app) return;
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(app.parentNode); else addEventListener('resize', fit);
    app.addEventListener('click', function (e) {
      audio();
      var go = e.target.closest('[data-go]'), act = e.target.closest('[data-act]'), half = e.target.closest('.pa-half');
      if (go) { show(go.getAttribute('data-go')); return; }
      if (act) {
        var a = act.getAttribute('data-act');
        if (a === 'cont') closeEnd();
        else if (a === 'abandon') { st.m = null; show('home'); }
        else if (a === 'win') finish(+act.getAttribute('data-team'));
        return;
      }
      if (half) { tick(); point(+half.getAttribute('data-team'), null); return; }
      if (e.target.closest('#pa-undo')) { tick(); undo(); return; }
      if (e.target.closest('#pa-end')) { openEnd(); }
    });
    app.addEventListener('pointerdown', function (e) { if (st.screen === 'lobby') cardDown(e); });
    app.addEventListener('pointermove', cardMove);
    app.addEventListener('pointerup', cardUp);
    app.addEventListener('pointercancel', cardUp);
    var steps = document.querySelectorAll('.pa-step');
    for (var i = 0; i < steps.length; i++) steps[i].addEventListener('click', function () { audio(); goStep(+this.getAttribute('data-step')); });
    if (wide.addEventListener) wide.addEventListener('change', function () { tagsAt = null; placeTags(); });
    var rs = $('pa-restart');
    if (rs) rs.addEventListener('click', function () { st.slot = [0, 1, 2, 3]; st.linked = [0, 0, 0, 0]; st.m = null; show('home'); });
    show('home');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { audio(); io.disconnect(); } }, { rootMargin: '300px' });
      io.observe(app);
    }
  });
})();
