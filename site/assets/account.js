// Account page: email-code sign-in, watchlist, alert settings, downloads.
(function () {
  'use strict';
  var root = document.getElementById('account');
  if (!root) return;
  var $ = function (sel) { return root.querySelector(sel); };
  var signin = $('[data-view="signin"]');
  var dash = $('[data-view="dashboard"]');
  var msg = signin.querySelector('.form-msg');
  var state = null;
  var names = {};

  function api(path, opts) {
    opts = opts || {};
    return fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) { data._status = r.status; return data; });
    });
  }

  function fmtDate(iso) {
    return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  }

  function show(data) {
    state = data;
    signin.hidden = true;
    dash.hidden = false;
    var status = $('[data-status]');
    var manage = $('[data-manage]');
    manage.textContent = '';
    if (data.pro) {
      var s = data.status === 'on_trial' ? 'Pro (free trial)' : data.status === 'cancelled' ? 'Pro (cancelled, access until ' + fmtDate(data.endsAt) + ')' : 'Pro';
      status.textContent = 'Signed in as ' + data.email + '. Plan: ' + s + '.';
    } else {
      status.textContent = 'Signed in as ' + data.email + '. You do not have an active Pro subscription.';
      var checkout = root.getAttribute('data-checkout');
      if (checkout) {
        var a = document.createElement('a');
        a.className = 'button';
        a.href = checkout + (checkout.indexOf('?') === -1 ? '?' : '&') + 'checkout[email]=' + encodeURIComponent(data.email);
        a.textContent = 'Start free trial';
        manage.appendChild(a);
      }
    }
    if (data.portalUrl) {
      var p = document.createElement('a');
      p.href = data.portalUrl;
      p.textContent = 'Manage billing or cancel';
      p.rel = 'noopener';
      if (manage.childNodes.length) manage.appendChild(document.createTextNode(' '));
      manage.appendChild(p);
    }
    root.querySelectorAll('[data-pro-only]').forEach(function (el) { el.hidden = !data.pro; });
    $('[data-alerts]').checked = data.alertsEnabled;
    renderWatchlist();
    if (data.pro) {
      var pending = null;
      try { pending = localStorage.getItem('tm-pending-watch'); localStorage.removeItem('tm-pending-watch'); } catch (e) { /* ignore */ }
      if (pending && /^\d{4,6}[A-Z]?$/.test(pending) && data.watchlist.indexOf(pending) === -1) saveWatchlist(data.watchlist.concat([pending]));
    }
  }

  function renderWatchlist() {
    var ul = $('[data-watchlist]');
    ul.textContent = '';
    if (!state.watchlist.length) {
      var li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'No companies yet. Add some above.';
      ul.appendChild(li);
      return;
    }
    state.watchlist.forEach(function (code) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '/company/' + encodeURIComponent(code) + '/';
      a.textContent = (names[code] || code) + ' (' + code + ')';
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'button secondary';
      rm.style.cssText = 'padding:2px 8px;margin-left:8px;font-size:0.8rem';
      rm.textContent = 'Remove';
      rm.setAttribute('aria-label', 'Remove ' + code);
      rm.addEventListener('click', function () { saveWatchlist(state.watchlist.filter(function (c) { return c !== code; })); });
      li.appendChild(a);
      li.appendChild(rm);
      ul.appendChild(li);
    });
  }

  function saveWatchlist(codes) {
    var wmsg = $('[data-watch-msg]');
    return api('/watchlist', { method: 'PUT', body: { codes: codes } }).then(function (r) {
      if (r._status === 200) { state.watchlist = r.watchlist; renderWatchlist(); wmsg.textContent = 'Saved.'; }
      else wmsg.textContent = r.error || 'Could not save.';
    });
  }

  function load() {
    return api('/me').then(function (r) {
      if (r._status === 200) show(r);
      else { signin.hidden = false; dash.hidden = true; }
    });
  }

  var signinForm = $('[data-signin]');
  var verifyForm = $('[data-verify]');
  var email = '';
  signinForm.addEventListener('submit', function (e) {
    e.preventDefault();
    email = signinForm.email.value.trim();
    msg.textContent = 'Sending…';
    api('/auth/start', { method: 'POST', body: { email: email } }).then(function (r) {
      if (r._status === 200) { msg.textContent = 'Check your inbox for a 6-digit code.'; verifyForm.hidden = false; verifyForm.code.focus(); }
      else msg.textContent = r.error || 'Could not send a code.';
    });
  });
  verifyForm.addEventListener('submit', function (e) {
    e.preventDefault();
    api('/auth/verify', { method: 'POST', body: { email: email, code: verifyForm.code.value.trim() } }).then(function (r) {
      if (r._status === 200) { msg.textContent = ''; load(); }
      else msg.textContent = r.error || 'Sign-in failed.';
    });
  });
  $('[data-signout]').addEventListener('click', function () {
    api('/auth/signout', { method: 'POST', body: {} }).then(function () { location.reload(); });
  });
  $('[data-alerts]').addEventListener('change', function (e) {
    api('/settings', { method: 'PUT', body: { alertsEnabled: e.target.checked } }).then(function () { $('[data-watch-msg]').textContent = 'Saved.'; });
  });

  // Watchlist add box with the shared company search.
  var addForm = $('[data-add]');
  var addInput = addForm.querySelector('input');
  var addResults = addForm.querySelector('.search-results');
  function add(row) {
    names[row[0]] = row[1];
    addInput.value = '';
    addResults.hidden = true;
    var max = Number(root.getAttribute('data-max')) || 50;
    if (state.watchlist.indexOf(row[0]) !== -1) return;
    if (state.watchlist.length >= max) { $('[data-watch-msg]').textContent = 'Your watchlist is full (' + max + ' companies).'; return; }
    saveWatchlist(state.watchlist.concat([row[0]]));
  }
  addInput.addEventListener('input', function () {
    window.TM.loadIndex().then(function (idx) { window.TM.renderResults(addResults, window.TM.search(idx, addInput.value, 8), add); });
  });
  addForm.addEventListener('submit', function (e) {
    e.preventDefault();
    window.TM.loadIndex().then(function (idx) { var r = window.TM.search(idx, addInput.value, 1); if (r.length) add(r[0]); });
  });

  root.querySelectorAll('[data-download]').forEach(function (a) {
    a.href = '/api/download/' + a.getAttribute('data-download') + '.csv';
  });

  // Company names for the watchlist display.
  if (window.TM) window.TM.loadIndex().then(function (idx) { idx.forEach(function (r) { names[r[0]] = r[1]; }); if (state) renderWatchlist(); });
  load();
})();
