(function (global) {
  const CONFIG_KEY = 'driptest_api_config';
  const SESSION_KEY = 'driptest_auth_session';

  function getConfig() {
    try {
      const raw = global.localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn('Erro ao ler configuracao da API DripTest', error);
      return {};
    }
  }

  function setConfig(config) {
    const normalized = {
      baseUrl: String(config && config.baseUrl ? config.baseUrl : '').replace(/\/+$/, ''),
      token: String(config && config.token ? config.token : ''),
      enabled: Boolean(config && config.enabled)
    };

    global.localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function clearConfig() {
    global.localStorage.removeItem(CONFIG_KEY);
  }

  function getSession() {
    try {
      const raw = global.localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn('Erro ao ler sessao da API DripTest', error);
      return {};
    }
  }

  function setSession(session) {
    const normalized = {
      accessToken: String(session && session.accessToken ? session.accessToken : session && session.access_token ? session.access_token : ''),
      expiresAt: String(session && session.expiresAt ? session.expiresAt : ''),
      user: session && session.user ? session.user : null
    };

    global.localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function clearSession() {
    global.localStorage.removeItem(SESSION_KEY);
  }

  function isEnabled() {
    const config = getConfig();
    return Boolean(config.enabled && config.baseUrl);
  }

  function getAuthorizationToken() {
    const session = getSession();
    if (session.accessToken) {
      return session.accessToken;
    }

    const config = getConfig();
    return config.token || '';
  }

  function buildHeaders(options, authToken) {
    const headers = Object.assign({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }, options && options.headers ? options.headers : {});

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    return headers;
  }

  async function parseResponse(response) {
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (e) {
      payload = null;
    }

    return { text, payload };
  }

  async function request(path, options) {
    const config = getConfig();
    if (!config.baseUrl) {
      throw new Error('API DripTest nao configurada.');
    }

    const session = getSession();
    const sessionToken = session.accessToken || '';
    const configToken = config.token || '';
    const authToken = getAuthorizationToken();
    let response;
    try {
      response = await fetch(`${config.baseUrl}${path}`, Object.assign({}, options, {
        headers: buildHeaders(options, authToken)
      }));
    } catch (error) {
      throw new Error(`Nao foi possivel conectar na API em ${config.baseUrl}. Verifique a URL, se o backend esta ligado e se o banco permitiu a inicializacao.`);
    }
    let { text, payload } = await parseResponse(response);

    // Se a sessao salva ficou invalida, tenta reaproveitar o token tecnico
    // configurado para nao prender a tela em 401 ate o usuario limpar storage.
    if (response.status === 401 && sessionToken && configToken && sessionToken !== configToken) {
      clearSession();
      try {
        response = await fetch(`${config.baseUrl}${path}`, Object.assign({}, options, {
          headers: buildHeaders(options, configToken)
        }));
      } catch (error) {
        throw new Error(`Nao foi possivel reconectar na API em ${config.baseUrl} apos limpar a sessao local.`);
      }
      ({ text, payload } = await parseResponse(response));
    }

    if (!response.ok) {
      const message = (payload && payload.detail) || text || `Erro HTTP ${response.status}`;
      throw new Error(message);
    }

    return payload;
  }

  function getHealth() {
    return request('/health', { method: 'GET' });
  }

  function pushSnapshot(snapshot) {
    return request('/sync/push', {
      method: 'POST',
      body: JSON.stringify(snapshot)
    });
  }

  function pullSince(since) {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    return request(`/sync/pull${query}`, { method: 'GET' });
  }

  async function login(identifier, password) {
    const payload = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });

    const expiresAt = payload && payload.expires_in
      ? new Date(Date.now() + (payload.expires_in * 1000)).toISOString()
      : '';

    const session = setSession({
      accessToken: payload && payload.access_token ? payload.access_token : '',
      expiresAt,
      user: payload && payload.user ? payload.user : null
    });

    return Object.assign({}, payload, { session });
  }

  function getMe() {
    return request('/me', { method: 'GET' });
  }

  function createLot(payload) {
    return request('/lots', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  function createWeighing(payload) {
    return request('/weighings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  function finalizeWeighing(weighingId, payload) {
    return request(`/weighings/${encodeURIComponent(weighingId)}/finalize`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  function reopenWeighing(weighingId) {
    return request(`/weighings/${encodeURIComponent(weighingId)}/reopen`, {
      method: 'PATCH'
    });
  }

  function listLots(limit) {
    const query = limit ? `?limit=${encodeURIComponent(limit)}` : '';
    return request(`/lots${query}`, { method: 'GET' });
  }

  function listWeighings(options) {
    const params = new URLSearchParams();
    const opts = options || {};
    if (opts.lotId) params.set('lot_id', opts.lotId);
    if (opts.limit) params.set('limit', String(opts.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/weighings${query}`, { method: 'GET' });
  }

  function listReports(limit) {
    const query = limit ? `?limit=${encodeURIComponent(limit)}` : '';
    return request(`/reports${query}`, { method: 'GET' });
  }

  function getReport(reportId) {
    return request(`/reports/${encodeURIComponent(reportId)}`, { method: 'GET' });
  }

  function createReport(payload) {
    return request('/reports', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  global.DripApi = {
    CONFIG_KEY,
    SESSION_KEY,
    getConfig,
    setConfig,
    clearConfig,
    getSession,
    setSession,
    clearSession,
    isEnabled,
    request,
    getHealth,
    pushSnapshot,
    pullSince,
    login,
    getMe,
    createLot,
    createWeighing,
    finalizeWeighing,
    reopenWeighing,
    listLots,
    listWeighings,
    listReports,
    getReport,
    createReport
  };
})(window);
