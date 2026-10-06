(function () {
  var TAG = 'tag.png';
  var fills = ['#D4F03C', '#FFC2B0'];
  var names = ['Us', 'Them'];
  var players = ['Alex', 'Maya', 'Leo', 'Nina'];
  var s, clicks = {}, timers = {}, flashT;

  function fresh(mode) { return { mode: mode, pts: [0, 0], pp: [0, 0, 0, 0], hist: [] }; }
  function label(p) { return ['0', '15', '30', '40'][Math.min(p, 3)]; }
  function word(v) { return { '0': 'love', '15': 'fifteen', '30': 'thirty', '40': 'forty' }[v]; }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function $(id) { return document.getElementById(id); }
  function clearClicks() { for (var k in timers) clearTimeout(timers[k]); clicks = {}; timers = {}; }
  function slots() { return s.mode === 1 ? [0] : s.mode === 2 ? [0, 2] : [0, 1, 2, 3]; }

  function say(t) { $('pt-said').textContent = t; }

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
    slots().forEach(function (slot) {
      var team = Math.floor(slot / 2);
      var name = s.mode === 1 ? 'Score button' : s.mode === 2 ? names[team] : players[slot];
      var b = document.createElement('button');
      b.className = 'pt-card pt-tag';
      b.setAttribute('aria-label', 'Click button: ' + name);
      b.innerHTML = '<span class="pt-glow" style="background:' + (s.mode === 1 ? '#F1F5E8' : fills[team]) + '"><img src="' + TAG + '" alt=""></span>' +
        '<span class="pt-name"><span class="pt-dot" style="background:' + (s.mode === 1 ? '#15201A' : (team === 0 ? '#8FB31C' : '#FF8C6B')) + '"></span></span>';
      b.querySelector('.pt-name').appendChild(document.createTextNode(name));
      b.addEventListener('click', function () {
        b.classList.add('down');
        setTimeout(function () { b.classList.remove('down'); }, 160);
        press(slot);
      });
      wrap.appendChild(b);
    });
    var legend = s.mode === 1
      ? [[1, 'Point for Us'], [2, 'Point for Them'], [3, 'Undo']]
      : [[1, 'Point'], [2, 'Undo']];
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
    if (s.pts[team] >= 4) { s.pts = [0, 0]; say('"Game!"'); }
    else {
      var a = label(s.pts[0]), b = label(s.pts[1]);
      say(a === '40' && b === '40' ? '"Golden point"' : '"' + cap(word(a)) + ', ' + word(b) + '"');
    }
    renderScore(); flash(team);
  }

  function undo() {
    if (!s.hist.length) { say('Nothing to undo'); return; }
    var last = s.hist.pop();
    s.pts = last.pts; s.pp = last.pp;
    say('"Undo"'); renderScore();
  }

  function setMode(m) {
    clearClicks(); s = fresh(m);
    var btns = document.querySelectorAll('.pt-mode');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-mode') == m ? 'true' : 'false');
    say('Click a button'); renderTags(); renderScore();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btns = document.querySelectorAll('.pt-mode');
    for (var i = 0; i < btns.length; i++) btns[i].addEventListener('click', function () { setMode(+this.getAttribute('data-mode')); });
    $('pt-reset').addEventListener('click', function () { setMode(s.mode); });
    setMode(2);
  });
})();
