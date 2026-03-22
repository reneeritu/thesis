(function () {
  'use strict';

  const LS = {
    token: 'aura2_site_token',
    alias: 'aura2_site_alias',
    spaceId: 'aura2_site_spaceId',
    projectId: 'aura2_site_projectId',
    apiBase: 'aura2_site_apiBase',
  };

  function $(id) {
    return document.getElementById(id);
  }

  function base() {
    const raw = ($('apiBase') && $('apiBase').value.trim()) || '';
    if (raw) return raw.replace(/\/$/, '');
    if (typeof location !== 'undefined' && location.origin && location.origin !== 'null') {
      return location.origin;
    }
    throw new Error('Set the API URL above, or open this page from your deployed server.');
  }

  function token() {
    const t = localStorage.getItem(LS.token) || '';
    return t.trim();
  }

  function setAlert(elId, type, text) {
    const el = $(elId);
    if (!el) return;
    el.className = 'alert ' + (type || '');
    el.textContent = text || '';
    el.hidden = !text;
  }

  function clearAlerts() {
    ['alertWelcome', 'alertAccount', 'alertSpace', 'alertJoin', 'alertProject', 'alertTrace'].forEach(
      function (id) {
        setAlert(id, '', '');
      },
    );
  }

  async function api(method, path, body, useAuth) {
    const url = base() + path;
    const headers = { 'Content-Type': 'application/json' };
    if (useAuth) {
      const t = token();
      if (!t) throw new Error('You need to register or log in first.');
      headers['Authorization'] = 'Bearer ' + t;
    }
    const res = await fetch(url, {
      method: method,
      headers: headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = data.error || data.message || JSON.stringify(data);
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return data;
  }

  let currentStep = 0;
  const totalSteps = 5;

  function updateStepUI() {
    for (let i = 0; i < totalSteps; i++) {
      const btn = $('stepBtn' + i);
      const panel = $('panel' + i);
      if (btn) {
        btn.classList.toggle('active', i === currentStep);
      }
      if (panel) panel.classList.toggle('active', i === currentStep);
    }
    const logged = !!token();
    const alias = localStorage.getItem(LS.alias) || '';
    $('sessionStatus').textContent = logged
      ? 'Signed in as ' + alias
      : 'Not signed in';
    $('btnLogout').hidden = !logged;
  }

  function goStep(n) {
    currentStep = Math.max(0, Math.min(totalSteps - 1, n));
    clearAlerts();
    updateStepUI();
  }

  function saveApiBase() {
    const v = $('apiBase').value.trim();
    if (v) localStorage.setItem(LS.apiBase, v);
  }

  function loadStorage() {
    const b = localStorage.getItem(LS.apiBase);
    if (b && $('apiBase')) $('apiBase').value = b;
    if ($('loginAlias') && localStorage.getItem(LS.alias)) {
      $('loginAlias').value = localStorage.getItem(LS.alias);
    }
    if ($('spaceId') && localStorage.getItem(LS.spaceId)) {
      $('spaceId').value = localStorage.getItem(LS.spaceId);
    }
    if ($('projectId') && localStorage.getItem(LS.projectId)) {
      $('projectId').value = localStorage.getItem(LS.projectId);
    }
  }

  async function pingHealth() {
    const pill = $('healthPill');
    try {
      const r = await fetch(base() + '/health');
      const ok = r.ok;
      pill.textContent = ok ? 'API reachable' : 'API error ' + r.status;
      pill.className = 'status-pill ' + (ok ? 'ok' : 'bad');
    } catch {
      pill.textContent = 'Cannot reach API';
      pill.className = 'status-pill bad';
    }
  }

  function wire() {
    $('apiBase').addEventListener('change', saveApiBase);

    $('btnStart').addEventListener('click', function () {
      saveApiBase();
      pingHealth();
      goStep(1);
    });

    $('btnCheckHealth').addEventListener('click', function () {
      saveApiBase();
      pingHealth();
    });

    $('btnRegister').addEventListener('click', async function () {
      setAlert('alertAccount', '', '');
      try {
        const alias = $('regAlias').value.trim().toLowerCase();
        const password = $('regPassword').value;
        const data = await api('POST', '/auth/register', { alias: alias, password: password }, false);
        localStorage.setItem(LS.token, data.token);
        localStorage.setItem(LS.alias, data.alias || alias);
        $('loginAlias').value = data.alias || alias;
        $('seedReveal').hidden = false;
        $('seedText').textContent = data.seedPhrase || '(no seed returned)';
        setAlert('alertAccount', 'ok', 'Account created. Save your seed phrase below, then continue.');
        updateStepUI();
      } catch (e) {
        setAlert('alertAccount', 'error', e.message || String(e));
      }
    });

    $('btnSavedSeed').addEventListener('click', function () {
      goStep(2);
    });

    $('btnLogin').addEventListener('click', async function () {
      setAlert('alertAccount', '', '');
      try {
        const alias = $('loginAlias').value.trim().toLowerCase();
        const password = $('loginPassword').value;
        const data = await api('POST', '/auth/login', { alias: alias, password: password }, false);
        localStorage.setItem(LS.token, data.token);
        localStorage.setItem(LS.alias, alias);
        setAlert('alertAccount', 'ok', 'Logged in.');
        $('seedReveal').hidden = true;
        updateStepUI();
        goStep(2);
      } catch (e) {
        setAlert('alertAccount', 'error', e.message || String(e));
      }
    });

    $('btnSpace').addEventListener('click', async function () {
      setAlert('alertSpace', '', '');
      try {
        const body = {
          name: $('spaceName').value.trim(),
          description: $('spaceDesc').value.trim() || undefined,
          settings: {
            projectAccess: $('projectAccess').value,
            privacyDefault: $('privacyDefault').value,
          },
        };
        const data = await api('POST', '/spaces', body, true);
        localStorage.setItem(LS.spaceId, data._id);
        $('spaceId').value = data._id;
        setAlert('alertSpace', 'ok', 'Space created. Your space ID is saved — continue to create a project.');
        updateStepUI();
        goStep(3);
      } catch (e) {
        setAlert('alertSpace', 'error', e.message || String(e));
      }
    });

    $('btnJoin').addEventListener('click', async function () {
      setAlert('alertJoin', '', '');
      try {
        const sid = $('joinSpaceId').value.trim();
        if (!sid) throw new Error('Paste the space ID.');
        const code = $('inviteCode').value.trim();
        const body = code ? { inviteCode: code } : {};
        await api('POST', '/spaces/' + encodeURIComponent(sid) + '/join', body, true);
        localStorage.setItem(LS.spaceId, sid);
        $('spaceId').value = sid;
        setAlert('alertJoin', 'ok', 'You joined the space. Next: ask the creator to add you to a project, or create your own space.');
      } catch (e) {
        setAlert('alertJoin', 'error', e.message || String(e));
      }
    });

    $('btnProject').addEventListener('click', async function () {
      setAlert('alertProject', '', '');
      try {
        const sid = $('spaceId').value.trim() || localStorage.getItem(LS.spaceId);
        if (!sid) throw new Error('Create a space first (or paste space ID).');
        const other = $('contributorAlias').value.trim().toLowerCase();
        const contributors = other
          ? [{ alias: other, isPrimary: $('contribPrimary').checked }]
          : [];
        const data = await api(
          'POST',
          '/projects',
          {
            title: $('projTitle').value.trim(),
            spaceId: sid,
            contributors: contributors,
          },
          true,
        );
        localStorage.setItem(LS.projectId, data._id);
        $('projectId').value = data._id;
        setAlert('alertProject', 'ok', 'Project started. Log your first trace next.');
        goStep(4);
      } catch (e) {
        setAlert('alertProject', 'error', e.message || String(e));
      }
    });

    $('btnTrace').addEventListener('click', async function () {
      setAlert('alertTrace', '', '');
      try {
        const pid = $('projectId').value.trim() || localStorage.getItem(LS.projectId);
        if (!pid) throw new Error('Create a project first.');
        const activityType = $('activityType').value;
        const mode = $('mode').value;
        const body = {
          projectId: pid,
          activityType: activityType,
          mode: mode,
          description: $('traceDesc').value.trim() || undefined,
          duration: Number($('duration').value) || 0,
        };
        if (activityType === 'other') {
          body.otherDescription = $('otherDescription').value.trim();
          if (!body.otherDescription) throw new Error('Describe the “other” activity.');
        }
        if (mode === 'proxy') {
          body.proxyForAlias = $('proxyForAlias').value.trim();
          if (!body.proxyForAlias) throw new Error('Proxy mode needs the other person’s alias.');
        }
        await api('POST', '/traces', body, true);
        setAlert('alertTrace', 'ok', 'Trace saved. You can log another or share this site with collaborators.');
      } catch (e) {
        setAlert('alertTrace', 'error', e.message || String(e));
      }
    });

    $('btnLogout').addEventListener('click', function () {
      localStorage.removeItem(LS.token);
      localStorage.removeItem(LS.alias);
      localStorage.removeItem(LS.spaceId);
      localStorage.removeItem(LS.projectId);
      $('seedReveal').hidden = true;
      goStep(0);
      updateStepUI();
    });

    for (let i = 0; i < totalSteps; i++) {
      const btn = $('stepBtn' + i);
      if (btn)
        btn.addEventListener('click', function () {
          goStep(i);
        });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadStorage();
    if ($('apiBase') && !$('apiBase').value && location.origin && location.origin !== 'null') {
      $('apiBase').placeholder = location.origin;
    }
    wire();
    updateStepUI();
    pingHealth();
  });
})();
