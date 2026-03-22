/**
 * aura2 — vanilla frontend (Screen 1: Auth)
 * API: same origin on Render, or <meta name="aura-api-base" content="https://...">
 */
(function () {
  'use strict';

  var LS = {
    token: 'aura2_token',
    alias: 'aura2_alias',
    spaceId: 'aura2_spaceId',
    projectId: 'aura2_projectId',
  };
  var SS_PENDING = 'aura2_pending_register';

  function apiBase() {
    var meta = document.querySelector('meta[name="aura-api-base"]');
    var fromMeta = meta && meta.getAttribute('content');
    fromMeta = (fromMeta || '').trim().replace(/\/$/, '');
    if (fromMeta) return fromMeta;
    if (typeof location !== 'undefined' && location.origin && location.origin !== 'null') {
      return location.origin.replace(/\/$/, '');
    }
    throw new Error('Cannot determine API URL. Open this app from your server, or set meta aura-api-base.');
  }

  function normalizeAlias(s) {
    return String(s || '')
      .trim()
      .toLowerCase();
  }

  function looksLikeHtml(t) {
    if (!t || typeof t !== 'string') return false;
    var s = t.slice(0, 256).trim().toLowerCase();
    return s.indexOf('<!doctype') === 0 || s.indexOf('<html') === 0;
  }

  /** When CDN/proxy returns HTML (e.g. Render 502), avoid stuffing the whole page into errors. */
  function htmlGatewayPayload(res, text) {
    var titleMatch = text.match(/<title>([^<]{0,120})<\/title>/i);
    var pageTitle = titleMatch ? titleMatch[1].trim() : '';
    var hint =
      res.status === 502
        ? '502 Bad Gateway: Render could not reach your Node app. Open Render → your service → Logs. Check startup crashes, MONGODB_URI, build/start command, and that the server listens on 0.0.0.0 and process.env.PORT. Free-tier services sleep until the first request.'
        : res.status === 503 || res.status === 504
          ? 'Service temporarily unavailable — try again shortly.'
          : 'The API URL may be wrong, or only static files are served (no backend on that host).';
    return {
      error: 'Server returned an HTML page instead of JSON.',
      httpStatus: res.status,
      pageTitle: pageTitle || undefined,
      hint: hint,
    };
  }

  function formatError(data) {
    if (!data || typeof data !== 'object') return String(data);
    if (data.error === 'Validation failed' && Array.isArray(data.details)) {
      return data.details
        .map(function (d) {
          return (d.path || '?') + ': ' + d.message;
        })
        .join('\n');
    }
    var parts = [];
    if (data.error) parts.push(data.error);
    if (data.pageTitle) parts.push('Page title: ' + data.pageTitle);
    if (data.hint) parts.push(data.hint);
    if (parts.length) return parts.join('\n');
    return data.message || JSON.stringify(data);
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {object} [opts]
   * @param {object} [opts.body]
   * @param {boolean} [opts.auth]
   */
  async function api(method, path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (opts.auth) {
      var t = localStorage.getItem(LS.token);
      if (!t) throw new Error('Not signed in.');
      headers['Authorization'] = 'Bearer ' + t;
    }
    var url = apiBase() + path;
    var res = await fetch(url, {
      method: method,
      headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    var text = await res.text();
    var contentType = (res.headers.get('content-type') || '').toLowerCase();
    var isHtml = looksLikeHtml(text) || contentType.indexOf('text/html') >= 0;

    if (isHtml) {
      var htmlData = htmlGatewayPayload(res, text);
      var htmlErr = new Error(formatError(htmlData) + ' (HTTP ' + res.status + ')');
      htmlErr.status = res.status;
      htmlErr.data = htmlData;
      throw htmlErr;
    }

    var data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      var snippet = text ? text.slice(0, 200) + (text.length > 200 ? '…' : '') : '(empty body)';
      var parseErr = new Error('Response was not valid JSON (HTTP ' + res.status + ').\n' + snippet);
      parseErr.status = res.status;
      parseErr.data = { error: 'Invalid JSON', snippet: snippet };
      throw parseErr;
    }

    if (!res.ok) {
      var err = new Error(formatError(data) + ' (HTTP ' + res.status + ')');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return { status: res.status, data: data };
  }

  function $(id) {
    return document.getElementById(id);
  }

  function show(el, on) {
    if (!el) return;
    el.classList.toggle('hidden', !on);
  }

  function setBackDisabled(disabled, title) {
    var back = $('btn-back');
    if (!back) return;
    back.disabled = !!disabled;
    back.title = title || '';
  }

  function setSignOutState(enabled) {
    var out = $('btn-sign-out');
    if (!out) return;
    out.disabled = !enabled;
    out.title = enabled ? 'Clear session and return to login' : 'Not signed in';
  }

  function showScreen(name) {
    var auth = $('screen-auth');
    var seed = $('screen-seed');
    var dash = $('screen-dashboard');
    [auth, seed, dash].forEach(function (s) {
      s.classList.remove('screen--active');
      s.classList.add('hidden');
    });
    var tok = !!localStorage.getItem(LS.token);
    if (name === 'auth') {
      auth.classList.remove('hidden');
      auth.classList.add('screen--active');
      setBackDisabled(true, 'Home — use forms below');
      setSignOutState(tok);
      updateAuthBanner();
    } else if (name === 'seed') {
      seed.classList.remove('hidden');
      seed.classList.add('screen--active');
      setBackDisabled(false, '');
      setSignOutState(true);
    } else if (name === 'dashboard') {
      dash.classList.remove('hidden');
      dash.classList.add('screen--active');
      setBackDisabled(false, 'Return to home (stay signed in)');
      setSignOutState(true);
      var al = localStorage.getItem(LS.alias) || '—';
      $('dash-alias').textContent = al;
    }
  }

  function updateAuthBanner() {
    var tok = localStorage.getItem(LS.token);
    var al = localStorage.getItem(LS.alias);
    var banner = $('auth-session-banner');
    if (tok && al) {
      $('auth-session-text').textContent = 'You are signed in as ' + al + '.';
      show(banner, true);
    } else {
      show(banner, false);
    }
  }

  function setAlert(id, msg) {
    var el = $(id);
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      show(el, true);
    } else {
      el.textContent = '';
      show(el, false);
    }
  }

  function setPre(id, obj) {
    var el = $(id);
    if (!el) return;
    if (obj === null || obj === undefined) {
      el.textContent = '';
      show(el, false);
      return;
    }
    el.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    el.classList.remove('response-block--error');
    show(el, true);
  }

  function sanitizeErrDataForDisplay(d) {
    if (!d || typeof d !== 'object') return d;
    var out = {};
    for (var k in d) {
      if (!Object.prototype.hasOwnProperty.call(d, k)) continue;
      var v = d[k];
      if (typeof v === 'string' && v.length > 800) {
        out[k] = '[truncated — ' + v.length + ' chars; see message above]';
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  function setPreError(id, err) {
    var el = $(id);
    if (!el) return;
    var body = err && err.message ? err.message : String(err);
    if (err && err.data) {
      body += '\n\n' + JSON.stringify(sanitizeErrDataForDisplay(err.data), null, 2);
    }
    el.textContent = body;
    el.classList.add('response-block--error');
    show(el, true);
  }

  function clearRegisterUi() {
    setAlert('register-error', '');
    $('register-response').textContent = '';
    $('register-response').classList.remove('response-block--error');
    show($('register-response'), false);
  }

  function clearLoginUi() {
    setAlert('login-error', '');
    show($('login-response'), false);
    $('login-response').textContent = '';
  }

  function validateRegisterAlias(alias) {
    if (alias.length < 3) return 'Alias must be at least 3 characters.';
    if (!/^[a-z0-9_-]+$/.test(alias)) {
      return 'Alias may only contain lowercase letters, numbers, underscores, and hyphens.';
    }
    return '';
  }

  function ensureIdSlots() {
    if (localStorage.getItem(LS.spaceId) === null) localStorage.setItem(LS.spaceId, '');
    if (localStorage.getItem(LS.projectId) === null) localStorage.setItem(LS.projectId, '');
  }

  function saveSession(alias, token) {
    localStorage.setItem(LS.token, token);
    localStorage.setItem(LS.alias, alias);
    ensureIdSlots();
  }

  function clearSession() {
    localStorage.removeItem(LS.token);
    localStorage.removeItem(LS.alias);
    sessionStorage.removeItem(SS_PENDING);
  }

  function readPending() {
    try {
      var raw = sessionStorage.getItem(SS_PENDING);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writePending(o) {
    sessionStorage.setItem(SS_PENDING, JSON.stringify(o));
  }

  function clearPending() {
    sessionStorage.removeItem(SS_PENDING);
  }

  function goDashboardAfterAuth(responseData) {
    setPre('dashboard-response', responseData || { ok: true });
    showScreen('dashboard');
  }

  // ——— Events ———
  document.getElementById('form-register').addEventListener('submit', async function (e) {
    e.preventDefault();
    clearRegisterUi();
    var alias = normalizeAlias($('reg-alias').value);
    var password = $('reg-password').value;
    var verr = validateRegisterAlias(alias);
    if (verr) {
      setAlert('register-error', verr);
      return;
    }
    if (!password || password.length < 8) {
      setAlert('register-error', 'Password must be at least 8 characters.');
      return;
    }
    $('btn-register').disabled = true;
    try {
      var result = await api('POST', '/auth/register', { body: { alias: alias, password: password } });
      // Do not save JWT until user confirms seed (sessionStorage only)
      writePending({
        token: result.data.token,
        alias: result.data.alias,
        seedPhrase: result.data.seedPhrase,
        fullResponse: result.data,
      });
      $('seed-phrase-box').textContent = result.data.seedPhrase || '(missing — contact support)';
      $('seed-saved-check').checked = false;
      $('btn-seed-confirm').disabled = true;
      var forDisplay = JSON.parse(JSON.stringify(result.data));
      if (forDisplay.token) forDisplay.token = '(stored after you confirm — redacted)';
      setPre('seed-response', forDisplay);
      showScreen('seed');
    } catch (err) {
      setAlert('register-error', err.message);
      setPreError('register-response', err);
    } finally {
      $('btn-register').disabled = false;
    }
  });

  document.getElementById('form-login').addEventListener('submit', async function (e) {
    e.preventDefault();
    clearLoginUi();
    var alias = normalizeAlias($('login-alias').value);
    var password = $('login-password').value;
    if (!alias || !password) {
      setAlert('login-error', 'Enter alias and password.');
      return;
    }
    $('btn-login').disabled = true;
    try {
      var result = await api('POST', '/auth/login', { body: { alias: alias, password: password } });
      clearPending();
      saveSession(result.data.alias, result.data.token);
      setPre('login-response', result.data);
      goDashboardAfterAuth(result.data);
    } catch (err) {
      setAlert('login-error', err.message);
      setPreError('login-response', err);
    } finally {
      $('btn-login').disabled = false;
    }
  });

  $('seed-saved-check').addEventListener('change', function () {
    $('btn-seed-confirm').disabled = !$('seed-saved-check').checked;
  });

  $('btn-seed-confirm').addEventListener('click', function () {
    var p = readPending();
    if (!p || !p.token || !p.alias) {
      clearPending();
      showScreen('auth');
      setAlert('register-error', 'Registration data missing. Please register again.');
      return;
    }
    saveSession(p.alias, p.token);
    clearPending();
    goDashboardAfterAuth(p.fullResponse);
  });

  $('btn-back').addEventListener('click', function () {
    var seed = $('screen-seed');
    if (seed && seed.classList.contains('screen--active')) {
      if (window.confirm('Go back? Your account was created — you can log in with your password. Pending seed confirmation will be cleared.')) {
        clearPending();
        $('seed-saved-check').checked = false;
        $('btn-seed-confirm').disabled = true;
        showScreen('auth');
      }
      return;
    }
    if ($('screen-dashboard').classList.contains('screen--active')) {
      showScreen('auth');
      updateAuthBanner();
    }
  });

  $('btn-sign-out').addEventListener('click', function () {
    clearSession();
    clearPending();
    $('seed-saved-check').checked = false;
    $('btn-seed-confirm').disabled = true;
    showScreen('auth');
    updateAuthBanner();
  });

  $('btn-continue-session').addEventListener('click', function () {
    goDashboardAfterAuth({ resumed: true, alias: localStorage.getItem(LS.alias) });
  });

  // Boot
  window.addEventListener('DOMContentLoaded', function () {
    try {
      apiBase();
    } catch (e) {
      setAlert('register-error', e.message);
      setAlert('login-error', e.message);
    }
    if (localStorage.getItem(LS.token)) {
      ensureIdSlots();
      updateAuthBanner();
    }
    showScreen('auth');
  });
})();
