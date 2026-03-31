/* untitled — vanilla front-end, hash router, real API */
(function () {
  'use strict';

  var LS_TOKEN = 'aura2_token';
  var LS_ALIAS = 'aura2_alias';
  var LS_SPACE = 'aura2_spaceId';
  var LS_PROJECT = 'aura2_projectId';

  var ACTIVITY_TYPES = [
    'brainstorm', 'primary_research', 'secondary_research', 'iterate', 'skillwork',
    'fabrication', 'pedagogy', 'admin', 'review', 'ai_tool', 'other',
  ];
  var REL_TYPES = [
    'inspired_by', 'built_on', 'forked_from', 'in_response_to', 'pedagogical_source', 'ai_generated', 'other',
  ];
  var VETO_TYPES = ['hard_stop', 'scope_limit', 'content_flag', 'nda_seal'];
  var EVIDENCE_TYPES = [
    'photos_of_work', 'process_photos', 'sketches', 'dated_files', 'social_post', 'videos',
    'voice_recordings', 'audio', 'exhibit_record', 'institution_record', 'url', 'portfolio_link', 'other',
  ];

  /* registration wizard transient state */
  var reg = { step: 1, seedWords: [], token: '', alias: '', password: '' };

  /* space create wizard */
  var spc = { step: 1, data: {} };

  function apiBase() {
    var m = document.querySelector('meta[name="aura-api-base"]');
    var b = m && m.getAttribute('content');
    if (b && b.trim()) return b.replace(/\/$/, '');
    return window.location.origin.replace(/\/$/, '');
  }

  function getToken() {
    return localStorage.getItem(LS_TOKEN) || '';
  }
  function getAlias() {
    return localStorage.getItem(LS_ALIAS) || '';
  }
  function setSession(token, alias) {
    if (token) localStorage.setItem(LS_TOKEN, token);
    else localStorage.removeItem(LS_TOKEN);
    if (alias) localStorage.setItem(LS_ALIAS, alias);
    else localStorage.removeItem(LS_ALIAS);
  }
  function clearSession() {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_ALIAS);
  }

  var _loadCount = 0;
  function setLoading(on) {
    var el = document.getElementById('global-loading');
    var body = document.body;
    if (!el) return;
    if (on) {
      var wasZero = _loadCount === 0;
      _loadCount++;
      el.hidden = false;
      if (body && wasZero) body.classList.add('is-loading');
    } else {
      _loadCount = Math.max(0, _loadCount - 1);
      if (!_loadCount) {
        el.hidden = true;
        if (body) body.classList.remove('is-loading');
      }
    }
  }

  async function sha256Hex(buf) {
    var hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map(function (b) {
        return b.toString(16).padStart(2, '0');
      })
      .join('');
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tagClass(status) {
    var m = {
      active: 'tag--active',
      completed: 'tag--completed',
      halted: 'tag--halted',
      disputed: 'tag--disputed',
      archived: 'tag--archived',
    };
    return m[status] || '';
  }

  function iconNode() {
    return '<svg class="icon-pixel" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="none" stroke="#000" stroke-width="2"/><line x1="8" y1="1" x2="8" y2="4" stroke="#000" stroke-width="2"/><line x1="8" y1="12" x2="8" y2="15" stroke="#000" stroke-width="2"/><line x1="1" y1="8" x2="4" y2="8" stroke="#000" stroke-width="2"/><line x1="12" y1="8" x2="15" y2="8" stroke="#000" stroke-width="2"/></svg>';
  }
  function iconChain() {
    return '<svg class="icon-pixel" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="5" width="5" height="6" fill="none" stroke="#000" stroke-width="2"/><rect x="10" y="5" width="5" height="6" fill="none" stroke="#000" stroke-width="2"/><line x1="6" y1="8" x2="10" y2="8" stroke="#000" stroke-width="2"/></svg>';
  }
  function iconBlock() {
    return '<svg class="icon-pixel" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" fill="#000"/><rect x="5" y="5" width="6" height="6" fill="#fff"/></svg>';
  }

  function iconHome() {
    return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 8l6-6 6 6"/><path d="M4 8v6h8V8"/></svg>';
  }

  function iconBell() {
    return '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M8 2v1"/><path d="M5 12h6l-1-4V6a2 2 0 10-4 0v2l-1 4z"/></svg>';
  }

  function radarSvg(rc, selfScore) {
    rc = rc || {};
    var keys = ['craft', 'research', 'collaboration', 'pedagogy', 'consistency', 'community'];
    var cx = 100;
    var cy = 100;
    var R = 72;
    var pts = [];
    var axis = [];
    var labels = ['CRAFT', 'RESEARCH', 'COLLAB', 'PEDAGOGY', 'CONSIST', 'COMMUNITY'];
    for (var i = 0; i < 6; i++) {
      var ang = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
      var v = Math.min(1, ((rc[keys[i]] != null ? rc[keys[i]] : 0)) / 1000);
      pts.push(cx + R * v * Math.cos(ang) + ',' + (cy + R * v * Math.sin(ang)));
      axis.push({ x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang), lx: cx + (R + 14) * Math.cos(ang), ly: cy + (R + 14) * Math.sin(ang), t: labels[i] });
    }
    var poly = pts.join(' ');
    var grid = [];
    for (var g = 1; g <= 4; g++) {
      var rr = (R * g) / 4;
      var gp = [];
      for (var j = 0; j < 6; j++) {
        var a2 = -Math.PI / 2 + (j * 2 * Math.PI) / 6;
        gp.push(cx + rr * Math.cos(a2) + ',' + (cy + rr * Math.sin(a2)));
      }
      grid.push('<polygon fill="none" stroke="#ccc" stroke-width="1" points="' + gp.join(' ') + '"/>');
    }
    var axLines = '';
    for (var k = 0; k < 6; k++) {
      var a3 = -Math.PI / 2 + (k * 2 * Math.PI) / 6;
      axLines +=
        '<line x1="' +
        cx +
        '" y1="' +
        cy +
        '" x2="' +
        (cx + R * Math.cos(a3)) +
        '" y2="' +
        (cy + R * Math.sin(a3)) +
        '" stroke="#000" stroke-width="1"/>';
    }
    var dots = '';
    for (var p = 0; p < pts.length; p++) {
      var xy = pts[p].split(',');
      dots += '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="3" fill="#00B4D8" stroke="#0A0A0A" stroke-width="1"/>';
    }
    var lbl = '';
    for (var q = 0; q < axis.length; q++) {
      lbl +=
        '<text x="' +
        axis[q].lx +
        '" y="' +
        axis[q].ly +
        '" font-size="7" font-family="Courier New,monospace" text-anchor="middle">' +
        axis[q].t +
        '</text>';
    }
    var scoreNote =
      selfScore != null
        ? '<text x="100" y="195" font-size="9" font-family="Courier New,monospace" text-anchor="middle">score: ' +
          escapeHtml(selfScore) +
          '</text>'
        : '';
    return (
      '<div class="radar-wrap"><svg viewBox="0 0 200 200" role="img" aria-label="Reputation radar">' +
      grid.join('') +
      axLines +
      '<polygon fill="rgba(229,0,125,0.35)" stroke="#E5007D" stroke-width="2" points="' +
      poly +
      '" />' +
      dots +
      lbl +
      scoreNote +
      '</svg></div>'
    );
  }

  async function api(path, opts) {
    opts = opts || {};
    setLoading(true);
    try {
      var headers = { Accept: 'application/json' };
      if (opts.body != null && !(opts.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }
      var tok = opts.token != null ? opts.token : getToken();
      if (tok) headers['Authorization'] = 'Bearer ' + tok;
      var res = await fetch(apiBase() + path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body instanceof FormData ? opts.body : opts.body != null ? JSON.stringify(opts.body) : undefined,
      });
      var text = await res.text();
      var data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { raw: text };
        }
      }
      if (!res.ok) {
        var msg = (data && (data.error || data.message)) || text || res.statusText;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      return data;
    } finally {
      setLoading(false);
    }
  }

  function parseRoute() {
    var raw = (location.hash || '#/').replace(/^#\/?/, '');
    var parts = raw.split('/').filter(Boolean);
    if (parts.length === 0) return { view: 'landing', parts: parts };
    var a = parts[0];
    if (a === 'register') return { view: 'register', parts: parts };
    if (a === 'recover') return { view: 'recover', parts: parts };
    if (a === 'login') return { view: 'login', parts: parts };
    if (a === 'dashboard') return { view: 'dashboard', parts: parts };
    if (a === 'me') return { view: 'me', parts: parts };
    if (a === 'discover') return { view: 'discover', parts: parts };
    if (a === 'archive' && parts[1] === 'new') return { view: 'archive-new', parts: parts };
    if (a === 'nodes' && parts[1]) return { view: 'node-public', alias: parts[1], parts: parts };
    if (a === 'nfts' && parts[1]) return { view: 'nft', id: parts[1], parts: parts };
    if (a === 'spaces') {
      if (parts[1] === 'new') return { view: 'spaces-new', parts: parts };
      if (parts[1] === 'join') return { view: 'spaces-join', parts: parts };
      if (parts[1] && parts[2] === 'settings') return { view: 'space-settings', id: parts[1], parts: parts };
      if (parts[1]) return { view: 'space', id: parts[1], parts: parts };
      return { view: 'spaces', parts: parts };
    }
    if (a === 'projects') {
      if (parts[1] === 'new') return { view: 'project-new', parts: parts };
      if (!parts[1]) return { view: 'projects-board', parts: parts };
      if (parts[1]) {
        var pid = parts[1];
        var sub = parts[2] || 'view';
        var map = {
          view: 'project',
          trace: 'project-trace',
          reference: 'project-reference',
          pivot: 'project-pivot',
          veto: 'project-veto',
          fork: 'project-fork',
          credit: 'project-credit',
          nft: 'project-nft',
        };
        return { view: map[sub] || 'project', projectId: pid, parts: parts };
      }
    }
    return { view: 'landing', parts: parts };
  }

  function requireAuth(route) {
    var authViews = {
      dashboard: 1,
      me: 1,
      spaces: 1,
      'spaces-new': 1,
      'spaces-join': 1,
      space: 1,
      'space-settings': 1,
      'project-new': 1,
      project: 1,
      'project-trace': 1,
      'project-reference': 1,
      'project-pivot': 1,
      'project-veto': 1,
      'project-fork': 1,
      'project-credit': 1,
      'project-nft': 1,
      'projects-board': 1,
      'archive-new': 1,
      discover: 1,
    };
    if (authViews[route.view] && !getToken()) {
      location.hash = '#/login';
      return false;
    }
    return true;
  }

  /** Logged-in app bar. Unauthenticated pages use a minimal strip. */
  function topbar(crumb) {
    if (!getToken()) {
      return (
        '<header class="topbar"><a class="topbar__brand" href="#/">untitled</a><div></div><div></div></header>'
      );
    }
    var alias = getAlias();
    return (
      '<header class="topbar">' +
      '<div class="topbar__left">' +
      '<a class="topbar__home" href="#/dashboard" aria-label="Home">' +
      iconHome() +
      '</a>' +
      '<a class="topbar__brand" href="#/dashboard">untitled</a>' +
      '<details class="topbar__nav">' +
      '<summary><span class="mono">' +
      escapeHtml(crumb) +
      '</span> <span class="t-11">▼</span></summary>' +
      '<nav class="topbar__nav-menu">' +
      '<a href="#/dashboard">DASHBOARD</a>' +
      '<a href="#/me">PROFILE</a>' +
      '<a href="#/spaces">SPACES</a>' +
      '<a href="#/projects">YOUR PROJECTS</a>' +
      '<a href="#/projects/new">START NEW (+)</a>' +
      '<a href="#/discover">SEARCH</a>' +
      '</nav></details></div>' +
      '<div></div>' +
      '<div class="topbar__user">' +
      '<div class="topbar__notif-wrap">' +
      '<details class="topbar__notif">' +
      '<summary aria-label="Notifications">' +
      iconBell() +
      '</summary>' +
      '<div class="notif-panel">' +
      '<div id="notif-panel-body" class="notif-panel__list"></div>' +
      '<div class="notif-panel__foot"><button type="button" class="btn btn--secondary" id="btn-notify-read">MARK ALL READ</button></div>' +
      '</div></details>' +
      '<span id="notif-badge-count" class="topbar__notif-badge" hidden>0</span></div>' +
      '<a href="#/me">' +
      escapeHtml(alias) +
      '</a>' +
      '<button type="button" class="btn btn--secondary" id="btn-signout">SIGN OUT</button>' +
      '</div></header>'
    );
  }

  function flashErr(msg) {
    return '<div class="flash flash--err" role="alert">' + escapeHtml(msg) + '</div>';
  }
  function flashOk(msg) {
    return '<div class="flash flash--ok">' + escapeHtml(msg) + '</div>';
  }
  function rawApi(data) {
    return (
      '<details class="raw-api"><summary>API response (raw)</summary><pre class="mono">' +
      escapeHtml(JSON.stringify(data, null, 2)) +
      '</pre></details>'
    );
  }

  async function loadNodeProfile(alias) {
    return api('/nodes/' + encodeURIComponent(alias), { token: getToken() || '' });
  }

  async function fetchAllProjectRows() {
    var me = await loadNodeProfile(getAlias());
    var spaces = me.spacesWithNames || [];
    var rows = [];
    for (var si = 0; si < spaces.length; si++) {
      try {
        var plist = await api('/projects/space/' + encodeURIComponent(spaces[si].id));
        for (var pj = 0; pj < plist.length; pj++) {
          rows.push({
            project: plist[pj],
            spaceName: spaces[si].name,
            spaceId: spaces[si].id,
          });
        }
      } catch (e) {
        rows.push({
          error: e.message,
          spaceName: spaces[si].name,
          spaceId: spaces[si].id,
        });
      }
    }
    return { me: me, rows: rows };
  }

  function partitionProjectRows(rows) {
    var ongoing = [];
    var finished = [];
    var archive = [];
    rows.forEach(function (item) {
      if (item.error || !item.project) return;
      var s = item.project.status;
      if (s === 'archived') archive.push(item);
      else if (s === 'completed') finished.push(item);
      else ongoing.push(item);
    });
    return { ongoing: ongoing, finished: finished, archive: archive };
  }

  function projectCardMarkup(item) {
    var p = item.project;
    return (
      '<a class="dash-card" href="#/projects/' +
      p._id +
      '">' +
      '<span class="dash-card__title">' +
      escapeHtml(p.title) +
      '</span>' +
      '<span class="tag ' +
      tagClass(p.status) +
      '">' +
      escapeHtml(p.status) +
      '</span>' +
      '<span class="dash-card__meta text-muted">' +
      escapeHtml(item.spaceName) +
      '</span></a>'
    );
  }

  function profileAvatarHtml(alias) {
    var a = (alias || '?').trim().slice(0, 2).toUpperCase();
    return '<div class="profile-avatar mono">' + escapeHtml(a) + '</div>';
  }

  function profileWireframeHtml(node, opts) {
    opts = opts || {};
    var settings = !!opts.settings;
    var alias = node.alias || '';
    var scoreHtml;
    if (node.reputationScore != null && String(node.reputationScore) !== '') {
      scoreHtml =
        '<div class="score-strip">CURRENT SCORE — <strong>' + escapeHtml(String(node.reputationScore)) + '</strong></div>';
    } else if (settings) {
      scoreHtml = '<div class="score-strip text-muted">SCORE — (only visible on your own profile)</div>';
    } else {
      scoreHtml = '<div class="score-strip text-muted">SCORE — not public</div>';
    }
    var kw = (node.keywords || []).join(', ');
    var interestsList = (node.interests || [])
      .map(function (x) {
        return '<li>' + escapeHtml(x) + '</li>';
      })
      .join('');
    var comp = (node.completedProjects || [])
      .map(function (c) {
        var href = c.nftId
          ? '#/nfts/' + encodeURIComponent(String(c.nftId))
          : c.projectId
            ? '#/projects/' + encodeURIComponent(String(c.projectId))
            : '#';
        return '<div class="list-row"><a href="' + href + '">' + escapeHtml(c.title) + '</a></div>';
      })
      .join('');
    var spacesList = (node.spacesWithNames || [])
      .map(function (s) {
        return '<div class="mono">' + escapeHtml(s.name) + '</div>';
      })
      .join('');
    var links = '';
    if (node.portfolioUrl) {
      links +=
        '<p><a href="' +
        escapeHtml(node.portfolioUrl) +
        '" target="_blank" rel="noopener">PORTFOLIO</a></p>';
    } else {
      links = '<p class="text-muted">—</p>';
    }
    var badges = (node.badges || [])
      .map(function (b) {
        return '<span class="tag tag--active">' + escapeHtml(String(b).toUpperCase()) + '</span>';
      })
      .join(' ');
    var left =
      '<div class="profile-stack">' +
      profileAvatarHtml(alias) +
      (badges ? '<p>' + badges + '</p>' : '') +
      scoreHtml +
      '</div>';
    var center =
      '<div class="profile-stack">' +
      '<div class="win"><div class="win__title">CONTRIBUTIONS</div><div class="win__body"><div class="radar-wrap">' +
      radarSvg(node.reputationCategories, node.reputationScore) +
      '</div></div></div>' +
      '<div class="win"><div class="win__title">NETWORK</div><div class="win__body">' +
      (spacesList || '<p class="text-muted">No spaces listed.</p>') +
      '<p class="text-muted t-11">Spaces this node appears in. A full collaboration graph is not on-chain yet.</p></div></div></div>';
    var right =
      '<div class="profile-stack">' +
      '<div class="win"><div class="win__title">STATEMENT / KEYWORDS</div><div class="win__body"><p>' +
      escapeHtml(kw || '—') +
      '</p></div></div>' +
      '<div class="profile-split2">' +
      '<div class="win"><div class="win__title">INTERESTS</div><div class="win__body">' +
      (interestsList ? '<ul class="mt-0">' + interestsList + '</ul>' : '<p class="text-muted">—</p>') +
      '</div></div>' +
      '<div class="win"><div class="win__title">PROJECTS</div><div class="win__body list-rows">' +
      (comp || '<p class="text-muted">—</p>') +
      '</div></div></div>' +
      '<div class="win"><div class="win__title">LINKS</div><div class="win__body">' +
      links +
      '</div></div></div>';
    var form = '';
    if (settings) {
      form =
        '<div class="win" style="margin-top:24px"><div class="win__title">PROFILE SETTINGS</div><div class="win__body">' +
        '<form id="form-me">' +
        '<div class="field"><label>INTERESTS (comma-separated)</label><input name="interests" value="' +
        escapeHtml((node.interests || []).join(', ')) +
        '" /></div>' +
        '<div class="field"><label>PORTFOLIO URL</label><input name="portfolioUrl" value="' +
        escapeHtml(node.portfolioUrl || '') +
        '" /></div>' +
        '<div class="field"><label>KEYWORDS (comma-separated)</label><input name="keywords" value="' +
        escapeHtml((node.keywords || []).join(', ')) +
        '" /></div>' +
        '<button type="submit" class="btn btn--primary">SAVE</button></form>' +
        rawApi(node) +
        '</div></div>';
    }
    return (
      '<div class="profile-3col">' +
      '<div class="profile-col profile-col--left">' +
      left +
      '</div><div class="profile-col profile-col--center">' +
      center +
      '</div><div class="profile-col profile-col--right">' +
      right +
      '</div></div>' +
      form +
      (settings ? '' : '<p class="text-muted" style="margin-top:24px">This profile is public. No personal data is stored.</p>')
    );
  }

  async function render() {
    var app = document.getElementById('app');
    if (!app) return;
    var route = parseRoute();
    if (!requireAuth(route)) return;

    try {
      if (route.view === 'landing') {
        var divPix = '';
        for (var px = 0; px < 32; px++) {
          divPix += '<span></span>';
        }
        app.innerHTML =
          '<div class="landing-page">' +
          '<div class="landing-hero">' +
          '<div class="landing-hero__center">' +
          '<div class="landing-halftone" aria-hidden="true"></div>' +
          '<div class="landing-wordmark t-64">untitled</div>' +
          '<p class="landing-tagline mono">a chain for documenting what making actually looks like</p>' +
          '<div class="landing-cta-row">' +
          '<a class="btn btn--landing-primary" href="#/register">ENTER THE CHAIN</a>' +
          '<a class="btn btn--landing-secondary" href="#/login">ALREADY A NODE? LOGIN</a>' +
          '</div></div></div>' +
          '<footer class="landing-hero__foot">' +
          '<div class="pixel-divider">' +
          divPix +
          '</div>' +
          '<p class="text-muted">trust-based. non-financial. open.</p>' +
          '</footer></div>';
        return;
      }

      if (route.view === 'register') {
        if (reg.step === 1) {
          app.innerHTML =
            '<div class="auth-figma-root"><main class="auth-figma-wrap">' +
            '<div class="page">' +
            '<div class="win">' +
            '<div class="win__title">NEW NODE REGISTRATION</div>' +
            '<div class="win__body">' +
            '<div class="reg-progress"><span class="is-current">1 IDENTITY</span><span>2 SEED PHRASE</span><span>3 CONFIRMED</span></div>' +
            '<form id="form-reg1">' +
            '<div class="field"><label for="reg-alias">CHOOSE YOUR ALIAS (permanent — cannot be changed)</label>' +
            '<input id="reg-alias" name="alias" required autocomplete="username" pattern="[a-z0-9_-]{3,30}" title="lowercase letters, numbers, hyphen, underscore" /></div>' +
            '<div class="field"><label for="reg-pass">SET PASSWORD (minimum 8 characters)</label>' +
            '<input id="reg-pass" type="password" name="password" minlength="8" required autocomplete="new-password" /></div>' +
            '<button type="submit" class="btn btn--primary">CREATE NODE</button></form>' +
            '<p class="text-muted mt-0">Your alias is your permanent identity on the chain. No email. No phone. No real name.</p>' +
            '</div></div></div>' +
            '</div></main></div>';
          document.getElementById('form-reg1').onsubmit = async function (e) {
            e.preventDefault();
            var fd = new FormData(e.target);
            var alias = (fd.get('alias') || '').toString().trim();
            var password = (fd.get('password') || '').toString();
            if (!/^[a-z0-9_-]+$/.test(alias)) {
              app.insertAdjacentHTML('afterbegin', flashErr('Alias: lowercase a-z, 0-9, _, - only'));
              return;
            }
            try {
              var data = await api('/auth/register', { method: 'POST', body: { alias: alias, password: password } });
              reg.step = 2;
              reg.alias = data.alias || alias;
              reg.token = data.token;
              reg.password = password;
              reg.seedWords = (data.seedPhrase || '').split(/\s+/).filter(Boolean);
              setSession(reg.token, reg.alias);
              render();
            } catch (err) {
              app.insertAdjacentHTML('afterbegin', flashErr(err.message));
            }
          };
          return;
        }
        if (reg.step === 2) {
          var cells = '';
          for (var i = 0; i < reg.seedWords.length; i++) {
            cells +=
              '<div class="seed-cell"><strong>' +
              (i + 1) +
              '.</strong> ' +
              escapeHtml(reg.seedWords[i]) +
              '</div>';
          }
          app.innerHTML =
            '<div class="auth-figma-root"><main class="auth-figma-wrap">' +
            '<div class="page">' +
            '<div class="win win--warn-left">' +
            '<div class="win__title">YOUR SEED PHRASE — READ CAREFULLY</div>' +
            '<div class="win__body">' +
            '<div class="reg-progress"><span>1 IDENTITY</span><span class="is-current">2 SEED PHRASE</span><span>3 CONFIRMED</span></div>' +
            '<div class="seed-grid">' +
            cells +
            '</div>' +
            '<div class="warn-block">WRITE THESE 12 WORDS DOWN. THIS IS THE ONLY TIME YOU WILL SEE THEM. THERE IS NO RECOVERY WITHOUT THEM.</div>' +
            '<form id="form-reg2"><label><input type="checkbox" id="seed-ok" required /> I have written down all 12 words in order</label>' +
            '<p><button type="submit" class="btn btn--primary" id="btn-seed-go" disabled>ENTER THE CHAIN</button></p></form>' +
            '</div></div></div>' +
            '</div></main></div>';
          var ck = document.getElementById('seed-ok');
          var btn = document.getElementById('btn-seed-go');
          ck.onchange = function () {
            btn.disabled = !ck.checked;
          };
          document.getElementById('form-reg2').onsubmit = function (e) {
            e.preventDefault();
            reg.step = 3;
            render();
          };
          return;
        }
        if (reg.step === 3) {
          app.innerHTML =
            '<div class="auth-figma-root"><main class="auth-figma-wrap">' +
            '<div class="page">' +
            '<div class="win"><div class="win__title">CONFIRMED</div><div class="win__body">' +
            '<div class="reg-progress"><span>1 IDENTITY</span><span>2 SEED PHRASE</span><span class="is-current">3 CONFIRMED</span></div>' +
            '<p>NODE CREATED. WELCOME TO THE CHAIN.</p>' +
            '<p class="mono">' +
            escapeHtml(reg.alias) +
            '</p>' +
            '<a class="btn btn--primary" href="#/dashboard">GO TO DASHBOARD</a>' +
            '</div></div></div>' +
            '</div></main></div>';
          return;
        }
      }

      if (route.view === 'login') {
        app.innerHTML =
          '<div class="auth-figma-root">' +
          '<main class="auth-figma-wrap">' +
          '<section class="auth-register-area">' +
          '<a class="btn auth-switch-card" href="#/register">' +
          '<div class="auth-switch-card__text"><span><span class="is-new">new user?<br /></span><span>sign up!</span></span></div>' +
          '</a>' +
          '</section>' +
          '<section class="auth-login-form">' +
          '<div class="auth-title-block"><h1 class="auth-title">It’s nice to see you again!</h1></div>' +
          '<form id="form-login" class="auth-credentials">' +
          '<div class="auth-credential-entry">' +
          '<div class="auth-field">' +
          '<div class="auth-field-label">username or alias</div>' +
          '<input class="auth-field-input" id="li-alias" name="alias" required autocomplete="username" placeholder="xyz_123" />' +
          '</div>' +
          '<div class="auth-field">' +
          '<div class="auth-field-label">password</div>' +
          '<input class="auth-field-input auth-field-input--password" id="li-pass" type="password" name="password" required autocomplete="current-password" placeholder="..........................." />' +
          '</div>' +
          '</div>' +
          '<div class="auth-login-btn-wrap">' +
          '<button type="submit" class="btn auth-login-btn">login</button>' +
          '</div>' +
          '</form>' +
          '</section>' +
          '</main>' +
          '</div>';
        document.getElementById('form-login').onsubmit = async function (e) {
          e.preventDefault();
          var fd = new FormData(e.target);
          try {
            var data = await api('/auth/login', {
              method: 'POST',
              body: { alias: fd.get('alias'), password: fd.get('password') },
            });
            setSession(data.token, data.alias);
            location.hash = '#/dashboard';
          } catch (err) {
            app.insertAdjacentHTML('afterbegin', flashErr(err.message));
          }
        };
        return;
      }

      if (route.view === 'recover') {
        app.innerHTML =
          topbar('recover') +
          '<div class="page"><div class="win"><div class="win__title">SEED RECOVERY</div><div class="win__body">' +
          '<form id="form-rec"><div class="field"><label>ALIAS</label><input name="alias" required /></div>' +
          '<div class="field"><label>SEED PHRASE (12 words)</label><textarea name="seedPhrase" required></textarea></div>' +
          '<div class="field"><label>NEW PASSWORD</label><input type="password" name="newPassword" minlength="8" required /></div>' +
          '<button type="submit" class="btn btn--danger">RESET PASSWORD</button></form></div></div></div>';
        document.getElementById('form-rec').onsubmit = async function (e) {
          e.preventDefault();
          var fd = new FormData(e.target);
          try {
            var data = await api('/auth/recover', {
              method: 'POST',
              body: {
                alias: fd.get('alias'),
                seedPhrase: fd.get('seedPhrase'),
                newPassword: fd.get('newPassword'),
              },
            });
            setSession(data.token, data.alias);
            location.hash = '#/dashboard';
          } catch (err) {
            document.querySelector('.win__body').insertAdjacentHTML('afterbegin', flashErr(err.message));
          }
        };
        return;
      }

      if (route.view === 'space-settings') {
        var spSet = await api('/spaces/' + encodeURIComponent(route.id));
        var isAdm = (spSet.admins || []).indexOf(getAlias()) >= 0;
        if (!isAdm) {
          app.innerHTML = topbar('space') + '<div class="page">' + flashErr('Admin only') + '</div>';
          await bindAppChrome();
          return;
        }
        app.innerHTML =
          topbar('dashboard / spaces / settings') +
          '<div class="page"><div class="win"><div class="win__title">SPACE SETTINGS</div><div class="win__body">' +
          '<form id="form-sp-set">' +
          '<div class="field"><label>JOINING (projectAccess)</label><select name="projectAccess">' +
          '<option value="open"' +
          (spSet.settings && spSet.settings.projectAccess === 'open' ? ' selected' : '') +
          '>open</option><option value="invite_only"' +
          (spSet.settings && spSet.settings.projectAccess === 'invite_only' ? ' selected' : '') +
          '>invite_only</option><option value="application"' +
          (spSet.settings && spSet.settings.projectAccess === 'application' ? ' selected' : '') +
          '>application</option></select></div>' +
          '<div class="field"><label>VETO AUTHORITY (comma aliases)</label><input name="vetoAuthority" value="' +
          escapeHtml((spSet.settings && spSet.settings.vetoAuthority || []).join(', ')) +
          '" /></div>' +
          '<div class="field"><label>VOTING THRESHOLD</label><input name="votingThreshold" type="number" step="0.05" min="0" max="1" value="' +
          (spSet.settings && spSet.settings.votingThreshold != null ? spSet.settings.votingThreshold : 0.5) +
          '" /></div>' +
          '<button type="submit" class="btn btn--primary">SAVE</button></form></div></div></div>';
        document.getElementById('form-sp-set').onsubmit = async function (e) {
          e.preventDefault();
          var fd = new FormData(e.target);
          try {
            var out = await api('/spaces/' + encodeURIComponent(route.id) + '/settings', {
              method: 'PATCH',
              body: {
                projectAccess: fd.get('projectAccess'),
                vetoAuthority: (fd.get('vetoAuthority') || '')
                  .toString()
                  .split(',')
                  .map(function (s) {
                    return s.trim();
                  })
                  .filter(Boolean),
                votingThreshold: Number(fd.get('votingThreshold')),
              },
            });
            document.querySelector('.win__body').insertAdjacentHTML('afterbegin', flashOk('Saved') + rawApi(out));
          } catch (err) {
            document.querySelector('.win__body').insertAdjacentHTML('afterbegin', flashErr(err.message));
          }
        };
        await bindAppChrome();
        return;
      }

      if (route.view === 'dashboard') {
        var pack = await fetchAllProjectRows();
        var me = pack.me;
        var rows = pack.rows;
        var spaces = me.spacesWithNames || [];
        var badges = (me.badges || []).map(function (b) {
          return '<span class="tag tag--active">' + escapeHtml(String(b).toUpperCase()) + '</span>';
        });
        var scoreLine =
          me.reputationScore != null
            ? '<div class="score-strip" style="margin-top:16px">CURRENT SCORE — <strong>' +
              escapeHtml(String(me.reputationScore)) +
              '</strong></div>'
            : '';
        var spaceCards = spaces
          .map(function (s) {
            return (
              '<a class="dash-card" href="#/spaces/' +
              s.id +
              '"><span class="dash-card__title">' +
              escapeHtml(s.name) +
              '</span><span class="dash-card__meta">OPEN →</span></a>'
            );
          })
          .join('');
        var activeRows = rows.filter(function (item) {
          if (!item.project) return false;
          return ['active', 'halted', 'disputed'].indexOf(item.project.status) >= 0;
        });
        var projShow = activeRows.slice(0, 4).map(projectCardMarkup).join('');
        var projRow =
          '<div class="row-cards">' +
          (projShow || '<p class="text-muted" style="flex:1">No active projects.</p>') +
          '<a class="dash-card dash-card--cta" href="#/projects"><span class="dash-card__title">VIEW ALL</span><span class="mono">→</span></a>' +
          '<a class="dash-card dash-card--cta" href="#/projects/new"><span class="dash-card__title">CREATE NEW</span><span class="mono">+</span></a></div>';
        var errRows = rows
          .filter(function (r) {
            return r.error;
          })
          .map(function (r) {
            return '<div class="flash flash--err">' + escapeHtml(r.spaceName + ': ' + r.error) + '</div>';
          })
          .join('');
        app.innerHTML =
          topbar('dashboard') +
          '<div class="page layout"><div class="layout__z1">HOME</div><div class="layout__main">' +
          '<div class="shell-dash">' +
          '<div class="shell-dash__left">' +
          '<div class="win"><div class="win__title">CONTRIBUTIONS</div><div class="win__body">' +
          '<h2 class="mt-0 mono">' +
          escapeHtml(me.alias) +
          '</h2>' +
          '<div class="radar-wrap">' +
          radarSvg(me.reputationCategories, me.reputationScore) +
          '</div>' +
          '<div style="margin-top:12px">' +
          badges.join(' ') +
          '</div>' +
          scoreLine +
          '</div></div></div>' +
          '<div class="shell-dash__right">' +
          errRows +
          '<div class="win"><div class="win__title">ACTIVE SPACES</div><div class="win__body">' +
          '<div class="grid-cards grid-cards--spaces">' +
          (spaceCards || '<p class="text-muted">None.</p>') +
          '</div>' +
          '<div class="btn-row" style="margin-top:16px">' +
          '<a class="btn btn--secondary" href="#/spaces">VIEW SPACES</a>' +
          '<a class="btn btn--secondary" href="#/spaces/join">+ JOIN</a>' +
          '<a class="btn btn--secondary" href="#/spaces/new">+ CREATE</a></div></div></div>' +
          '<div class="win"><div class="win__title">ACTIVE PROJECTS</div><div class="win__body">' +
          projRow +
          '</div></div></div></div></div></div>';
        await bindAppChrome();
        return;
      }

      if (route.view === 'projects-board') {
        var packb = await fetchAllProjectRows();
        var part = partitionProjectRows(packb.rows);
        function boardCol(title, items) {
          var inner = items.map(projectCardMarkup).join('') || '<p class="text-muted">None.</p>';
          return (
            '<div class="board-col"><div class="win"><div class="win__title">' +
            title +
            '</div><div class="win__body">' +
            inner +
            '</div></div></div>'
          );
        }
        var errb = packb.rows
          .filter(function (r) {
            return r.error;
          })
          .map(function (r) {
            return '<div class="flash flash--err">' + escapeHtml(r.spaceName + ': ' + r.error) + '</div>';
          })
          .join('');
        app.innerHTML =
          topbar('your projects') +
          '<div class="page layout"><div class="layout__z1">PROJECTS</div><div class="layout__main">' +
          errb +
          '<p class="t-40 mono" style="margin-bottom:24px">YOUR PROJECTS</p>' +
          '<div class="shell-3col">' +
          boardCol('ONGOING / ACTIVE', part.ongoing) +
          boardCol('FINISHED / CREDITED', part.finished) +
          boardCol('ARCHIVE', part.archive) +
          '</div>' +
          '<div class="btn-row" style="margin-top:24px"><a class="btn btn--primary" href="#/projects/new">+ NEW PROJECT</a></div></div></div>';
        await bindAppChrome();
        return;
      }

      if (route.view === 'me') {
        var prof = await loadNodeProfile(getAlias());
        app.innerHTML =
          topbar('profile') +
          '<div class="page layout"><div class="layout__z1">PROFILE</div><div class="layout__main">' +
          profileWireframeHtml(prof, { settings: true }) +
          '</div></div>';
        document.getElementById('form-me').onsubmit = async function (e) {
          e.preventDefault();
          var formEl = e.target;
          var panel = formEl.closest('.win__body');
          var fd = new FormData(formEl);
          var interests = (fd.get('interests') || '')
            .toString()
            .split(',')
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
          var keywords = (fd.get('keywords') || '')
            .toString()
            .split(',')
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
          try {
            var out = await api('/nodes/me', {
              method: 'PATCH',
              body: {
                interests: interests,
                portfolioUrl: fd.get('portfolioUrl') || '',
                keywords: keywords,
              },
            });
            if (panel) {
              panel.insertAdjacentHTML('afterbegin', flashOk('Saved'));
              panel.insertAdjacentHTML('beforeend', rawApi(out));
            }
          } catch (err) {
            if (panel) panel.insertAdjacentHTML('afterbegin', flashErr(err.message));
          }
        };
        await bindAppChrome();
        return;
      }

      if (route.view === 'spaces') {
        var np = await loadNodeProfile(getAlias());
        var sn = np.spacesWithNames || [];
        app.innerHTML =
          topbar('dashboard / spaces') +
          '<div class="page"><div class="win"><div class="win__title">SPACES</div><div class="win__body list-rows">' +
          sn
            .map(function (s) {
              return (
                '<div class="list-row"><div>' +
                escapeHtml(s.name) +
                '</div><a class="btn btn--secondary" href="#/spaces/' +
                s.id +
                '">OPEN</a></div>'
              );
            })
            .join('') +
          '<div class="btn-row"><a class="btn btn--secondary" href="#/spaces/new">+ CREATE</a> <a class="btn btn--secondary" href="#/spaces/join">+ JOIN</a></div>' +
          '</div></div></div>';
        await bindAppChrome();
        return;
      }

      if (route.view === 'spaces-new') {
        spc = { step: 1, data: {} };
        await renderSpaceWizard();
        return;
      }

      if (route.view === 'spaces-join') {
        app.innerHTML =
          topbar('dashboard / spaces / join') +
          '<div class="page"><div class="win"><div class="win__title">JOIN SPACE</div><div class="win__body">' +
          '<form id="form-join">' +
          '<div class="field"><label>SPACE ID</label><input name="spaceId" required class="mono" /></div>' +
          '<div class="field"><label>INVITE CODE (if required)</label><input name="inviteCode" class="mono" /></div>' +
          '<button type="submit" class="btn btn--primary">JOIN</button></form></div></div></div>';
        document.getElementById('form-join').onsubmit = async function (e) {
          e.preventDefault();
          var fd = new FormData(e.target);
          try {
            var sid = fd.get('spaceId');
            var body = {};
            if (fd.get('inviteCode')) body.inviteCode = fd.get('inviteCode');
            var r = await api('/spaces/' + encodeURIComponent(sid) + '/join', { method: 'POST', body: body });
            document.querySelector('.win__body').insertAdjacentHTML('afterbegin', flashOk(r.message || 'Joined') + rawApi(r));
          } catch (err) {
            document.querySelector('.win__body').insertAdjacentHTML('afterbegin', flashErr(err.message));
          }
        };
        await bindAppChrome();
        return;
      }

      if (route.view === 'space') {
        var space = await api('/spaces/' + encodeURIComponent(route.id));
        var isAdmin = (space.admins || []).indexOf(getAlias()) >= 0;
        var mem = (space.members || [])
          .map(function (m) {
            return (
              '<div class="list-row"><div>' +
              iconNode() +
              ' <span class="mono">' +
              escapeHtml(m) +
              '</span></div></div>'
            );
          })
          .join('');
        var pj = '';
        try {
          var pl = await api('/projects/space/' + encodeURIComponent(route.id));
          for (var i = 0; i < pl.length; i++) {
            pj +=
              '<div class="list-row"><div><strong>' +
              escapeHtml(pl[i].title) +
              '</strong> <span class="tag ' +
              tagClass(pl[i].status) +
              '">' +
              escapeHtml(pl[i].status) +
              '</span></div><a class="btn btn--secondary" href="#/projects/' +
              pl[i]._id +
              '">VIEW →</a></div>';
          }
        } catch (e) {
          pj = flashErr(e.message);
        }
        app.innerHTML =
          topbar('dashboard / spaces / ' + (space.name || 'space')) +
          '<div class="page layout"><div class="layout__z1">SPACE</div><div class="layout__main">' +
          '<div class="shell-space">' +
          '<div class="shell-space__full win"><div class="win__title">' +
          escapeHtml(space.name) +
          '</div><div class="win__body"><p class="mono">ID: ' +
          escapeHtml(space._id) +
          ' <button type="button" class="btn btn--secondary" id="cp-sid">COPY</button></p>' +
          '<p>' +
          escapeHtml(space.description || '') +
          '</p>' +
          (isAdmin
            ? '<p><a class="btn btn--secondary" href="#/spaces/' + route.id + '/settings">SETTINGS</a></p>'
            : '') +
          '</div></div>' +
          '<div class="shell-space__projects win"><div class="win__title">PROJECTS</div><div class="win__body list-rows">' +
          pj +
          '<div class="btn-row" style="margin-top:12px;padding:12px;border-top:var(--border)">' +
          '<a class="btn btn--primary" href="#/projects/new?space=' +
          encodeURIComponent(route.id) +
          '">NEW PROJECT IN SPACE</a></div></div></div>' +
          '<div class="shell-space__members win"><div class="win__title">MEMBERS (' +
          (space.members || []).length +
          ')</div><div class="win__body list-rows">' +
          mem +
          '</div></div></div></div></div>';
        document.getElementById('cp-sid').onclick = function () {
          navigator.clipboard.writeText(space._id);
        };
        await bindAppChrome();
        return;
      }

      if (route.view === 'project-new') {
        var qs = {};
        location.hash
          .replace(/^#[^?]*/, '')
          .slice(1)
          .split('&')
          .forEach(function (p) {
            var x = p.split('=');
            qs[decodeURIComponent(x[0])] = decodeURIComponent(x[1] || '');
          });
        var me2 = await loadNodeProfile(getAlias());
        var sns = me2.spacesWithNames || [];
        var opts = sns
          .map(function (s) {
            return '<option value="' + escapeHtml(s.id) + '">' + escapeHtml(s.name) + '</option>';
          })
          .join('');
        app.innerHTML =
          topbar('dashboard / new project') +
          '<div class="page layout"><div class="layout__z1">NEW</div><div class="layout__main layout__main--narrow">' +
          '<div class="win"><div class="win__title">START PROJECT</div><div class="win__body">' +
          '<form id="form-newp">' +
          '<div class="field"><label>TITLE</label><input name="title" required /></div>' +
          '<div class="field"><label>SPACE</label><select name="spaceId">' +
          opts +
          '</select></div>' +
          '<div class="field"><label>CONTRIBUTORS (optional — one alias per line, must exist on chain)</label><textarea name="contrib" rows="4" placeholder=""></textarea></div>' +
          '<div class="field"><label>MENTOR ALIAS (optional)</label><input name="mentorAlias" /></div>' +
          '<button type="submit" class="btn btn--primary">CREATE PROJECT</button></form></div></div></div></div>';
        var sel = document.querySelector('[name="spaceId"]');
        if (qs.space && sel) sel.value = qs.space;
        document.getElementById('form-newp').onsubmit = async function (e) {
          e.preventDefault();
          var fd = new FormData(e.target);
          var lines = (fd.get('contrib') || '')
            .toString()
            .split(/\n/)
            .map(function (x) {
              return x.trim();
            })
            .filter(Boolean);
          var contributors = lines.map(function (a) {
            return { alias: a, role: 'contributor' };
          });
          var body = {
            title: fd.get('title'),
            spaceId: fd.get('spaceId'),
            contributors: contributors,
            mentorAlias: fd.get('mentorAlias') || undefined,
          };
          try {
            var pr = await api('/projects', { method: 'POST', body: body });
            localStorage.setItem(LS_PROJECT, pr._id);
            location.hash = '#/projects/' + pr._id;
            render();
          } catch (err) {
            document.querySelector('.win__body').insertAdjacentHTML('afterbegin', flashErr(err.message));
          }
        };
        await bindAppChrome();
        return;
      }

      if (route.view === 'project' || String(route.view).indexOf('project-') === 0) {
        await renderProjectShell(route);
        return;
      }

      if (route.view === 'node-public') {
        var node = await api('/nodes/' + encodeURIComponent(route.alias), { token: getToken() || '' });
        var pubHeader = getToken()
          ? topbar('nodes / ' + route.alias)
          : '<header class="topbar"><a class="topbar__brand" href="#/">untitled</a><div></div><div></div></header>';
        var pubCallout = '';
        if (!getToken()) {
          pubCallout =
            '<div class="public-auth-callout win" style="margin-bottom:24px">' +
            '<div class="win__body">' +
            '<p class="mt-0">Have an account? <a href="#/login">LOG IN</a>. New here? <a href="#/register">REGISTER</a>.</p>' +
            '</div></div>';
        }
        app.innerHTML =
          pubHeader +
          '<div class="page layout page--public-profile"><div class="layout__z1">PROFILE</div><div class="layout__main">' +
          '<h1 class="public-profile__title">' +
          escapeHtml(node.alias) +
          '</h1>' +
          pubCallout +
          profileWireframeHtml(node, { settings: false }) +
          '</div></div>';
        if (getToken()) await bindAppChrome();
        return;
      }

      if (route.view === 'nft' || route.view === 'project-nft') {
        var nid = route.id;
        try {
          var bundle;
          if (route.view === 'project-nft' && route.projectId) {
            bundle = await api('/credits/project/' + encodeURIComponent(route.projectId));
            nid = bundle.nft && bundle.nft._id ? String(bundle.nft._id) : '';
          } else {
            bundle = await api('/nfts/' + encodeURIComponent(nid));
          }
          var nft = bundle.nft;
          var proj = bundle.project;
          app.innerHTML =
            topbar('nft') +
            '<div class="page"><div class="win"><div class="win__title win__title--blue">PROVENANCE RECORD</div><div class="win__body">' +
            '<h2 class="mt-0">' +
            escapeHtml(nft.title || '') +
            '</h2>' +
            (bundle.archive ? '<span class="tag tag--archived">ARCHIVE</span>' : '') +
            '<div class="table-wrap"><table class="data-table"><tr><th>medium</th><td class="mono">' +
            escapeHtml(nft.medium || '') +
            '</td></tr><tr><th>project</th><td class="mono">' +
            escapeHtml(proj._id) +
            '</td></tr></table></div>' +
            '<button type="button" class="btn btn--secondary" id="btn-share">SHARE</button>' +
            rawApi(bundle) +
            '</div></div></div>';
          document.getElementById('btn-share').onclick = function () {
            var share =
              nid && nid.length
                ? location.origin + '/#/nfts/' + nid
                : location.origin + '/#/projects/' + (proj && proj._id ? proj._id : '') + '/nft';
            navigator.clipboard.writeText(share);
          };
        } catch (e) {
          app.innerHTML =
            topbar('nft') +
            '<div class="page">' +
            flashErr(e.message + ' — sign in may be required for this endpoint.') +
            ' <a href="#/login">LOGIN</a></div>';
        }
        await bindAppChrome();
        return;
      }

      if (route.view === 'archive-new') {
        var me3 = await loadNodeProfile(getAlias());
        var sopts = (me3.spacesWithNames || [])
          .map(function (s) {
            return '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>';
          })
          .join('');
        app.innerHTML =
          topbar('dashboard / archive') +
          '<div class="page"><div class="win"><div class="win__title">ARCHIVE PAST WORK</div><div class="win__body">' +
          '<p>Archiving documents work that predates the chain. Marked as reconstruction.</p>' +
          '<form id="form-arch">' +
          '<div class="field"><label>TITLE</label><input name="title" required /></div>' +
          '<div class="field"><label>MEDIUM</label><input name="medium" required /></div>' +
          '<div class="field"><label>APPROX DATE (string)</label><input name="approxDate" placeholder="March 2022" required /></div>' +
          '<div class="field"><label>SPACE</label><select name="spaceId">' + sopts + '</select></div>' +
          '<div class="field"><label>EVIDENCE TYPE</label><select name="evidenceType">' +
          EVIDENCE_TYPES.map(function (t) {
            return '<option value="' + t + '">' + t + '</option>';
          }).join('') +
          '</select></div>' +
          '<div class="field"><label>EVIDENCE HASH (SHA-256)</label>' +
          '<div class="tabs" id="arch-tabs" role="tablist">' +
          '<button type="button" class="is-active" data-evtab="file" role="tab" aria-selected="true">FILE</button>' +
          '<button type="button" data-evtab="url" role="tab" aria-selected="false">URL</button></div>' +
          '<div id="arch-pane-file">' +
          '<input type="file" id="arch-file" />' +
          '<p class="text-muted">Hash = SHA-256 of file bytes (in browser).</p></div>' +
          '<div id="arch-pane-url" hidden>' +
          '<div class="field"><label>URL</label><input type="url" id="arch-url" placeholder="https://…" /></div>' +
          '<button type="button" class="btn btn--secondary" id="arch-url-btn">COMPUTE HASH FROM URL</button>' +
          '<p class="text-muted">Hash = SHA-256 of the URL string (UTF-8).</p></div>' +
          '<div class="field"><label>EVIDENCE HASH (computed)</label>' +
          '<input name="evidenceHash" id="arch-hash" class="mono" required readonly autocomplete="off" /></div></div>' +
          '<div class="field"><label>OTHER DESCRIPTION (if type=other)</label><input name="otherDescription" /></div>' +
          '<div class="field"><label>CONTEXT (optional)</label><textarea name="contextNote"></textarea></div>' +
          '<label><input type="checkbox" name="o1" required /> I declare this is my original work</label><br/>' +
          '<label><input type="checkbox" name="o2" required /> I acknowledge this is a self-reported reconstruction</label>' +
          '<p><button type="submit" class="btn btn--primary">ARCHIVE</button></p></form></div></div></div>';
        (function bindArchiveEvidence() {
          var tabs = document.getElementById('arch-tabs');
          var paneF = document.getElementById('arch-pane-file');
          var paneU = document.getElementById('arch-pane-url');
          var hashIn = document.getElementById('arch-hash');
          var fileIn = document.getElementById('arch-file');
          var urlIn = document.getElementById('arch-url');
          tabs.querySelectorAll('button[data-evtab]').forEach(function (b) {
            b.onclick = function () {
              tabs.querySelectorAll('button[data-evtab]').forEach(function (x) {
                x.classList.remove('is-active');
                x.setAttribute('aria-selected', 'false');
              });
              b.classList.add('is-active');
              b.setAttribute('aria-selected', 'true');
              var t = b.getAttribute('data-evtab');
              paneF.hidden = t !== 'file';
              paneU.hidden = t !== 'url';
              hashIn.value = '';
              fileIn.value = '';
              if (urlIn) urlIn.value = '';
            };
          });
          fileIn.onchange = async function (ev) {
            var f = ev.target.files && ev.target.files[0];
            if (!f) {
              hashIn.value = '';
              return;
            }
            try {
              var buf = await f.arrayBuffer();
              hashIn.value = await sha256Hex(buf);
            } catch (err) {
              hashIn.value = '';
              document.querySelector('.win__body').insertAdjacentHTML('afterbegin', flashErr(err.message || 'Could not hash file'));
            }
          };
          document.getElementById('arch-url-btn').onclick = async function () {
            var u = (urlIn.value || '').trim();
            if (!u) return;
            try {
              var enc = new TextEncoder().encode(u);
              hashIn.value = await sha256Hex(enc);
            } catch (err) {
              document.querySelector('.win__body').insertAdjacentHTML('afterbegin', flashErr(err.message || 'Could not hash URL'));
            }
          };
        })();
        document.getElementById('form-arch').onsubmit = async function (e) {
          e.preventDefault();
          var fd = new FormData(e.target);
          var hex = (fd.get('evidenceHash') || '').trim().toLowerCase();
          if (!/^[a-f0-9]{64}$/.test(hex)) {
            document.querySelector('.win__body').insertAdjacentHTML(
              'afterbegin',
              flashErr('Evidence hash must be a 64-character hex SHA-256 (use FILE or URL above).'),
            );
            return;
          }
          var et = fd.get('evidenceType');
          var ev = [{ evidenceType: et, evidenceHash: hex }];
          if (et === 'other' && fd.get('otherDescription')) ev[0].otherDescription = fd.get('otherDescription');
          try {
            var ar = await api('/archives', {
              method: 'POST',
              body: {
                title: fd.get('title'),
                medium: fd.get('medium'),
                approxDate: fd.get('approxDate'),
                spaceId: fd.get('spaceId'),
                evidence: ev,
                reconstructionFlag: true,
                originalWorkDeclaration: true,
                contextNote: fd.get('contextNote') || undefined,
              },
            });
            document.querySelector('.win__body').insertAdjacentHTML(
              'afterbegin',
              flashOk('Archived. NFT: ' + (ar.nft && ar.nft._id)) + rawApi(ar),
            );
          } catch (err) {
            document.querySelector('.win__body').insertAdjacentHTML('afterbegin', flashErr(err.message));
          }
        };
        await bindAppChrome();
        return;
      }

      if (route.view === 'discover') {
        app.innerHTML =
          topbar('discover') +
          '<div class="page layout"><div class="layout__z1">DISCOVER</div><div class="layout__main">' +
          '<p class="t-40 mono" style="margin-bottom:48px">DISCOVER</p>' +
          '<div class="todo-block">TODO: backend search index for FIELD / SKILL / TOOL filters and alphabetical listing.</div>' +
          '<p class="text-muted" style="margin-bottom:24px">No algorithm. No ranking. Results are alphabetical (when indexed).</p>' +
          '<div class="win"><div class="win__title">EXACT ALIAS LOOKUP</div><div class="win__body">' +
          '<form id="form-disc"><div class="field"><label>ALIAS</label><input name="alias" class="mono" required /></div>' +
          '<button type="submit" class="btn btn--primary">OPEN PROFILE</button></form></div></div>' +
          '</div></div>';
        document.getElementById('form-disc').onsubmit = function (e) {
          e.preventDefault();
          var a = new FormData(e.target).get('alias');
          location.hash = '#/nodes/' + encodeURIComponent(String(a).trim());
        };
        await bindAppChrome();
        return;
      }

      app.innerHTML = '<div class="page">' + flashErr('Unknown route') + '</div>';
    } catch (err) {
      app.innerHTML = '<div class="page">' + flashErr(err.message || String(err)) + '</div>';
    }
  }

  async function renderProjectShell(route) {
    var app = document.getElementById('app');
    var pid = route.projectId;
    var project = await api('/projects/' + encodeURIComponent(pid));
    var sub = route.view.replace('project-', '');
    if (sub === 'project' || sub === 'view') sub = 'view';
    var statusTag =
      '<span class="tag ' + tagClass(project.status) + '">' + escapeHtml(project.status) + '</span>';
    var contrib = (project.contributors || [])
      .map(function (c) {
        return (
          '<div class="list-row"><div>' +
          iconNode() +
          ' <span class="mono">' +
          escapeHtml(c.alias) +
          '</span> ' +
          escapeHtml(c.role || '') +
          (c.isPrimary ? ' <span class="tag tag--active">PRIMARY</span>' : '') +
          '</div></div>'
        );
      })
      .join('');
    var active = project.status === 'active';
    var nftBtn =
      project.status === 'completed'
        ? '<a class="btn btn--provenance" href="#/projects/' +
          pid +
          '/nft">VIEW PROVENANCE RECORD</a>'
        : '';

    var traces = [];
    var refs = [];
    var pivots = [];
    var vetos = [];
    try {
      traces = await api('/traces/project/' + encodeURIComponent(pid));
    } catch (e) {
      traces = [];
    }
    try {
      refs = await api('/references/project/' + encodeURIComponent(pid));
    } catch (e) {
      refs = [];
    }
    try {
      pivots = await api('/pivots/project/' + encodeURIComponent(pid));
    } catch (e) {
      pivots = [];
    }
    try {
      vetos = await api('/vetos/project/' + encodeURIComponent(pid));
    } catch (e) {
      vetos = [];
    }

    var timeline = [];
    traces.forEach(function (t) {
      timeline.push({
        kind: 'trace',
        t: new Date(t.timestamp || t.createdAt).getTime(),
        o: t,
      });
    });
    refs.forEach(function (r) {
      timeline.push({
        kind: 'reference',
        t: new Date(r.createdAt).getTime(),
        o: r,
      });
    });
    pivots.forEach(function (p) {
      timeline.push({
        kind: 'pivot',
        t: new Date(p.createdAt).getTime(),
        o: p,
      });
    });
    vetos.forEach(function (v) {
      timeline.push({
        kind: 'veto',
        t: new Date(v.createdAt).getTime(),
        o: v,
      });
    });
    timeline.sort(function (a, b) {
      return a.t - b.t;
    });

    var tlHtml = timeline
      .map(function (item, idx) {
        var tag =
          item.kind === 'trace'
            ? 'tag--trace'
            : item.kind === 'reference'
              ? 'tag--reference'
              : item.kind === 'pivot'
                ? 'tag--pivot'
                : 'tag--veto';
        var lab =
          item.kind === 'trace'
            ? 'TRACE'
            : item.kind === 'reference'
              ? 'REFERENCE'
              : item.kind === 'pivot'
                ? 'PIVOT'
                : 'VETO';
        var desc = '';
        if (item.kind === 'trace') desc = item.o.description || item.o.activityType || '';
        else if (item.kind === 'reference') desc = item.o.relationshipType || '';
        else if (item.kind === 'pivot') desc = (item.o.reason || '').slice(0, 120);
        else desc = item.o.vetoType || '';
        return (
          '<details class="list-row" ' +
          (idx === 0 ? 'open' : '') +
          '><summary><span class="tag ' +
          tag +
          '">' +
          lab +
          '</span> <span class="mono">' +
          escapeHtml(item.o.nodeAlias || '') +
          '</span> <span class="timestamp mono">' +
          new Date(item.t).toISOString() +
          '</span> ' +
          escapeHtml(desc) +
          '</summary><pre class="mono">' +
          escapeHtml(JSON.stringify(item.o, null, 2)) +
          '</pre></details>'
        );
      })
      .join('');

    var shell =
      topbar('dashboard / project') +
      '<div class="page shell-project"><div class="layout"><div class="layout__main">' +
      '<div class="win"><div class="win__title">' +
      escapeHtml(project.title) +
      ' | ' +
      statusTag +
      '</div><div class="win__body">' +
      nftBtn +
      '<div class="win" style="margin-top:16px"><div class="win__title">CONTRIBUTORS</div><div class="win__body list-rows">' +
      contrib +
      '</div></div>';

    if (active) {
      shell +=
        '<div class="action-bar">' +
        '<a class="btn btn--secondary" href="#/projects/' +
        pid +
        '/trace">LOG WORK</a>' +
        '<a class="btn btn--secondary" href="#/projects/' +
        pid +
        '/reference">ADD REFERENCE</a>' +
        '<a class="btn btn--secondary" href="#/projects/' +
        pid +
        '/pivot">RECORD PIVOT</a>' +
        '<a class="btn btn--secondary" href="#/projects/' +
        pid +
        '/veto">RAISE VETO</a>' +
        '<a class="btn btn--secondary" href="#/projects/' +
        pid +
        '/fork">FORK</a>' +
        '<a class="btn btn--danger" href="#/projects/' +
        pid +
        '/credit">END PROJECT</a></div>';
    }

    shell += '<h3 class="mb-2">TIMELINE</h3><div class="list-rows">' + (tlHtml || '<p class="text-muted">Empty.</p>') + '</div>';

    /* sub-views */
    if (route.view === 'project-trace') {
      shell += traceFormHtml(pid);
    } else if (route.view === 'project-reference') {
      shell += referenceFormHtml(pid);
    } else if (route.view === 'project-pivot') {
      shell += pivotFormHtml(pid);
    } else if (route.view === 'project-veto') {
      shell += vetoFormHtml(pid, traces);
    } else if (route.view === 'project-fork') {
      shell += forkFormHtml(pid, project);
    } else if (route.view === 'project-credit') {
      shell += await creditFormHtml(pid, project);
    }

    shell += '</div></div></div></div></div>';
    app.innerHTML = shell;
    attachProjectForms(route, pid, project);
    await bindAppChrome();
  }

  function traceFormHtml(pid) {
    var opts = ACTIVITY_TYPES.map(function (t) {
      return '<option value="' + t + '">' + t + '</option>';
    }).join('');
    return (
      '<div class="win" style="margin-top:24px"><div class="win__title">LOG WORK</div><div class="win__body">' +
      '<div class="tabs"><button type="button" data-tab="m" class="is-active">MICRO</button><button type="button" data-tab="o">MEMO</button><button type="button" data-tab="r">REFLECTION</button></div>' +
      '<form id="form-trace" data-pid="' +
      pid +
      '">' +
      '<input type="hidden" name="mode" value="micro" />' +
      '<div class="field"><label>ACTIVITY</label><select name="activityType">' +
      opts +
      '</select></div>' +
      '<div class="field" id="other-wrap" style="display:none"><label>OTHER DESCRIPTION</label><input name="otherDescription" /></div>' +
      '<div class="field"><label>DESCRIPTION</label><textarea name="description"></textarea></div>' +
      '<div class="field"><label>DURATION (minutes)</label><input name="duration" type="number" min="0" /></div>' +
      '<div class="field"><label>TOOL / SOFTWARE</label><input name="toolSoftware" /></div>' +
      '<details><summary>Proxy log</summary><label><input type="checkbox" name="proxy" /> Enable proxy for another alias</label>' +
      '<input name="proxyForAlias" placeholder="target alias" class="mono" /></details>' +
      '<button type="submit" class="btn btn--primary">LOG WORK</button></form></div></div>'
    );
  }

  function referenceFormHtml(pid) {
    var ropts = REL_TYPES.map(function (t) {
      return '<option value="' + t + '">' + t + '</option>';
    }).join('');
    return (
      '<div class="win" style="margin-top:24px"><div class="win__title">ADD REFERENCE</div><div class="win__body">' +
      '<form id="form-ref" data-pid="' +
      pid +
      '">' +
      '<div class="field"><label>RELATIONSHIP</label><select name="relationshipType">' +
      ropts +
      '</select></div>' +
      '<div class="field" id="ref-other" style="display:none"><label>OTHER EXPLANATION</label><input name="otherExplanation" /></div>' +
      '<div class="field"><label>SOURCE</label><select name="src" id="ref-src"><option value="url">EXTERNAL URL</option><option value="project">ON-CHAIN PROJECT ID</option><option value="cite">CITATION TEXT</option></select></div>' +
      '<div class="field" id="ref-url"><label>URL</label><input name="externalUrl" type="url" /></div>' +
      '<div class="field" id="ref-pid" style="display:none"><label>PROJECT ID</label><input name="sourceProjectId" class="mono" /></div>' +
      '<div class="field" id="ref-cite" style="display:none"><label>CITATION</label><textarea name="citation"></textarea></div>' +
      '<button type="submit" class="btn btn--primary">ADD REFERENCE</button></form></div></div>'
    );
  }

  function pivotFormHtml(pid) {
    return (
      '<div class="win" style="margin-top:24px"><div class="win__title">RECORD PIVOT</div><div class="win__body">' +
      '<p>A pivot records a change in direction. It does not stop the project.</p>' +
      '<form id="form-pivot" data-pid="' +
      pid +
      '"><div class="field"><label>WHAT CHANGED</label><textarea name="reason" required></textarea></div>' +
      '<button type="submit" class="btn btn--primary">RECORD PIVOT</button></form></div></div>'
    );
  }

  function vetoFormHtml(pid, traces) {
    var vopts = VETO_TYPES.map(function (v) {
      return '<option value="' + v + '">' + v + '</option>';
    }).join('');
    var boxes = (traces || [])
      .map(function (t) {
        return (
          '<label class="list-row"><input type="checkbox" name="tid" value="' +
          t._id +
          '" /> <span class="mono">' +
          escapeHtml(String(t._id)) +
          '</span> ' +
          escapeHtml(t.activityType || '') +
          '</label>'
        );
      })
      .join('');
    return (
      '<div class="win" style="margin-top:24px"><div class="win__title">RAISE VETO</div><div class="win__body">' +
      '<form id="form-veto" data-pid="' +
      pid +
      '">' +
      '<div class="field"><label>TYPE</label><select name="vetoType">' +
      vopts +
      '</select></div>' +
      '<p id="veto-help" class="mono text-muted"></p>' +
      '<div class="field"><label>REASON</label><textarea name="reason" required></textarea></div>' +
      '<details><summary>Target traces</summary>' +
      boxes +
      '</details>' +
      '<button type="submit" class="btn btn--danger">RAISE VETO</button></form></div></div>'
    );
  }

  function forkFormHtml(pid, project) {
    return (
      '<div class="win" style="margin-top:24px"><div class="win__title">FORK PROJECT</div><div class="win__body">' +
      '<form id="form-fork" data-pid="' +
      pid +
      '">' +
      '<div class="field"><label>NEW TITLE</label><input name="title" required /></div>' +
      '<div class="field"><label>REASON</label><textarea name="forkReason" required></textarea></div>' +
      '<div class="field"><label>TARGET SPACE ID (optional)</label><input name="targetSpaceId" class="mono" /></div>' +
      '<button type="submit" class="btn btn--primary">CREATE FORK</button></form></div></div>'
    );
  }

  async function creditFormHtml(pid, project) {
    var nft0 = null;
    try {
      nft0 = await api('/credits/project/' + encodeURIComponent(pid));
    } catch (e) {
      nft0 = null;
    }
    var rows = (project.contributors || [])
      .map(function (c) {
        return (
          '<tr><td class="mono">' +
          escapeHtml(c.alias) +
          '</td><td>' +
          escapeHtml(c.role || '') +
          '</td><td><input name="w_' +
          escapeHtml(c.alias) +
          '" type="number" step="0.01" min="0" max="1" placeholder="equal" class="mono" style="width:100px" /></td></tr>'
        );
      })
      .join('');
    var signBlock = '';
    if (nft0 && nft0.nft) {
      var nft = nft0.nft;
      var signed = (project.contributors || [])
        .map(function (c) {
          return (
            '<div class="mono">' +
            escapeHtml(c.alias) +
            ': ' +
            (c.signedAt ? 'signed' : 'pending') +
            '</div>'
          );
        })
        .join('');
      signBlock =
        '<div class="win" style="margin-top:16px"><div class="win__title">SIGN CREDIT</div><div class="win__body">' +
        signed +
        '<form id="form-sign" data-nft="' +
        nft._id +
        '"><label><input type="checkbox" name="accepted" /> I accept this credit split</label>' +
        '<button type="submit" class="btn btn--primary">SIGN</button></form></div></div>';
    }
    return (
      '<div class="win" style="margin-top:24px"><div class="win__title">CREDIT SPLIT</div><div class="win__body">' +
      '<form id="form-credit" data-pid="' +
      pid +
      '">' +
      '<table class="data-table"><thead><tr><th>ALIAS</th><th>ROLE</th><th>WEIGHT</th></tr></thead><tbody>' +
      rows +
      '</tbody></table>' +
      '<p class="text-muted">Leave weights blank for equal split. Weights must sum to 1.0 if specified.</p>' +
      '<div class="field"><label>MEDIUM (optional)</label><input name="medium" /></div>' +
      '<details><summary>Off-chain contributors</summary><textarea name="offChain" placeholder=\'[{"name":"x","portfolio":"","role":""}]\'></textarea></details>' +
      '<label><input type="checkbox" name="dispute" /> Flag as disputed</label>' +
      '<p><button type="submit" class="btn btn--primary">INITIATE CREDIT</button></p></form>' +
      signBlock +
      '</div></div>'
    );
  }

  function attachProjectForms(route, pid, project) {
    var tr = document.getElementById('form-trace');
    if (tr) {
      tr.querySelector('[name="activityType"]').onchange = function () {
        document.getElementById('other-wrap').style.display = this.value === 'other' ? 'block' : 'none';
      };
      tr.onsubmit = async function (e) {
        e.preventDefault();
        var fd = new FormData(tr);
        var mode = fd.get('proxy') ? 'proxy' : fd.get('mode') || 'micro';
        var body = {
          projectId: pid,
          activityType: fd.get('activityType'),
          mode: mode,
          description: fd.get('description') || '',
          duration: fd.get('duration') ? Number(fd.get('duration')) : undefined,
          toolSoftware: fd.get('toolSoftware') || '',
        };
        if (body.activityType === 'other') body.otherDescription = fd.get('otherDescription') || '';
        if (mode === 'proxy') body.proxyForAlias = fd.get('proxyForAlias');
        try {
          var out = await api('/traces', { method: 'POST', body: body });
          tr.insertAdjacentHTML('afterend', flashOk('Trace logged') + rawApi(out));
        } catch (err) {
          tr.insertAdjacentHTML('beforebegin', flashErr(err.message));
        }
      };
      var tabRow = tr.closest('.win') && tr.closest('.win').querySelector('.tabs');
      if (tabRow) {
        var modeInput = tr.querySelector('[name="mode"]');
        tabRow.querySelectorAll('button[data-tab]').forEach(function (b) {
          b.onclick = function () {
            tabRow.querySelectorAll('button').forEach(function (x) {
              x.classList.remove('is-active');
            });
            b.classList.add('is-active');
            var t = b.getAttribute('data-tab');
            modeInput.value = t === 'm' ? 'micro' : t === 'o' ? 'memo' : 'reflection';
          };
        });
      }
    }
    var rf = document.getElementById('form-ref');
    if (rf) {
      rf.querySelector('[name="relationshipType"]').onchange = function () {
        document.getElementById('ref-other').style.display = this.value === 'other' ? 'block' : 'none';
      };
      document.getElementById('ref-src').onchange = function () {
        var v = this.value;
        document.getElementById('ref-url').style.display = v === 'url' ? 'block' : 'none';
        document.getElementById('ref-pid').style.display = v === 'project' ? 'block' : 'none';
        document.getElementById('ref-cite').style.display = v === 'cite' ? 'block' : 'none';
      };
      rf.onsubmit = async function (e) {
        e.preventDefault();
        var fd = new FormData(rf);
        var body = { projectId: pid, relationshipType: fd.get('relationshipType') };
        var src = fd.get('src');
        if (src === 'url') body.externalUrl = fd.get('externalUrl');
        if (src === 'project') body.sourceProjectId = fd.get('sourceProjectId');
        if (src === 'cite') body.citation = fd.get('citation');
        if (body.relationshipType === 'other') body.otherExplanation = fd.get('otherExplanation');
        try {
          var o2 = await api('/references', { method: 'POST', body: body });
          rf.insertAdjacentHTML('afterend', flashOk('Reference added') + rawApi(o2));
        } catch (err) {
          rf.insertAdjacentHTML('beforebegin', flashErr(err.message));
        }
      };
    }
    var pv = document.getElementById('form-pivot');
    if (pv) {
      pv.onsubmit = async function (e) {
        e.preventDefault();
        var fd = new FormData(pv);
        try {
          var o3 = await api('/pivots', { method: 'POST', body: { projectId: pid, reason: fd.get('reason') } });
          pv.insertAdjacentHTML('afterend', flashOk('Pivot recorded') + rawApi(o3));
        } catch (err) {
          pv.insertAdjacentHTML('beforebegin', flashErr(err.message));
        }
      };
    }
    var vo = document.getElementById('form-veto');
    if (vo) {
      var help = {
        hard_stop: 'Halts the project. Requires majority sign-off or veto authority.',
        scope_limit: 'Restricts scope. Takes effect immediately.',
        content_flag: 'Flags targeted content. Takes effect immediately.',
        nda_seal: 'Encrypts targeted traces. Hash stays on chain. Content becomes private.',
      };
      var sel = vo.querySelector('[name="vetoType"]');
      var hp = document.getElementById('veto-help');
      function uh() {
        hp.textContent = help[sel.value] || '';
      }
      sel.onchange = uh;
      uh();
      vo.onsubmit = async function (e) {
        e.preventDefault();
        var fd = new FormData(vo);
        var tids = [];
        vo.querySelectorAll('input[name="tid"]:checked').forEach(function (x) {
          tids.push(x.value);
        });
        try {
          var o4 = await api('/vetos', {
            method: 'POST',
            body: {
              projectId: pid,
              vetoType: fd.get('vetoType'),
              reason: fd.get('reason'),
              targetTraceIds: tids,
            },
          });
          vo.insertAdjacentHTML('afterend', flashOk('Veto raised') + rawApi(o4));
        } catch (err) {
          vo.insertAdjacentHTML('beforebegin', flashErr(err.message));
        }
      };
    }
    var fk = document.getElementById('form-fork');
    if (fk) {
      fk.onsubmit = async function (e) {
        e.preventDefault();
        var fd = new FormData(fk);
        var body = {
          parentProjectId: pid,
          title: fd.get('title'),
          forkReason: fd.get('forkReason'),
        };
        if (fd.get('targetSpaceId')) body.targetSpaceId = fd.get('targetSpaceId');
        try {
          var o5 = await api('/forks', { method: 'POST', body: body });
          fk.insertAdjacentHTML('afterend', flashOk('Fork created') + rawApi(o5));
        } catch (err) {
          fk.insertAdjacentHTML('beforebegin', flashErr(err.message));
        }
      };
    }
    var cr = document.getElementById('form-credit');
    if (cr) {
      cr.onsubmit = async function (e) {
        e.preventDefault();
        var fd = new FormData(cr);
        var contributors = (project.contributors || []).map(function (c) {
          var w = fd.get('w_' + c.alias);
          var o = { alias: c.alias, role: c.role };
          if (w !== '' && w != null) o.weight = Number(w);
          return o;
        });
        var body = {
          projectId: pid,
          medium: fd.get('medium') || undefined,
          contributors: contributors,
          disputeFlag: !!fd.get('dispute'),
        };
        if (fd.get('offChain')) {
          try {
            body.offChainContributors = JSON.parse(fd.get('offChain'));
          } catch (e) {
            cr.insertAdjacentHTML('beforebegin', flashErr('Off-chain JSON invalid'));
            return;
          }
        }
        try {
          var o6 = await api('/credits', { method: 'POST', body: body });
          cr.insertAdjacentHTML('afterend', flashOk('Credit initiated') + rawApi(o6));
        } catch (err) {
          cr.insertAdjacentHTML('beforebegin', flashErr(err.message));
        }
      };
    }
    var sg = document.getElementById('form-sign');
    if (sg) {
      sg.onsubmit = async function (e) {
        e.preventDefault();
        var nftId = sg.getAttribute('data-nft');
        try {
          var o7 = await api('/credits/' + encodeURIComponent(nftId) + '/sign', {
            method: 'POST',
            body: { accepted: !!sg.querySelector('[name="accepted"]').checked },
          });
          sg.insertAdjacentHTML('afterend', flashOk('Signature recorded.') + rawApi(o7));
        } catch (err) {
          sg.insertAdjacentHTML('beforebegin', flashErr(err.message));
        }
      };
    }
  }

  async function renderSpaceWizard() {
    var app = document.getElementById('app');
    var step = spc.step;
    var segs = [1, 2, 3, 4, 5]
      .map(function (n) {
        return '<div class="wiz-bar__seg' + (n <= step ? ' is-done' : '') + '"></div>';
      })
      .join('');
    var body = '';
    if (step === 1) {
      body =
        '<form id="wiz-sp"><div class="field"><label>NAME</label><input name="name" required /></div>' +
        '<div class="field"><label>DESCRIPTION</label><textarea name="description"></textarea></div>' +
        '<button type="submit" class="btn btn--primary">NEXT</button></form>';
    } else if (step === 2) {
      body =
        '<form id="wiz-sp"><label><input type="radio" name="projectAccess" value="open" checked /> open</label><br/>' +
        '<label><input type="radio" name="projectAccess" value="invite_only" /> invite only</label><br/>' +
        '<label><input type="radio" name="projectAccess" value="application" /> application</label>' +
        '<p><button type="submit" class="btn btn--primary">NEXT</button></p></form>';
    } else if (step === 3) {
      body =
        '<form id="wiz-sp"><div class="field"><label>VETO AUTHORITY (comma aliases)</label><input name="vetoAuthority" /></div>' +
        '<div class="field"><label>VOTING THRESHOLD (0–1)</label><input name="votingThreshold" type="number" step="0.05" min="0" max="1" value="0.5" /></div>' +
        '<label><input type="checkbox" name="customContractsAllowed" checked /> Custom contracts allowed</label>' +
        '<p><button type="submit" class="btn btn--primary">NEXT</button></p></form>';
    } else if (step === 4) {
      body =
        '<form id="wiz-sp"><label><input type="radio" name="privacyDefault" value="public" /> public</label><br/>' +
        '<label><input type="radio" name="privacyDefault" value="space_specific" checked /> space only</label><br/>' +
        '<label><input type="radio" name="privacyDefault" value="private" /> private</label>' +
        '<div class="field"><label>CONTENT RESTRICTIONS (comma)</label><input name="contentRestrictions" /></div>' +
        '<p><button type="submit" class="btn btn--primary">NEXT</button></p></form>';
    } else {
      body =
        '<p class="mono">' +
        JSON.stringify(spc.data, null, 2) +
        '</p><button type="button" class="btn btn--primary" id="btn-create-space">CREATE SPACE</button>';
    }
    app.innerHTML =
      topbar('dashboard / spaces / new') +
      '<div class="page"><div class="win"><div class="win__title">CREATE SPACE</div><div class="win__body">' +
      '<div class="wiz-bar">' +
      segs +
      '</div>' +
      body +
      '</div></div></div>';
    var f = document.getElementById('wiz-sp');
    if (f) {
      f.onsubmit = async function (e) {
        e.preventDefault();
        var fd = new FormData(f);
        if (step === 1) {
          spc.data.name = fd.get('name');
          spc.data.description = fd.get('description');
        } else if (step === 2) {
          spc.data.projectAccess = fd.get('projectAccess');
        } else if (step === 3) {
          spc.data.vetoAuthority = (fd.get('vetoAuthority') || '')
            .toString()
            .split(',')
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
          spc.data.votingThreshold = Number(fd.get('votingThreshold'));
          spc.data.customContractsAllowed = !!fd.get('customContractsAllowed');
        } else if (step === 4) {
          spc.data.privacyDefault = fd.get('privacyDefault');
          spc.data.contentRestrictions = (fd.get('contentRestrictions') || '')
            .toString()
            .split(',')
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
        }
        spc.step++;
        await renderSpaceWizard();
      };
    }
    var btn = document.getElementById('btn-create-space');
    if (btn) {
      btn.onclick = async function () {
        try {
          var settings = {
            projectAccess: spc.data.projectAccess || 'open',
            vetoAuthority: spc.data.vetoAuthority || [],
            votingThreshold: spc.data.votingThreshold != null ? spc.data.votingThreshold : 0.5,
            privacyDefault: spc.data.privacyDefault || 'space_specific',
            customContractsAllowed: spc.data.customContractsAllowed !== false,
            contentRestrictions: spc.data.contentRestrictions || [],
          };
          var out = await api('/spaces', {
            method: 'POST',
            body: {
              name: spc.data.name,
              description: spc.data.description || '',
              settings: settings,
            },
          });
          localStorage.setItem(LS_SPACE, out._id);
          document.querySelector('.win__body').insertAdjacentHTML(
            'afterbegin',
            flashOk('Space created. ID: ' + out._id) +
              ' <button type="button" class="btn btn--secondary" id="cp-ns">COPY ID</button>' +
              rawApi(out),
          );
          document.getElementById('cp-ns').onclick = function () {
            navigator.clipboard.writeText(out._id);
          };
        } catch (err) {
          document.querySelector('.win__body').insertAdjacentHTML('afterbegin', flashErr(err.message));
        }
      };
    }
    await bindAppChrome();
  }

  async function bindAppChrome() {
    bindSignOut();
    var bodyEl = document.getElementById('notif-panel-body');
    if (!bodyEl) return;
    try {
      var notes = await api('/notifications');
      var unread = 0;
      var nh = '';
      for (var n = 0; n < notes.length; n++) {
        if (!notes[n].read) unread++;
        var rd = notes[n].read ? 'read' : 'unread';
        nh +=
          '<div class="list-row"><div>' +
          escapeHtml(notes[n].message || notes[n].type || 'notification') +
          '<div class="notif-meta">' +
          rd +
          '</div></div></div>';
      }
      bodyEl.innerHTML = nh || '<p class="text-muted">No notifications.</p>';
      var badge = document.getElementById('notif-badge-count');
      if (badge) {
        if (unread > 0) {
          badge.textContent = String(unread);
          badge.hidden = false;
        } else {
          badge.hidden = true;
        }
      }
    } catch (e) {
      bodyEl.innerHTML = '<p class="text-muted">Could not load notifications.</p>';
    }
    var br = document.getElementById('btn-notify-read');
    if (br) {
      br.onclick = async function () {
        try {
          await api('/notifications/read-all', { method: 'PATCH' });
          render();
        } catch (err) {
          alert(err.message);
        }
      };
    }
  }

  function bindSignOut() {
    var b = document.getElementById('btn-signout');
    if (b)
      b.onclick = function () {
        clearSession();
        location.hash = '#/';
        render();
      };
  }

  window.addEventListener('hashchange', render);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
