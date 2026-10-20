// Site-wide behaviour: company search, chart tooltips, waitlist form.
// Untrusted text (company names) is always inserted with textContent.
(function () {
  'use strict';
  var build = document.documentElement.getAttribute('data-build') || '';
  var indexPromise = null;
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch('/assets/search-index.json?v=' + build).then(function (r) { return r.json(); }).catch(function () { return []; });
    }
    return indexPromise;
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/[\s().,-]/g, ''); }
  function search(index, q, limit) {
    var n = norm(q);
    if (!n) return [];
    var scored = [];
    for (var i = 0; i < index.length; i++) {
      var row = index[i];
      var code = row[0], en = norm(row[1]), zh = row[2] || '';
      var score = 0;
      if (code === n) score = 100;
      else if (code.indexOf(n) === 0) score = 80;
      else if (en.indexOf(n) === 0) score = 70;
      else if (zh && zh.indexOf(q.trim()) !== -1) score = 65;
      else if (en.indexOf(n) !== -1) score = 50;
      if (score) scored.push([score, row]);
    }
    scored.sort(function (a, b) { return b[0] - a[0] || (a[1][0] < b[1][0] ? -1 : 1); });
    return scored.slice(0, limit || 8).map(function (s) { return s[1]; });
  }
  window.TM = { loadIndex: loadIndex, search: search };

  function renderResults(ul, rows, onPick) {
    ul.textContent = '';
    rows.forEach(function (row) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '/company/' + encodeURIComponent(row[0]) + '/';
      a.textContent = row[1] + ' (' + row[0] + ')' + (row[2] && row[2] !== row[1] ? ' ' + row[2] : '');
      if (onPick) a.addEventListener('click', function (e) { e.preventDefault(); onPick(row); });
      li.appendChild(a);
      ul.appendChild(li);
    });
    ul.hidden = rows.length === 0;
  }
  window.TM.renderResults = renderResults;

  // Header search with keyboard support.
  var input = document.querySelector('[data-search]');
  if (input) {
    var ul = input.parentNode.querySelector('.search-results');
    var active = -1;
    input.addEventListener('focus', loadIndex);
    input.addEventListener('input', function () {
      loadIndex().then(function (idx) { active = -1; renderResults(ul, search(idx, input.value, 8)); });
    });
    input.addEventListener('keydown', function (e) {
      var links = ul.querySelectorAll('a');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!links.length) return;
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        links.forEach(function (l, i) { l.setAttribute('aria-selected', i === active ? 'true' : 'false'); });
      } else if (e.key === 'Enter' && links.length) {
        e.preventDefault();
        window.location.href = links[Math.max(0, active)].href;
      } else if (e.key === 'Escape') {
        ul.hidden = true;
      }
    });
    document.addEventListener('click', function (e) { if (!input.parentNode.contains(e.target)) ul.hidden = true; });
  }

  // Search page.
  var pageResults = document.getElementById('search-page-results');
  if (pageResults) {
    var q = new URLSearchParams(location.search).get('q') || '';
    var box = document.getElementById('q2');
    if (box) box.value = q;
    loadIndex().then(function (idx) {
      var rows = search(idx, q, 50);
      if (rows.length === 1) { location.replace('/company/' + encodeURIComponent(rows[0][0]) + '/'); return; }
      renderResults(pageResults, rows);
      if (!rows.length && q) { var li = document.createElement('li'); li.textContent = 'No companies match “' + q + '”.'; pageResults.appendChild(li); pageResults.hidden = false; }
    });
  }

  // Chart tooltips: every mark has a hit area with data-tip.
  var tip = document.querySelector('.tooltip');
  function showTip(target, x, y) {
    var lines = (target.getAttribute('data-tip') || '').split('\n');
    tip.textContent = '';
    var strong = document.createElement('strong');
    strong.textContent = lines[1] || lines[0];
    tip.appendChild(strong);
    var rest = [lines[0]].concat(lines.slice(2)).filter(Boolean);
    rest.forEach(function (l) { tip.appendChild(document.createElement('br')); tip.appendChild(document.createTextNode(l)); });
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 12));
    var top = y - h - 12 < 8 ? y + 16 : y - h - 12;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  if (tip) {
    document.addEventListener('pointermove', function (e) {
      var t = e.target.closest && e.target.closest('.chart .hit');
      if (t) showTip(t, e.clientX, e.clientY); else tip.hidden = true;
    });
    document.addEventListener('focusin', function (e) {
      if (e.target.matches && e.target.matches('.chart .hit')) {
        var r = e.target.getBoundingClientRect();
        showTip(e.target, r.left + r.width / 2, r.top);
      }
    });
    document.addEventListener('focusout', function () { tip.hidden = true; });
    window.addEventListener('scroll', function () { tip.hidden = true; }, { passive: true });
  }

  // Waitlist forms.
  document.querySelectorAll('[data-waitlist]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = form.querySelector('.form-msg');
      var btn = form.querySelector('button');
      btn.disabled = true;
      fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.value, interest: form.interest ? form.interest.value : '' }),
      }).then(function (r) {
        msg.textContent = r.ok ? 'Thanks — we will email you once when alerts launch.' : 'Sorry, that did not work. Please try again later.';
        if (r.ok) form.email.value = '';
      }).catch(function () {
        msg.textContent = 'Sorry, that did not work. Please try again later.';
      }).then(function () { btn.disabled = false; });
    });
  });

  // Remember a company the visitor wanted to watch, for after checkout/sign-in.
  var watch = new URLSearchParams(location.search).get('watch');
  if (watch) { try { localStorage.setItem('tm-pending-watch', watch); } catch (e) { /* storage unavailable */ } }
})();
