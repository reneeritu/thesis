/**
 * AURA2 — vanilla SPA (hash router, no frameworks)
 */
(function () {
  'use strict';

  var LS = {
    token: 'aura2_token',
    alias: 'aura2_alias',
    spaceId: 'aura2_spaceId',
    projectId: 'aura2_projectId',
  };

  var SS_PENDING_SEED = 'aura2_pending_seed';

  var ACTIVITY_TYPES = [
    'brainstorm',
    'primary_research',
    'secondary_research',
    'iterate',
    'skillwork',
    'fabrication',
    'pedagogy',
    'admin',
    'review',
    'ai_tool',
    'other',
  ];

  var RELATIONSHIP_TYPES = [
    'inspired_by',
    'built_on',
    'forked_from',
    'in_response_to',
    'pedagogical_source',
    'ai_generated',
    'other',
  ];

  var EVIDENCE_TYPES = [
    'photos_of_work',
    'process_photos',
    'sketches',
    'dated_files',
    'social_post',
    'videos',
    'voice_recordings',
    'audio',
    'exhibit_record',
    'institution_record',
    'url',
    'portfolio_link',
    'other',
  ];

  var VETO_TYPES = ['hard_stop', 'scope_limit', 'content_flag', 'nda_seal'];

  var RADAR_AXES = [
    'craft',
    'research',
    'collaboration',
    'pedagogy',
    'consistency',
    'community',
  ];

  function apiBase() {
    var meta = document.querySelector('meta[name="aura-api-base"]');
    var fromMeta = meta && meta.getAttribute('content');
    fromMeta = (fromMeta || '').trim().replace(/\/$/, '');
    if (fromMeta) return fromMeta;
    if (typeof location !== 'undefined' && location.origin && location.origin !== 'null') {
      return location.origin.replace(/\/$/, '');
    }
    throw new Error('Cannot determine API URL. Set meta aura-api-base or open from the server origin.');
  }

  function getToken() {
    return localStorage.getItem(LS.token);
  }

  function getAlias() {
    return localStorage.getItem(LS.alias);
  }

  function looksLikeHtml(t) {
    if (!t || typeof t !== 'string') return false;
    var s = t.slice(0, 256).trim().toLowerCase();
    return s.indexOf('<!doctype') === 0 || s.indexOf('<html') === 0;
  }

  function htmlGatewayPayload(res, text) {
    var titleMatch = text.match(/<title>([^<]{0,120})<\/title>/i);
    var pageTitle = titleMatch ? titleMatch[1].trim() : '';
    var hint =
      res.status === 502
        ? '502 Bad Gateway: the host could not reach the API. Check server logs, env, and that the app listens on PORT.'
        : res.status === 503 || res.status === 504
          ? 'Service temporarily unavailable — try again shortly.'
          : 'The API URL may be wrong, or only static files are served on that host.';
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
          return (Array.isArray(d.path) ? d.path.join('.') : d.path || '?') + ': ' + d.message;
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

  function showError(msg) {
    var el = document.getElementById('global-error');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  function clearError() {
    showError('');
  }

  function appendApiDetails(container, data, summaryText) {
    var d = document.createElement('details');
    d.className = 'api-details';
    var s = document.createElement('summary');
    s.textContent = summaryText || 'Raw API response';
    var pre = document.createElement('pre');
    try {
      pre.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
      pre.textContent = String(data);
    }
    d.appendChild(s);
    d.appendChild(pre);
    container.appendChild(d);
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {{ body?: object, auth?: boolean }} [opts]
   */
  function apiFetch(method, path, opts) {
    opts = opts || {};
    var url = apiBase() + path;
    var headers = { Accept: 'application/json' };
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (opts.auth) {
      var t = getToken();
      if (!t) return Promise.reject(new Error('Not signed in.'));
      headers.Authorization = 'Bearer ' + t;
    }
    return fetch(url, {
      method: method,
      headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      return res.text().then(function (text) {
        var data;
        if (text && !looksLikeHtml(text)) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            data = { error: text || res.statusText, httpStatus: res.status };
          }
        } else if (text && looksLikeHtml(text)) {
          data = htmlGatewayPayload(res, text);
        } else {
          data = { error: res.statusText || 'Empty response', httpStatus: res.status };
        }
        if (!res.ok) {
          var err = new Error(formatError(data));
          err.data = data;
          err.status = res.status;
          return Promise.reject(err);
        }
        return data;
      });
    });
  }

  function parseRoute() {
    var raw = (location.hash || '#/').replace(/^#\/?/, '').trim();
    var segs = raw ? raw.split('/').filter(Boolean) : [];

    if (segs.length === 0) return { name: 'home', params: {} };
    if (segs[0] === 'register' && segs.length === 1) return { name: 'register', params: {} };
    if (segs[0] === 'login' && segs.length === 1) return { name: 'login', params: {} };
    if (segs[0] === 'me' && segs.length === 1) return { name: 'me', params: {} };
    if (segs[0] === 'spaces' && segs.length === 1) return { name: 'spaces', params: {} };
    if (segs[0] === 'spaces' && segs.length === 2) return { name: 'space', params: { id: segs[1] } };
    if (segs[0] === 'projects' && segs[1] === 'new' && segs.length === 2) return { name: 'projectNew', params: {} };
    if (segs[0] === 'projects' && segs.length === 2)
      return { name: 'project', params: { id: segs[1] } };
    if (segs[0] === 'projects' && segs.length === 3 && segs[2] === 'trace')
      return { name: 'trace', params: { id: segs[1] } };
    if (segs[0] === 'projects' && segs.length === 3 && segs[2] === 'reference')
      return { name: 'reference', params: { id: segs[1] } };
    if (segs[0] === 'projects' && segs.length === 3 && segs[2] === 'pivot')
      return { name: 'pivot', params: { id: segs[1] } };
    if (segs[0] === 'projects' && segs.length === 3 && segs[2] === 'credit')
      return { name: 'credit', params: { id: segs[1] } };
    if (segs[0] === 'archive' && segs[1] === 'new' && segs.length === 2) return { name: 'archiveNew', params: {} };
    if (segs[0] === 'nfts' && segs.length === 2) return { name: 'nft', params: { id: segs[1] } };
    if (segs[0] === 'nodes' && segs.length === 2) return { name: 'node', params: { alias: segs[1] } };

    return { name: 'unknown', params: { raw: raw } };
  }

  function updateTopBar() {
    var right = document.getElementById('top-bar-right');
    if (!right) return;
    right.innerHTML = '';
    var alias = getAlias();
    var token = getToken();
    if (token && alias) {
      var a = document.createElement('a');
      a.href = '#/me';
      a.className = 'top-bar__alias';
      a.textContent = alias;
      right.appendChild(a);
      var sep = document.createTextNode(' | ');
      right.appendChild(sep);
      var out = document.createElement('button');
      out.type = 'button';
      out.className = 'btn btn--secondary';
      out.textContent = 'SIGN OUT';
      out.addEventListener('click', function () {
        localStorage.removeItem(LS.token);
        localStorage.removeItem(LS.alias);
        sessionStorage.removeItem(SS_PENDING_SEED);
        location.hash = '#/';
        render();
      });
      right.appendChild(out);
    }
  }

  function radarSvg(categories) {
    categories = categories || {};
    var values = RADAR_AXES.map(function (k) {
      var v = Number(categories[k]) || 0;
      return v;
    });
    var maxV = Math.max.apply(null, values.concat([1]));
    var norm = values.map(function (v) {
      var r = maxV > 0 ? v / maxV : 0;
      return Math.max(0.1, r);
    });

    var cx = 100;
    var cy = 100;
    var R = 70;
    var pts = [];
    for (var i = 0; i < 6; i++) {
      var angle = (-Math.PI / 2 + (i * 2 * Math.PI) / 6);
      var r = R * norm[i];
      pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    var pathD =
      'M' +
      pts
        .map(function (p) {
          return p[0].toFixed(2) + ',' + p[1].toFixed(2);
        })
        .join(' L') +
      ' Z';

    var lines = '';
    for (var j = 0; j < 6; j++) {
      var ang = (-Math.PI / 2 + (j * 2 * Math.PI) / 6);
      var x2 = cx + R * Math.cos(ang);
      var y2 = cy + R * Math.sin(ang);
      lines +=
        '<line x1="' +
        cx +
        '" y1="' +
        cy +
        '" x2="' +
        x2.toFixed(2) +
        '" y2="' +
        y2.toFixed(2) +
        '" stroke="#000" stroke-width="0.5"/>';
    }

    var labels = '';
    for (var k = 0; k < 6; k++) {
      var ag = (-Math.PI / 2 + (k * 2 * Math.PI) / 6);
      var lx = cx + (R + 18) * Math.cos(ag);
      var ly = cy + (R + 18) * Math.sin(ag);
      labels +=
        '<text x="' +
        lx.toFixed(1) +
        '" y="' +
        ly.toFixed(1) +
        '" font-size="8" text-anchor="middle" fill="#000">' +
        RADAR_AXES[k] +
        '</text>';
    }

    return (
      '<div class="radar-wrap"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-label="Reputation radar">' +
      '<polygon points="' +
      cx +
      ',' +
      cy +
      ' ' +
      (cx + R) +
      ',' +
      cy +
      '" fill="none" stroke="transparent"/>' +
      lines +
      '<polygon fill="#6b21a8" fill-opacity="0.35" stroke="#6b21a8" stroke-width="1" d="' +
      pathD +
      '"/>' +
      '<circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="' +
      R +
      '" fill="none" stroke="#000" stroke-width="1"/>' +
      labels +
      '</svg></div>'
    );
  }

  function isMyProject(p, me) {
    if (!p || !me) return false;
    if (p.creatorAlias === me) return true;
    return (p.contributors || []).some(function (c) {
      return c.alias === me;
    });
  }

  function statusTagClass(st) {
    var s = (st || '').toLowerCase();
    if (s === 'active') return 'tag tag--status-active';
    if (s === 'completed' || s === 'archived') return 'tag tag--status-completed';
    return 'tag';
  }

  function sha256HexUtf8(str) {
    var enc = new TextEncoder();
    return crypto.subtle.digest('SHA-256', enc.encode(str)).then(function (buf) {
      var arr = Array.from(new Uint8Array(buf));
      return arr.map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    });
  }

  function fillSelect(sel, options) {
    options.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt;
      o.textContent = opt.replace(/_/g, ' ');
      sel.appendChild(o);
    });
  }

  function renderAuthDual(app, routeName) {
    var wrap = document.createElement('div');
    if (routeName === 'register' || routeName === 'login') {
      var single = document.createElement('div');
      single.className = 'panel';
      if (routeName === 'register') {
        single.appendChild(document.createElement('h1')).textContent = 'Register';
        single.appendChild(buildRegisterForm(true));
        var p1 = document.createElement('p');
        p1.className = 'hint';
        p1.innerHTML =
          'Already have an account? <a href="#/login">Login</a> · <a href="#/">Both forms</a>';
        single.appendChild(p1);
      } else {
        single.appendChild(document.createElement('h1')).textContent = 'Login';
        single.appendChild(buildLoginForm(true));
        var p2 = document.createElement('p');
        p2.className = 'hint';
        p2.innerHTML =
          'Need an account? <a href="#/register">Register</a> · <a href="#/">Both forms</a>';
        single.appendChild(p2);
      }
      wrap.appendChild(single);
      app.appendChild(wrap);
      return;
    }

    var h1 = document.createElement('h1');
    h1.textContent = 'Sign in or register';
    wrap.appendChild(h1);
    var hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent =
      'Alias: lowercase, no spaces (letters, numbers, _ and -). Password: at least 8 characters.';
    wrap.appendChild(hint);

    var grid = document.createElement('div');
    grid.className = 'grid-2';
    var left = document.createElement('div');
    left.className = 'panel';
    left.appendChild(document.createElement('h2')).textContent = 'Register';
    left.appendChild(buildRegisterForm(false));
    var right = document.createElement('div');
    right.className = 'panel';
    right.appendChild(document.createElement('h2')).textContent = 'Login';
    right.appendChild(buildLoginForm(false));
    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);

    var foot = document.createElement('p');
    foot.className = 'hint';
    foot.innerHTML =
      '<a href="#/register">Register only</a> · <a href="#/login">Login only</a>';
    wrap.appendChild(foot);

    app.appendChild(wrap);
  }

  function buildRegisterForm(singleColumn) {
    var form = document.createElement('form');
    var lblA = document.createElement('label');
    lblA.htmlFor = 'reg-alias';
    lblA.textContent = 'Alias';
    var inA = document.createElement('input');
    inA.id = 'reg-alias';
    inA.name = 'alias';
    inA.autocomplete = 'username';
    inA.required = true;
    var lblP = document.createElement('label');
    lblP.htmlFor = 'reg-password';
    lblP.textContent = 'Password';
    var inP = document.createElement('input');
    inP.id = 'reg-password';
    inP.type = 'password';
    inP.autocomplete = 'new-password';
    inP.required = true;
    inP.minLength = 8;
    var btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'btn';
    btn.textContent = 'Register';
    form.appendChild(lblA);
    form.appendChild(inA);
    form.appendChild(lblP);
    form.appendChild(inP);
    form.appendChild(btn);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();
      var alias = inA.value.trim().toLowerCase();
      var password = inP.value;
      apiFetch('POST', '/auth/register', {
        body: { alias: alias, password: password },
      })
        .then(function (data) {
          localStorage.setItem(LS.token, data.token);
          localStorage.setItem(LS.alias, data.alias);
          if (data.seedPhrase) sessionStorage.setItem(SS_PENDING_SEED, data.seedPhrase);
          appendApiDetails(form.parentElement || form, data, 'Raw API response');
          location.hash = '#/';
          render();
        })
        .catch(function (err) {
          showError(err.message || String(err));
        });
    });
    return form;
  }

  function buildLoginForm(singleColumn) {
    var form = document.createElement('form');
    var lblA = document.createElement('label');
    lblA.htmlFor = 'login-alias';
    lblA.textContent = 'Alias';
    var inA = document.createElement('input');
    inA.id = 'login-alias';
    inA.autocomplete = 'username';
    inA.required = true;
    var lblP = document.createElement('label');
    lblP.htmlFor = 'login-password';
    lblP.textContent = 'Password';
    var inP = document.createElement('input');
    inP.id = 'login-password';
    inP.type = 'password';
    inP.autocomplete = 'current-password';
    inP.required = true;
    var btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'btn';
    btn.textContent = 'Login';
    form.appendChild(lblA);
    form.appendChild(inA);
    form.appendChild(lblP);
    form.appendChild(inP);
    form.appendChild(btn);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();
      apiFetch('POST', '/auth/login', {
        body: { alias: inA.value.trim().toLowerCase(), password: inP.value },
      })
        .then(function (data) {
          localStorage.setItem(LS.token, data.token);
          localStorage.setItem(LS.alias, data.alias);
          sessionStorage.removeItem(SS_PENDING_SEED);
          appendApiDetails(form.parentElement || form, data, 'Raw API response');
          location.hash = '#/';
          render();
        })
        .catch(function (err) {
          showError(err.message || String(err));
        });
    });
    return form;
  }

  function renderSeedTakeover(app) {
    var phrase = sessionStorage.getItem(SS_PENDING_SEED) || '';
    var words = phrase.split(/\s+/).filter(Boolean);
    app.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'takeover';
    var h1 = document.createElement('h1');
    h1.textContent = 'YOUR SEED PHRASE. WRITE THIS DOWN. YOU WILL NEVER SEE IT AGAIN.';
    wrap.appendChild(h1);
    var box = document.createElement('div');
    box.className = 'seed-box mono';
    box.textContent = words.length ? words.join(' ') : phrase;
    wrap.appendChild(box);
    var chkLbl = document.createElement('label');
    chkLbl.className = 'checkbox-row';
    var chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.id = 'seed-ack';
    var span = document.createElement('span');
    span.textContent = 'I have written down my seed phrase';
    chkLbl.appendChild(chk);
    chkLbl.appendChild(span);
    wrap.appendChild(chkLbl);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = 'Continue';
    btn.disabled = true;
    chk.addEventListener('change', function () {
      btn.disabled = !chk.checked;
    });
    btn.addEventListener('click', function () {
      sessionStorage.removeItem(SS_PENDING_SEED);
      location.hash = '#/';
      render();
    });
    wrap.appendChild(btn);
    app.appendChild(wrap);
  }

  function renderDashboard(app) {
    var alias = getAlias();
    clearError();
    app.innerHTML = '<p class="hint">Loading…</p>';
    apiFetch('GET', '/nodes/' + encodeURIComponent(alias), { auth: true })
      .then(function (node) {
        var spaceIds = (node.spaces || []).map(function (id) {
          return String(id);
        });
        return Promise.all(
          spaceIds.map(function (sid) {
            return apiFetch('GET', '/spaces/' + encodeURIComponent(sid), { auth: true }).catch(function () {
              return { _id: sid, name: sid, error: true };
            });
          }),
        ).then(function (spaces) {
          return Promise.all(
            spaceIds.map(function (sid) {
              return apiFetch('GET', '/projects/space/' + encodeURIComponent(sid), {
                auth: true,
              }).catch(function () {
                return [];
              });
            }),
          ).then(function (projectLists) {
            var byId = {};
            projectLists.forEach(function (list) {
              (list || []).forEach(function (p) {
                if (isMyProject(p, alias)) byId[p._id] = p;
              });
            });
            var myProjects = Object.keys(byId).map(function (k) {
              return byId[k];
            });
            myProjects.sort(function (a, b) {
              return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
            });

            app.innerHTML = '';
            var title = document.createElement('div');
            title.style.fontSize = '2rem';
            title.style.marginBottom = '1.5rem';
            title.style.textTransform = 'uppercase';
            title.style.letterSpacing = '0.08em';
            title.textContent = alias;
            app.appendChild(title);

            app.insertAdjacentHTML('beforeend', radarSvg(node.reputationCategories));

            var hBad = document.createElement('h2');
            hBad.textContent = 'Affirmative badges';
            app.appendChild(hBad);
            if ((node.badges || []).length === 0) {
              var nb = document.createElement('p');
              nb.className = 'hint';
              nb.textContent = 'None yet.';
              app.appendChild(nb);
            } else {
              var ulb = document.createElement('ul');
              ulb.className = 'list-plain';
              node.badges.forEach(function (b) {
                var li = document.createElement('li');
                li.textContent = b;
                ulb.appendChild(li);
              });
              app.appendChild(ulb);
            }

            var grid = document.createElement('div');
            grid.className = 'grid-2';
            var colS = document.createElement('div');
            colS.className = 'panel';
            colS.appendChild(document.createElement('h2')).textContent = 'My spaces';
            var uls = document.createElement('ul');
            uls.className = 'list-plain';
            spaces.forEach(function (sp) {
              var li = document.createElement('li');
              var name = document.createTextNode((sp.name || sp._id) + ' ');
              li.appendChild(name);
              var va = document.createElement('a');
              va.href = '#/spaces/' + encodeURIComponent(sp._id);
              va.textContent = 'VIEW';
              li.appendChild(va);
              uls.appendChild(li);
            });
            if (spaces.length === 0) {
              var es = document.createElement('p');
              es.className = 'hint';
              es.textContent = 'No spaces yet.';
              colS.appendChild(es);
            } else colS.appendChild(uls);

            var colP = document.createElement('div');
            colP.className = 'panel';
            colP.appendChild(document.createElement('h2')).textContent = 'My projects';
            var ulp = document.createElement('ul');
            ulp.className = 'list-plain';
            myProjects.forEach(function (p) {
              var li = document.createElement('li');
              li.appendChild(document.createTextNode(p.title + ' '));
              var tg = document.createElement('span');
              tg.className = statusTagClass(p.status);
              tg.textContent = (p.status || '').toUpperCase();
              li.appendChild(tg);
              li.appendChild(document.createTextNode(' '));
              var va = document.createElement('a');
              va.href = '#/projects/' + encodeURIComponent(p._id);
              va.textContent = 'VIEW';
              li.appendChild(va);
              ulp.appendChild(li);
            });
            if (myProjects.length === 0) {
              var ep = document.createElement('p');
              ep.className = 'hint';
              ep.textContent = 'No projects yet.';
              colP.appendChild(ep);
            } else colP.appendChild(ulp);

            grid.appendChild(colS);
            grid.appendChild(colP);
            app.appendChild(grid);

            var actions = document.createElement('div');
            actions.className = 'row-actions';
            [
              ['CREATE SPACE', '#/spaces'],
              ['JOIN SPACE', '#/spaces'],
              ['NEW PROJECT', '#/projects/new'],
              ['ARCHIVE PAST WORK', '#/archive/new'],
            ].forEach(function (pair) {
              var b = document.createElement('a');
              b.href = pair[1];
              b.className = 'btn';
              b.textContent = pair[0];
              actions.appendChild(b);
            });
            app.appendChild(actions);

            appendApiDetails(app, { node: node, spaces: spaces, myProjects: myProjects }, 'Raw API response');
          });
        });
      })
      .catch(function (err) {
        app.innerHTML = '';
        showError(err.message || String(err));
      });
  }

  function renderSpaces(app) {
    var alias = getAlias();
    app.innerHTML = '';
    var h1 = document.createElement('h1');
    h1.textContent = 'My spaces';
    app.appendChild(h1);

    var createPanel = document.createElement('div');
    createPanel.className = 'panel';
    createPanel.appendChild(document.createElement('h2')).textContent = 'Create space';
    var cform = document.createElement('form');
    var l1 = document.createElement('label');
    l1.htmlFor = 'sp-name';
    l1.textContent = 'Name';
    var i1 = document.createElement('input');
    i1.id = 'sp-name';
    i1.required = true;
    cform.appendChild(l1);
    cform.appendChild(i1);
    var sub = document.createElement('button');
    sub.type = 'submit';
    sub.className = 'btn';
    sub.textContent = 'Create';
    cform.appendChild(sub);
    cform.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();
      apiFetch('POST', '/spaces', { auth: true, body: { name: i1.value.trim() } })
        .then(function (data) {
          appendApiDetails(createPanel, data, 'Raw API response');
          localStorage.setItem(LS.spaceId, data._id);
          i1.value = '';
          render();
        })
        .catch(function (err) {
          showError(err.message || String(err));
        });
    });
    createPanel.appendChild(cform);
    app.appendChild(createPanel);

    var joinPanel = document.createElement('div');
    joinPanel.className = 'panel';
    joinPanel.appendChild(document.createElement('h2')).textContent = 'Join space';
    var jform = document.createElement('form');
    var l2 = document.createElement('label');
    l2.htmlFor = 'sp-id';
    l2.textContent = 'Space ID';
    var i2 = document.createElement('input');
    i2.id = 'sp-id';
    i2.required = true;
    var l3 = document.createElement('label');
    l3.htmlFor = 'sp-invite';
    l3.textContent = 'Invite code (if required)';
    var i3 = document.createElement('input');
    i3.id = 'sp-invite';
    jform.appendChild(l2);
    jform.appendChild(i2);
    jform.appendChild(l3);
    jform.appendChild(i3);
    var jsub = document.createElement('button');
    jsub.type = 'submit';
    jsub.className = 'btn';
    jsub.textContent = 'Join';
    jform.appendChild(jsub);
    jform.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();
      var body = {};
      if (i3.value.trim()) body.inviteCode = i3.value.trim();
      apiFetch('POST', '/spaces/' + encodeURIComponent(i2.value.trim()) + '/join', {
        auth: true,
        body: body,
      })
        .then(function (data) {
          appendApiDetails(joinPanel, data, 'Raw API response');
          render();
        })
        .catch(function (err) {
          showError(err.message || String(err));
        });
    });
    joinPanel.appendChild(jform);
    app.appendChild(joinPanel);

    apiFetch('GET', '/nodes/' + encodeURIComponent(alias), { auth: true })
      .then(function (node) {
        var ids = (node.spaces || []).map(String);
        return Promise.all(
          ids.map(function (sid) {
            return apiFetch('GET', '/spaces/' + encodeURIComponent(sid), { auth: true });
          }),
        ).then(function (spaces) {
          var list = document.createElement('ul');
          list.className = 'list-plain';
          spaces.forEach(function (sp) {
            var li = document.createElement('li');
            li.appendChild(document.createTextNode(sp.name + ' '));
            var a = document.createElement('a');
            a.href = '#/spaces/' + encodeURIComponent(sp._id);
            a.textContent = 'VIEW';
            li.appendChild(a);
            list.appendChild(li);
          });
          if (spaces.length === 0) {
            var em = document.createElement('p');
            em.className = 'hint';
            em.textContent = 'You are not in any spaces yet.';
            app.appendChild(em);
          } else {
            var h2 = document.createElement('h2');
            h2.textContent = 'Your spaces';
            app.appendChild(h2);
            app.appendChild(list);
          }
          appendApiDetails(app, { spaces: spaces }, 'Raw API response');
        });
      })
      .catch(function (err) {
        showError(err.message || String(err));
      });
  }

  function renderSpaceDetail(app, spaceId) {
    app.innerHTML = '';
    clearError();
    Promise.all([
      apiFetch('GET', '/spaces/' + encodeURIComponent(spaceId), { auth: true }),
      apiFetch('GET', '/projects/space/' + encodeURIComponent(spaceId), { auth: true }),
    ])
      .then(function (pair) {
        var space = pair[0];
        var projects = pair[1] || [];
        localStorage.setItem(LS.spaceId, spaceId);
        var h1 = document.createElement('h1');
        h1.textContent = space.name;
        app.appendChild(h1);
        var idRow = document.createElement('p');
        idRow.className = 'mono';
        idRow.textContent = 'Space ID: ' + space._id;
        var copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn btn--secondary';
        copyBtn.textContent = 'COPY';
        copyBtn.style.marginLeft = '0.75rem';
        copyBtn.style.marginTop = '0';
        copyBtn.addEventListener('click', function () {
          navigator.clipboard.writeText(String(space._id)).then(
            function () {
              appendApiDetails(app, { copied: String(space._id) }, 'Copy result');
            },
            function () {
              showError('Could not copy to clipboard.');
            },
          );
        });
        var idWrap = document.createElement('div');
        idWrap.appendChild(idRow);
        idWrap.appendChild(copyBtn);
        app.appendChild(idWrap);
        var mc = document.createElement('p');
        mc.textContent = 'Members: ' + (space.members || []).length;
        app.appendChild(mc);

        var h2 = document.createElement('h2');
        h2.textContent = 'Projects';
        app.appendChild(h2);
        var ul = document.createElement('ul');
        ul.className = 'list-plain';
        projects.forEach(function (p) {
          var li = document.createElement('li');
          li.appendChild(document.createTextNode(p.title + ' '));
          var tg = document.createElement('span');
          tg.className = statusTagClass(p.status);
          tg.textContent = (p.status || '').toUpperCase();
          li.appendChild(tg);
          li.appendChild(document.createTextNode(' '));
          var a = document.createElement('a');
          a.href = '#/projects/' + encodeURIComponent(p._id);
          a.textContent = 'VIEW';
          li.appendChild(a);
          ul.appendChild(li);
        });
        if (projects.length === 0) {
          var em = document.createElement('p');
          em.className = 'hint';
          em.textContent = 'No projects in this space.';
          app.appendChild(em);
        } else app.appendChild(ul);

        var np = document.createElement('a');
        np.href = '#/projects/new';
        np.className = 'btn';
        np.textContent = 'NEW PROJECT IN THIS SPACE';
        np.addEventListener('click', function () {
          localStorage.setItem(LS.spaceId, spaceId);
        });
        app.appendChild(np);

        appendApiDetails(app, { space: space, projects: projects }, 'Raw API response');
      })
      .catch(function (err) {
        showError(err.message || String(err));
      });
  }

  function mergeTimeline(traces, refs, pivots, vetos) {
    var items = [];
    (traces || []).forEach(function (t) {
      items.push({
        sort: new Date(t.createdAt || t.timestamp).getTime(),
        type: 'TRACE',
        alias: t.nodeAlias,
        ts: t.createdAt || t.timestamp,
        text:
          (t.activityType || '') +
          (t.description ? ' — ' + t.description : '') +
          (t.otherDescription ? ' — ' + t.otherDescription : ''),
      });
    });
    (refs || []).forEach(function (r) {
      items.push({
        sort: new Date(r.createdAt).getTime(),
        type: 'REFERENCE',
        alias: r.nodeAlias,
        ts: r.createdAt,
        text: (r.externalUrl || r.citation || r.sourceProjectId || '').slice(0, 200),
      });
    });
    (pivots || []).forEach(function (p) {
      items.push({
        sort: new Date(p.createdAt).getTime(),
        type: 'PIVOT',
        alias: p.nodeAlias || '—',
        ts: p.createdAt,
        text: p.reason || '',
      });
    });
    (vetos || []).forEach(function (v) {
      items.push({
        sort: new Date(v.createdAt).getTime(),
        type: 'VETO',
        alias: v.nodeAlias,
        ts: v.createdAt,
        text: (v.vetoType || '') + ' — reason stored on chain as hash: ' + (v.reasonHash || '').slice(0, 16) + '…',
      });
    });
    items.sort(function (a, b) {
      return a.sort - b.sort;
    });
    return items;
  }

  function renderProject(app, projectId) {
    app.innerHTML = '';
    clearError();
    localStorage.setItem(LS.projectId, projectId);
    Promise.all([
      apiFetch('GET', '/projects/' + encodeURIComponent(projectId), { auth: true }),
      apiFetch('GET', '/traces/project/' + encodeURIComponent(projectId), { auth: true }),
      apiFetch('GET', '/references/project/' + encodeURIComponent(projectId), { auth: true }),
      apiFetch('GET', '/pivots/project/' + encodeURIComponent(projectId), { auth: true }),
      apiFetch('GET', '/vetos/project/' + encodeURIComponent(projectId), { auth: true }),
    ])
      .then(function (res) {
        var project = res[0];
        var traces = res[1] || [];
        var refs = res[2] || [];
        var pivots = res[3] || [];
        var vetos = res[4] || [];
        var me = getAlias();

        var h1 = document.createElement('h1');
        h1.textContent = project.title;
        app.appendChild(h1);
        var st = document.createElement('span');
        st.className = statusTagClass(project.status);
        st.textContent = (project.status || '').toUpperCase();
        st.style.marginBottom = '1rem';
        st.style.display = 'inline-block';
        app.appendChild(st);

        var hC = document.createElement('h2');
        hC.textContent = 'Contributors';
        app.appendChild(hC);
        var ulp = document.createElement('ul');
        ulp.className = 'list-plain';
        (project.contributors || []).forEach(function (c) {
          var li = document.createElement('li');
          li.textContent = c.alias + ' — ' + (c.role || 'contributor');
          ulp.appendChild(li);
        });
        app.appendChild(ulp);

        if (project.status === 'active') {
          var bar = document.createElement('div');
          bar.className = 'row-actions';
          var links = [
            ['LOG WORK', '#/projects/' + projectId + '/trace'],
            ['ADD REFERENCE', '#/projects/' + projectId + '/reference'],
            ['RECORD PIVOT', '#/projects/' + projectId + '/pivot'],
          ];
          links.forEach(function (L) {
            var a = document.createElement('a');
            a.href = L[1];
            a.className = 'btn btn--secondary';
            a.textContent = L[0];
            bar.appendChild(a);
          });
          var vetoBtn = document.createElement('button');
          vetoBtn.type = 'button';
          vetoBtn.className = 'btn btn--secondary';
          vetoBtn.textContent = 'RAISE VETO';
          bar.appendChild(vetoBtn);
          var endBtn = document.createElement('a');
          endBtn.href = '#/projects/' + projectId + '/credit';
          endBtn.className = 'btn';
          endBtn.textContent = 'END PROJECT';
          bar.appendChild(endBtn);
          app.appendChild(bar);

          var vetoPanel = document.createElement('div');
          vetoPanel.className = 'panel hidden';
          vetoPanel.id = 'veto-panel';
          vetoPanel.appendChild(document.createElement('h2')).textContent = 'Raise veto';
          var vform = document.createElement('form');
          var vl1 = document.createElement('label');
          vl1.textContent = 'Veto type';
          var vsel = document.createElement('select');
          vsel.required = true;
          fillSelect(vsel, VETO_TYPES);
          var vl2 = document.createElement('label');
          vl2.textContent = 'Reason';
          var vreason = document.createElement('textarea');
          vreason.required = true;
          var vl3 = document.createElement('label');
          vl3.textContent = 'Target traces (optional, multi-select)';
          var vtr = document.createElement('select');
          vtr.multiple = true;
          vtr.size = Math.min(8, Math.max(3, traces.length));
          traces.forEach(function (t) {
            var o = document.createElement('option');
            o.value = t._id;
            o.textContent = (t._id || '') + ' — ' + (t.activityType || '') + ' — ' + (t.description || '').slice(0, 40);
            vtr.appendChild(o);
          });
          vform.appendChild(vl1);
          vform.appendChild(vsel);
          vform.appendChild(vl2);
          vform.appendChild(vreason);
          vform.appendChild(vl3);
          vform.appendChild(vtr);
          var vsub = document.createElement('button');
          vsub.type = 'submit';
          vsub.className = 'btn';
          vsub.textContent = 'SUBMIT VETO';
          vform.appendChild(vsub);
          vetoBtn.addEventListener('click', function () {
            vetoPanel.classList.toggle('hidden');
          });
          vform.addEventListener('submit', function (e) {
            e.preventDefault();
            clearError();
            var selected = Array.prototype.slice.call(vtr.selectedOptions).map(function (o) {
              return o.value;
            });
            var body = {
              projectId: projectId,
              vetoType: vsel.value,
              reason: vreason.value,
            };
            if (selected.length) body.targetTraceIds = selected;
            apiFetch('POST', '/vetos', { auth: true, body: body })
              .then(function (data) {
                appendApiDetails(vetoPanel, data, 'Raw API response');
                location.hash = '#/projects/' + projectId;
                render();
              })
              .catch(function (err) {
                showError(err.message || String(err));
              });
          });
          vetoPanel.appendChild(vform);
          app.appendChild(vetoPanel);
        }

        var nftLinkRow = document.createElement('p');
        nftLinkRow.className = 'hint';
        if (project.status === 'completed' || project.status === 'archived') {
          apiFetch('GET', '/credits/project/' + encodeURIComponent(projectId), { auth: true })
            .then(function (cr) {
              if (cr && cr.nft && cr.nft._id) {
                var na = document.createElement('a');
                na.href = '#/nfts/' + encodeURIComponent(cr.nft._id);
                na.textContent = 'VIEW NFT';
                nftLinkRow.appendChild(document.createTextNode('Credit: '));
                nftLinkRow.appendChild(na);
              }
            })
            .catch(function () {});
          app.appendChild(nftLinkRow);
        }

        var hT = document.createElement('h2');
        hT.textContent = 'Timeline';
        app.appendChild(hT);
        var merged = mergeTimeline(traces, refs, pivots, vetos);
        if (merged.length === 0) {
          var em = document.createElement('p');
          em.className = 'hint';
          em.textContent = 'No events yet.';
          app.appendChild(em);
        } else {
          merged.forEach(function (ev) {
            var div = document.createElement('div');
            div.className = 'timeline-item';
            var tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = ev.type;
            div.appendChild(tag);
            div.appendChild(document.createTextNode(' ' + ev.alias + ' — ' + formatTs(ev.ts)));
            var br = document.createElement('div');
            br.className = 'small';
            br.style.marginTop = '0.35rem';
            br.style.textTransform = 'none';
            br.style.letterSpacing = 'normal';
            br.textContent = ev.text || '—';
            div.appendChild(br);
            app.appendChild(div);
          });
        }

        appendApiDetails(app, { project: project, timeline: merged }, 'Raw API response');
      })
      .catch(function (err) {
        showError(err.message || String(err));
      });
  }

  function formatTs(ts) {
    try {
      return new Date(ts).toISOString();
    } catch (e) {
      return String(ts);
    }
  }

  function renderTrace(app, projectId) {
    app.innerHTML = '';
    clearError();
    var h1 = document.createElement('h1');
    h1.textContent = 'Log work';
    app.appendChild(h1);
    var form = document.createElement('form');
    form.className = 'panel';

    var l1 = document.createElement('label');
    l1.textContent = 'Activity type';
    var s1 = document.createElement('select');
    s1.required = true;
    fillSelect(s1, ACTIVITY_TYPES);
    var otherWrap = document.createElement('div');
    otherWrap.className = 'hidden';
    var lOther = document.createElement('label');
    lOther.textContent = 'Other description';
    var iOther = document.createElement('input');
    otherWrap.appendChild(lOther);
    otherWrap.appendChild(iOther);
    s1.addEventListener('change', function () {
      otherWrap.classList.toggle('hidden', s1.value !== 'other');
    });

    var l2 = document.createElement('label');
    l2.textContent = 'Description (optional)';
    var i2 = document.createElement('textarea');
    var l3 = document.createElement('label');
    l3.textContent = 'Duration minutes (optional)';
    var i3 = document.createElement('input');
    i3.type = 'number';
    i3.min = '0';
    var l4 = document.createElement('label');
    l4.textContent = 'Tool / software (optional)';
    var i4 = document.createElement('input');
    var proxyRow = document.createElement('label');
    proxyRow.className = 'checkbox-row';
    var proxyChk = document.createElement('input');
    proxyChk.type = 'checkbox';
    proxyChk.id = 'proxy-toggle';
    proxyRow.appendChild(proxyChk);
    proxyRow.appendChild(document.createTextNode('PROXY LOG'));
    var proxyWrap = document.createElement('div');
    proxyWrap.className = 'hidden';
    var l5 = document.createElement('label');
    l5.textContent = 'Proxy for alias';
    var i5 = document.createElement('input');
    proxyWrap.appendChild(l5);
    proxyWrap.appendChild(i5);
    proxyChk.addEventListener('change', function () {
      proxyWrap.classList.toggle('hidden', !proxyChk.checked);
    });

    form.appendChild(l1);
    form.appendChild(s1);
    form.appendChild(otherWrap);
    form.appendChild(l2);
    form.appendChild(i2);
    form.appendChild(l3);
    form.appendChild(i3);
    form.appendChild(l4);
    form.appendChild(i4);
    form.appendChild(proxyRow);
    form.appendChild(proxyWrap);
    var sub = document.createElement('button');
    sub.type = 'submit';
    sub.className = 'btn';
    sub.textContent = 'LOG WORK';
    form.appendChild(sub);
    app.appendChild(form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();
      var body = {
        projectId: projectId,
        activityType: s1.value,
        description: i2.value.trim() || undefined,
        duration: i3.value ? Number(i3.value) : undefined,
        toolSoftware: i4.value.trim() || undefined,
      };
      if (s1.value === 'other') body.otherDescription = iOther.value.trim();
      if (proxyChk.checked) {
        body.mode = 'proxy';
        body.proxyForAlias = i5.value.trim();
      } else {
        body.mode = 'micro';
      }
      apiFetch('POST', '/traces', { auth: true, body: body })
        .then(function (data) {
          appendApiDetails(form, data, 'Raw API response');
          var p = document.createElement('p');
          p.className = 'hint';
          p.textContent = 'Trace id: ' + (data._id || '');
          form.appendChild(p);
          var back = document.createElement('a');
          back.href = '#/projects/' + projectId;
          back.className = 'btn btn--secondary';
          back.textContent = 'Back to project';
          form.appendChild(back);
        })
        .catch(function (err) {
          showError(err.message || String(err));
        });
    });
  }

  function renderReference(app, projectId) {
    app.innerHTML = '';
    clearError();
    var h1 = document.createElement('h1');
    h1.textContent = 'Add reference';
    app.appendChild(h1);
    var form = document.createElement('form');
    form.className = 'panel';
    var l1 = document.createElement('label');
    l1.textContent = 'External URL or citation';
    var i1 = document.createElement('input');
    i1.required = true;
    var l2 = document.createElement('label');
    l2.textContent = 'Relationship type';
    var s1 = document.createElement('select');
    s1.required = true;
    fillSelect(s1, RELATIONSHIP_TYPES);
    var otherWrap = document.createElement('div');
    otherWrap.className = 'hidden';
    var lo = document.createElement('label');
    lo.textContent = 'Explanation (required for other)';
    var io = document.createElement('textarea');
    otherWrap.appendChild(lo);
    otherWrap.appendChild(io);
    s1.addEventListener('change', function () {
      otherWrap.classList.toggle('hidden', s1.value !== 'other');
    });
    form.appendChild(l1);
    form.appendChild(i1);
    form.appendChild(l2);
    form.appendChild(s1);
    form.appendChild(otherWrap);
    var sub = document.createElement('button');
    sub.type = 'submit';
    sub.className = 'btn';
    sub.textContent = 'ADD REFERENCE';
    form.appendChild(sub);
    app.appendChild(form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();
      var raw = i1.value.trim();
      var body = {
        projectId: projectId,
        relationshipType: s1.value,
      };
      try {
        new URL(raw);
        body.externalUrl = raw;
      } catch (err) {
        body.citation = raw;
      }
      if (s1.value === 'other') body.otherExplanation = io.value.trim();
      apiFetch('POST', '/references', { auth: true, body: body })
        .then(function (data) {
          appendApiDetails(form, data, 'Raw API response');
          location.hash = '#/projects/' + projectId;
          render();
        })
        .catch(function (err) {
          showError(err.message || String(err));
        });
    });
  }

  function renderPivot(app, projectId) {
    app.innerHTML = '';
    clearError();
    app.appendChild(document.createElement('h1')).textContent = 'Record pivot';
    var form = document.createElement('form');
    form.className = 'panel';
    var l = document.createElement('label');
    l.textContent = 'Reason';
    var ta = document.createElement('textarea');
    ta.required = true;
    var sub = document.createElement('button');
    sub.type = 'submit';
    sub.className = 'btn';
    sub.textContent = 'RECORD PIVOT';
    form.appendChild(l);
    form.appendChild(ta);
    form.appendChild(sub);
    app.appendChild(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();
      apiFetch('POST', '/pivots', {
        auth: true,
        body: { projectId: projectId, reason: ta.value.trim() },
      })
        .then(function (data) {
          appendApiDetails(form, data, 'Raw API response');
          location.hash = '#/projects/' + projectId;
          render();
        })
        .catch(function (err) {
          showError(err.message || String(err));
        });
    });
  }

  function renderCredit(app, projectId) {
    app.innerHTML = '';
    clearError();
    apiFetch('GET', '/projects/' + encodeURIComponent(projectId), { auth: true })
      .then(function (project) {
        var h1 = document.createElement('h1');
        h1.textContent = 'End project / credit';
        app.appendChild(h1);

        var panel = document.createElement('div');
        panel.className = 'panel';
        panel.appendChild(document.createElement('h2')).textContent = 'Contributors';
        var tbl = document.createElement('div');
        var weightInputs = {};
        (project.contributors || []).forEach(function (c) {
          var row = document.createElement('div');
          row.style.marginBottom = '0.75rem';
          row.textContent = c.alias + ' — ' + (c.role || '') + ' — weight (0–1, leave blank for equal split)';
          var inp = document.createElement('input');
          inp.type = 'text';
          inp.placeholder = 'equal split';
          inp.dataset.alias = c.alias;
          weightInputs[c.alias] = inp;
          row.appendChild(inp);
          tbl.appendChild(row);
        });
        panel.appendChild(tbl);
        var lD = document.createElement('label');
        lD.className = 'checkbox-row';
        var chD = document.createElement('input');
        chD.type = 'checkbox';
        chD.id = 'dispute';
        lD.appendChild(chD);
        lD.appendChild(document.createTextNode('Dispute flag'));
        panel.appendChild(lD);
        var sub = document.createElement('button');
        sub.type = 'button';
        sub.className = 'btn';
        sub.textContent = 'MINT NFT';
        panel.appendChild(sub);

        var signSection = document.createElement('div');
        signSection.className = 'panel hidden';
        signSection.id = 'credit-sign-section';
        app.appendChild(panel);
        app.appendChild(signSection);

        sub.addEventListener('click', function () {
          clearError();
          var contributors = [];
          var aliases = Object.keys(weightInputs);
          var any = aliases.some(function (a) {
            return weightInputs[a].value.trim() !== '';
          });
          if (any) {
            var sum = 0;
            for (var wi = 0; wi < aliases.length; wi++) {
              var a = aliases[wi];
              var rawW = weightInputs[a].value.trim();
              if (rawW === '') {
                showError('If using weights, every contributor needs a numeric weight.');
                return;
              }
              var v = parseFloat(rawW);
              if (isNaN(v)) {
                showError('Invalid weight for ' + a);
                return;
              }
              sum += v;
              contributors.push({ alias: a, weight: v });
            }
            if (Math.abs(sum - 1) > 0.001) {
              showError('Weights must sum to 1.');
              return;
            }
          }
          var body = {
            projectId: projectId,
            disputeFlag: !!chD.checked,
          };
          if (contributors.length) body.contributors = contributors;
          apiFetch('POST', '/credits', { auth: true, body: body })
            .then(function (data) {
              appendApiDetails(panel, data, 'Raw API response');
              var nftId = data.nft && data.nft._id;
              var msg = document.createElement('p');
              msg.className = 'hint';
              msg.textContent =
                'NFT id: ' +
                nftId +
                ' — contributor tokens: ' +
                (data.contributorTokens != null ? data.contributorTokens : '') +
                ' — ';
              var prov = document.createElement('a');
              prov.href = '#/nfts/' + encodeURIComponent(nftId);
              prov.textContent = 'Provenance';
              msg.appendChild(prov);
              panel.appendChild(msg);
              signSection.classList.remove('hidden');
              signSection.innerHTML = '';
              signSection.appendChild(document.createElement('h2')).textContent = 'Sign credit';
              var hint = document.createElement('p');
              hint.className = 'hint';
              hint.textContent =
                'All on-chain contributors must POST sign before the credit is finalized. Use the button below if you are a contributor.';
              signSection.appendChild(hint);
              var signBtn = document.createElement('button');
              signBtn.type = 'button';
              signBtn.className = 'btn';
              signBtn.textContent = 'SIGN CREDIT (accept)';
              signSection.appendChild(signBtn);
              signBtn.addEventListener('click', function () {
                clearError();
                apiFetch('POST', '/credits/' + encodeURIComponent(nftId) + '/sign', {
                  auth: true,
                  body: { accepted: true },
                })
                  .then(function (sig) {
                    appendApiDetails(signSection, sig, 'Raw API response');
                  })
                  .catch(function (err) {
                    showError(err.message || String(err));
                  });
              });
            })
            .catch(function (err) {
              showError(err.message || String(err));
            });
        });

        appendApiDetails(app, { project: project }, 'Raw API response');
      })
      .catch(function (err) {
        showError(err.message || String(err));
      });
  }

  function renderArchiveNew(app) {
    app.innerHTML = '';
    clearError();
    var alias = getAlias();
    var h1 = document.createElement('h1');
    h1.textContent = 'Archive past work';
    app.appendChild(h1);
    var form = document.createElement('form');
    form.className = 'panel';

    apiFetch('GET', '/nodes/' + encodeURIComponent(alias), { auth: true })
      .then(function (node) {
        var ids = (node.spaces || []).map(String);
        return Promise.all(
          ids.map(function (sid) {
            return apiFetch('GET', '/spaces/' + encodeURIComponent(sid), { auth: true });
          }),
        ).then(function (spaces) {
          if (!spaces.length) {
            var em = document.createElement('p');
            em.className = 'field-error';
            em.textContent = 'Join or create a space first.';
            var ax = document.createElement('a');
            ax.href = '#/spaces';
            ax.className = 'btn btn--secondary';
            ax.textContent = 'Go to spaces';
            app.appendChild(em);
            app.appendChild(ax);
            return;
          }
          var l0 = document.createElement('label');
          l0.textContent = 'Space';
          var s0 = document.createElement('select');
          s0.required = true;
          spaces.forEach(function (sp) {
            var o = document.createElement('option');
            o.value = sp._id;
            o.textContent = sp.name;
            s0.appendChild(o);
          });
          var saved = localStorage.getItem(LS.spaceId);
          if (saved) s0.value = saved;
          form.appendChild(l0);
          form.appendChild(s0);

          var l1 = document.createElement('label');
          l1.textContent = 'Title';
          var i1 = document.createElement('input');
          i1.required = true;
          var l2 = document.createElement('label');
          l2.textContent = 'Medium';
          var i2 = document.createElement('input');
          i2.required = true;
          var l3 = document.createElement('label');
          l3.textContent = 'Approximate date';
          var i3 = document.createElement('input');
          i3.required = true;
          var l4 = document.createElement('label');
          l4.textContent = 'Evidence type';
          var s1 = document.createElement('select');
          s1.required = true;
          fillSelect(s1, EVIDENCE_TYPES);
          var otherEv = document.createElement('div');
          otherEv.className = 'hidden';
          var lo = document.createElement('label');
          lo.textContent = 'Other description';
          var io = document.createElement('input');
          otherEv.appendChild(lo);
          otherEv.appendChild(io);
          s1.addEventListener('change', function () {
            otherEv.classList.toggle('hidden', s1.value !== 'other');
          });
          var l5 = document.createElement('label');
          l5.textContent = 'Evidence hash or URL (will be hashed)';
          var i5 = document.createElement('input');
          i5.required = true;
          var l6 = document.createElement('label');
          l6.textContent = 'Context note (optional)';
          var i6 = document.createElement('textarea');
          var c1 = document.createElement('label');
          c1.className = 'checkbox-row';
          var ch1 = document.createElement('input');
          ch1.type = 'checkbox';
          ch1.required = true;
          c1.appendChild(ch1);
          c1.appendChild(document.createTextNode('I declare this is my original work'));
          var c2 = document.createElement('label');
          c2.className = 'checkbox-row';
          var ch2 = document.createElement('input');
          ch2.type = 'checkbox';
          ch2.id = 'recon';
          var span2 = document.createElement('span');
          span2.textContent = 'This is a reconstruction';
          c2.appendChild(ch2);
          c2.appendChild(span2);

          form.appendChild(l1);
          form.appendChild(i1);
          form.appendChild(l2);
          form.appendChild(i2);
          form.appendChild(l3);
          form.appendChild(i3);
          form.appendChild(l4);
          form.appendChild(s1);
          form.appendChild(otherEv);
          form.appendChild(l5);
          form.appendChild(i5);
          form.appendChild(l6);
          form.appendChild(i6);
          form.appendChild(c1);
          form.appendChild(c2);
          var sub = document.createElement('button');
          sub.type = 'submit';
          sub.className = 'btn';
          sub.textContent = 'ARCHIVE';
          form.appendChild(sub);
          app.appendChild(form);

          form.addEventListener('submit', function (e) {
            e.preventDefault();
            clearError();
            if (!ch1.checked) {
              showError('You must confirm original work.');
              return;
            }
            sha256HexUtf8(i5.value.trim()).then(function (hash) {
              var ev = {
                evidenceType: s1.value,
                evidenceHash: hash,
              };
              if (s1.value === 'other') ev.otherDescription = io.value.trim();
              var body = {
                title: i1.value.trim(),
                medium: i2.value.trim(),
                approxDate: i3.value.trim(),
                spaceId: s0.value,
                evidence: [ev],
                reconstructionFlag: !!ch2.checked,
                originalWorkDeclaration: true,
              };
              if (i6.value.trim()) body.contextNote = i6.value.trim();
              apiFetch('POST', '/archives', { auth: true, body: body })
                .then(function (data) {
                  appendApiDetails(form, data, 'Raw API response');
                  var p = document.createElement('p');
                  p.className = 'hint';
                  p.textContent =
                    'Archive id: ' +
                    (data.archive && data.archive._id) +
                    ' — NFT id: ' +
                    (data.nft && data.nft._id);
                  form.appendChild(p);
                })
                .catch(function (err) {
                  showError(err.message || String(err));
                });
            });
          });
        });
      })
      .catch(function (err) {
        showError(err.message || String(err));
      });
  }

  function renderNft(app, nftId) {
    app.innerHTML = '';
    clearError();
    apiFetch('GET', '/nfts/' + encodeURIComponent(nftId), { auth: true })
      .then(function (data) {
        var nft = data.nft;
        var project = data.project;
        var archive = data.archive;
        var isArchive = !!(archive || (nft.title && nft.title.indexOf('[ARCHIVE]') === 0));

        var h1 = document.createElement('h1');
        h1.style.fontSize = '1.75rem';
        h1.textContent = nft.title || 'NFT';
        app.appendChild(h1);
        if (isArchive) {
          var ar = document.createElement('span');
          ar.className = 'tag';
          ar.textContent = '[ARCHIVE]';
          app.appendChild(ar);
        }
        var meta = document.createElement('p');
        meta.textContent = (nft.medium || '') + (project && project.createdAt ? ' — ' + formatTs(project.createdAt) : '');
        app.appendChild(meta);

        var hC = document.createElement('h2');
        hC.textContent = 'Creators';
        app.appendChild(hC);
        var ulc = document.createElement('ul');
        ulc.className = 'list-plain';
        (nft.creators || []).forEach(function (a) {
          var li = document.createElement('li');
          var la = document.createElement('a');
          la.href = '#/nodes/' + encodeURIComponent(a);
          la.textContent = a;
          li.appendChild(la);
          ulc.appendChild(li);
        });
        app.appendChild(ulc);

        var hCo = document.createElement('h2');
        hCo.textContent = 'Contributors';
        app.appendChild(hCo);
        var ult = document.createElement('ul');
        ult.className = 'list-plain';
        (nft.contributors || []).forEach(function (c) {
          var li = document.createElement('li');
          li.textContent =
            c.alias + ' — ' + (c.role || '') + ' — weight ' + (c.weight != null ? c.weight : '');
          ult.appendChild(li);
        });
        app.appendChild(ult);

        var hP = document.createElement('h2');
        hP.textContent = 'Process (block indices)';
        app.appendChild(hP);
        var pp = document.createElement('p');
        pp.className = 'mono';
        pp.textContent = (nft.processBlockIndices || []).join(', ') || '—';
        app.appendChild(pp);

        var hPr = document.createElement('h2');
        hPr.textContent = 'Provenance';
        app.appendChild(hPr);
        var pr = document.createElement('p');
        pr.textContent =
          'Project: ' +
          (project && project._id) +
          ' — Space: ' +
          (project && project.spaceId) +
          ' — Created: ' +
          (project && project.createdAt ? formatTs(project.createdAt) : '—');
        app.appendChild(pr);
        if (nft.disputed) {
          var dis = document.createElement('p');
          dis.className = 'field-error';
          dis.textContent = 'DISPUTED';
          app.appendChild(dis);
        }

        var share = document.createElement('button');
        share.type = 'button';
        share.className = 'btn btn--secondary';
        share.textContent = 'SHARE (copy public URL)';
        share.addEventListener('click', function () {
          var url = location.origin + location.pathname + '#/nfts/' + encodeURIComponent(nftId);
          navigator.clipboard.writeText(url).then(
            function () {
              appendApiDetails(app, { copied: url }, 'Clipboard');
            },
            function () {
              showError('Could not copy.');
            },
          );
        });
        app.appendChild(share);

        appendApiDetails(app, data, 'Raw API response');
      })
      .catch(function (err) {
        showError(err.message || String(err));
      });
  }

  function renderNodePublic(app, aliasParam) {
    app.innerHTML = '';
    clearError();
    apiFetch('GET', '/nodes/' + encodeURIComponent(aliasParam), { auth: !!getToken() })
      .then(function (node) {
        var title = document.createElement('div');
        title.style.fontSize = '2rem';
        title.style.textTransform = 'uppercase';
        title.style.letterSpacing = '0.08em';
        title.textContent = node.alias;
        app.appendChild(title);
        app.insertAdjacentHTML('beforeend', radarSvg(node.reputationCategories));
        var hB = document.createElement('h2');
        hB.textContent = 'Badges';
        app.appendChild(hB);
        if (!(node.badges || []).length) {
          var nb = document.createElement('p');
          nb.className = 'hint';
          nb.textContent = 'None.';
          app.appendChild(nb);
        } else {
          var ul = document.createElement('ul');
          ul.className = 'list-plain';
          node.badges.forEach(function (b) {
            var li = document.createElement('li');
            li.textContent = b;
            ul.appendChild(li);
          });
          app.appendChild(ul);
        }
        var hi = document.createElement('h2');
        hi.textContent = 'Interests';
        app.appendChild(hi);
        var pi = document.createElement('p');
        pi.textContent = (node.interests || []).join(', ') || '—';
        app.appendChild(pi);
        var hk = document.createElement('h2');
        hk.textContent = 'Keywords';
        app.appendChild(hk);
        var pk = document.createElement('p');
        pk.textContent = (node.keywords || []).join(', ') || '—';
        app.appendChild(pk);
        if (node.portfolioUrl) {
          var hp = document.createElement('h2');
          hp.textContent = 'Portfolio';
          app.appendChild(hp);
          var pa = document.createElement('a');
          pa.href = node.portfolioUrl;
          pa.textContent = node.portfolioUrl;
          pa.target = '_blank';
          pa.rel = 'noopener noreferrer';
          app.appendChild(pa);
        }
        var hs = document.createElement('h2');
        hs.textContent = 'Spaces';
        app.appendChild(hs);
        var spList =
          node.spacesWithNames && node.spacesWithNames.length
            ? node.spacesWithNames.map(function (x) {
                return x.name;
              })
            : (node.spaces || []).map(String);
        var ps = document.createElement('p');
        ps.textContent = spList.join(', ') || '—';
        app.appendChild(ps);
        var hc = document.createElement('h2');
        hc.textContent = 'Completed projects';
        app.appendChild(hc);
        var ulp = document.createElement('ul');
        ulp.className = 'list-plain';
        (node.completedProjects || []).forEach(function (cp) {
          var li = document.createElement('li');
          li.appendChild(document.createTextNode(cp.title + ' '));
          if (cp.nftId) {
            var a = document.createElement('a');
            a.href = '#/nfts/' + encodeURIComponent(cp.nftId);
            a.textContent = 'NFT';
            li.appendChild(a);
          }
          ulp.appendChild(li);
        });
        if (!(node.completedProjects || []).length) {
          var ep = document.createElement('p');
          ep.className = 'hint';
          ep.textContent = 'None listed.';
          app.appendChild(ep);
        } else app.appendChild(ulp);

        appendApiDetails(app, node, 'Raw API response');
      })
      .catch(function (err) {
        showError(err.message || String(err));
      });
  }

  function renderMe(app) {
    app.innerHTML = '';
    clearError();
    var alias = getAlias();
    apiFetch('GET', '/nodes/' + encodeURIComponent(alias), { auth: true })
      .then(function (node) {
        var h1 = document.createElement('h1');
        h1.textContent = 'My profile';
        app.appendChild(h1);
        var p = document.createElement('p');
        p.className = 'mono';
        p.textContent = 'Alias: ' + alias;
        app.appendChild(p);
        var pub = document.createElement('a');
        pub.href = '#/nodes/' + encodeURIComponent(alias);
        pub.textContent = 'Public profile';
        app.appendChild(pub);

        var form = document.createElement('form');
        form.className = 'panel';
        form.style.marginTop = '2rem';
        var l1 = document.createElement('label');
        l1.textContent = 'Interests (comma-separated)';
        var i1 = document.createElement('input');
        i1.value = (node.interests || []).join(', ');
        var l2 = document.createElement('label');
        l2.textContent = 'Portfolio URL';
        var i2 = document.createElement('input');
        i2.type = 'url';
        i2.value = node.portfolioUrl || '';
        var l3 = document.createElement('label');
        l3.textContent = 'Keywords (comma-separated)';
        var i3 = document.createElement('input');
        i3.value = (node.keywords || []).join(', ');
        var sub = document.createElement('button');
        sub.type = 'submit';
        sub.className = 'btn';
        sub.textContent = 'Save';
        form.appendChild(l1);
        form.appendChild(i1);
        form.appendChild(l2);
        form.appendChild(i2);
        form.appendChild(l3);
        form.appendChild(i3);
        form.appendChild(sub);
        app.appendChild(form);

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          clearError();
          var interests = i1.value
            .split(',')
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
          var keywords = i3.value
            .split(',')
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
          var body = { interests: interests, keywords: keywords, portfolioUrl: i2.value.trim() };
          apiFetch('PATCH', '/nodes/me', { auth: true, body: body })
            .then(function (data) {
              appendApiDetails(form, data, 'Raw API response');
            })
            .catch(function (err) {
              showError(err.message || String(err));
            });
        });

        appendApiDetails(app, node, 'Raw API response');
      })
      .catch(function (err) {
        showError(err.message || String(err));
      });
  }

  function renderProjectNew(app) {
    app.innerHTML = '';
    clearError();
    var alias = getAlias();
    var h1 = document.createElement('h1');
    h1.textContent = 'Start new project';
    app.appendChild(h1);
    var form = document.createElement('form');
    form.className = 'panel';
    apiFetch('GET', '/nodes/' + encodeURIComponent(alias), { auth: true })
      .then(function (node) {
        var ids = (node.spaces || []).map(String);
        return Promise.all(
          ids.map(function (sid) {
            return apiFetch('GET', '/spaces/' + encodeURIComponent(sid), { auth: true });
          }),
        ).then(function (spaces) {
          if (!spaces.length) {
            var em = document.createElement('p');
            em.className = 'field-error';
            em.textContent = 'Join or create a space first.';
            var a = document.createElement('a');
            a.href = '#/spaces';
            a.className = 'btn btn--secondary';
            a.textContent = 'Go to spaces';
            app.appendChild(em);
            app.appendChild(a);
            return;
          }
          var l0 = document.createElement('label');
          l0.textContent = 'Space';
          var s0 = document.createElement('select');
          s0.required = true;
          spaces.forEach(function (sp) {
            var o = document.createElement('option');
            o.value = sp._id;
            o.textContent = sp.name;
            s0.appendChild(o);
          });
          var def = localStorage.getItem(LS.spaceId);
          if (
            def &&
            Array.prototype.some.call(s0.options, function (o) {
              return o.value === def;
            })
          )
            s0.value = def;
          var l1 = document.createElement('label');
          l1.textContent = 'Title';
          var i1 = document.createElement('input');
          i1.required = true;
          form.appendChild(l0);
          form.appendChild(s0);
          form.appendChild(l1);
          form.appendChild(i1);
          var sub = document.createElement('button');
          sub.type = 'submit';
          sub.className = 'btn';
          sub.textContent = 'Create project';
          form.appendChild(sub);
          app.appendChild(form);
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            clearError();
            apiFetch('POST', '/projects', {
              auth: true,
              body: { title: i1.value.trim(), spaceId: s0.value },
            })
              .then(function (data) {
                appendApiDetails(form, data, 'Raw API response');
                localStorage.setItem(LS.projectId, data._id);
                location.hash = '#/projects/' + encodeURIComponent(data._id);
                render();
              })
              .catch(function (err) {
                showError(err.message || String(err));
              });
          });
        });
      })
      .catch(function (err) {
        showError(err.message || String(err));
      });
  }

  function renderUnknown(app, raw) {
    app.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'field-error';
    p.textContent = 'Unknown route: #' + (raw || '');
    app.appendChild(p);
    var a = document.createElement('a');
    a.href = '#/';
    a.textContent = 'Home';
    app.appendChild(a);
  }

  function render() {
    var app = document.getElementById('app');
    if (!app) return;
    updateTopBar();
    clearError();
    app.innerHTML = '';

    if (getToken() && sessionStorage.getItem(SS_PENDING_SEED) != null) {
      renderSeedTakeover(app);
      return;
    }

    var route = parseRoute();
    var token = getToken();

    if (!token) {
      if (
        route.name !== 'home' &&
        route.name !== 'register' &&
        route.name !== 'login' &&
        route.name !== 'node'
      ) {
        location.hash = '#/';
        return;
      }
    } else {
      if (route.name === 'register' || route.name === 'login') {
        location.hash = '#/';
        return;
      }
    }

    if (route.name === 'node' && !token) {
      renderNodePublic(app, decodeURIComponent(route.params.alias));
      return;
    }

    if (!token) {
      if (route.name === 'home') renderAuthDual(app, 'home');
      else if (route.name === 'register') renderAuthDual(app, 'register');
      else if (route.name === 'login') renderAuthDual(app, 'login');
      else renderUnknown(app, route.params.raw);
      return;
    }

    switch (route.name) {
      case 'home':
        renderDashboard(app);
        break;
      case 'me':
        renderMe(app);
        break;
      case 'spaces':
        renderSpaces(app);
        break;
      case 'space':
        renderSpaceDetail(app, route.params.id);
        break;
      case 'projectNew':
        renderProjectNew(app);
        break;
      case 'project':
        renderProject(app, route.params.id);
        break;
      case 'trace':
        renderTrace(app, route.params.id);
        break;
      case 'reference':
        renderReference(app, route.params.id);
        break;
      case 'pivot':
        renderPivot(app, route.params.id);
        break;
      case 'credit':
        renderCredit(app, route.params.id);
        break;
      case 'archiveNew':
        renderArchiveNew(app);
        break;
      case 'nft':
        renderNft(app, route.params.id);
        break;
      case 'node':
        renderNodePublic(app, decodeURIComponent(route.params.alias));
        break;
      default:
        renderUnknown(app, route.params.raw);
    }
  }

  window.addEventListener('hashchange', render);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
