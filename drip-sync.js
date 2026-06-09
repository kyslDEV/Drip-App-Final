(function (global) {
  function getUserConfig() {
    try {
      const raw = global.localStorage.getItem('drip_user');
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn('Erro ao ler configuracao do usuario', error);
      return {};
    }
  }

  function buildLocalSnapshot(options) {
    if (!global.DripData) {
      throw new Error('DripData nao carregado.');
    }

    const report = global.DripData.buildReportData();
    const user = getUserConfig();
    const includeReport = Boolean(options && options.includeReport);

    return {
      app: 'DripTest',
      schemaVersion: 1,
      generatedAt: new Date(report.generatedAt).toISOString(),
      user,
      store: {
        version: global.DripData.STORE_VERSION,
        initialRecords: report.initialRecords,
        absorptionTests: report.absorptionTests
      },
      report: includeReport ? report : {}
    };
  }

  async function pushLocalStore(options) {
    if (!global.DripApi || !global.DripApi.isEnabled()) {
      return { skipped: true, reason: 'api_not_configured' };
    }

    const snapshot = buildLocalSnapshot(options);
    return global.DripApi.pushSnapshot(snapshot);
  }

  global.DripSync = {
    buildLocalSnapshot,
    pushLocalStore
  };
})(window);
