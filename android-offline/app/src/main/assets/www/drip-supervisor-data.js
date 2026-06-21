(function (global) {
  function firstText() {
    for (let i = 0; i < arguments.length; i += 1) {
      const text = String(arguments[i] == null ? '' : arguments[i]).trim();
      if (text && text !== '-') return text;
    }
    return '';
  }

  function toTimestamp(value) {
    if (value == null || value === '') return NaN;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : NaN;
    }
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : NaN;
  }

  function elapsedMin(start, nowValue) {
    const ms = toTimestamp(start);
    if (!Number.isFinite(ms)) return null;
    const nowMs = nowValue == null ? Date.now() : Number(nowValue);
    return Math.max(0, (nowMs - ms) / 60000);
  }

  function expectedAt(record) {
    const start = firstText(record.createdAt, record.initialWeighedAt, record.initial_weighed_at, record.created_at);
    const time = Number(record.timeMin != null ? record.timeMin : record.time_min);
    const startMs = toTimestamp(start);
    if (!Number.isFinite(startMs) || !Number.isFinite(time)) return null;
    return startMs + time * 60000;
  }

  function parseShiftFromNotes(value) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return '';
    const match = text.match(/turno:\s*([^|]+)/i);
    return match ? match[1].trim() : '';
  }

  function analysisFrom(record) {
    const analysis = firstText(record.analysisType, record.analysis_type);
    if (analysis) return analysis;
    if (record.gross != null || record.finalNet != null || record.initial_gross_g != null) return 'DripTest';
    return 'Outras analises';
  }

  function mapStatus(record) {
    const raw = String(record.status || '').toLowerCase();
    if (raw === 'final' || raw === 'done' || raw === 'completed') return 'done';
    if (raw === 'error' || raw === 'failed') return 'error';
    if (record.finalNet != null || record.final_net_g != null || record.stage === 'Finalizado') return 'done';
    if (record.stage && String(record.stage).toLowerCase().includes('aguard')) return 'waiting';
    if (record.createdAt || record.created_at || record.initial_weighed_at) return 'running';
    return 'waiting';
  }

  function stageFrom(record, nowValue) {
    if (record.stage) return String(record.stage);
    if (record.finalNet != null || record.final_net_g != null) return 'Finalizado';
    const plannedAt = record.plannedAt || expectedAt(record);
    const plannedMs = toTimestamp(plannedAt);
    const nowMs = nowValue == null ? Date.now() : Number(nowValue);
    if (Number.isFinite(plannedMs) && nowMs >= plannedMs) return 'Aguardando pesagem final';
    if (record.createdAt || record.created_at || record.initial_weighed_at) return 'Em gotejamento';
    return 'Pesagem inicial';
  }

  function detectResult(record) {
    const marketText = String(record.result || record.marketIndicator || record.market_indicator || '').toLowerCase();
    if (marketText.includes('altera') || marketText.includes('revis') || record.marketWarning || record.market_warning) {
      return 'PENDENTE DE REVISAO';
    }
    if (record.finalNet == null && String(record.status || '').toLowerCase() !== 'final') {
      return 'AGUARDANDO FINAL';
    }
    return 'Normal';
  }

  function normalizeLocalRows(report, options) {
    const rows = report && Array.isArray(report.initialRecords) ? report.initialRecords : [];
    const nowValue = options && options.nowMs;
    return rows.map((record, idx) => {
      const plannedAt = expectedAt(record);
      const normalized = {
        id: String(record.id || record.weighingId || 'LOC-' + (idx + 1)),
        clientRecordId: String(record.id || record.weighingId || 'LOC-' + (idx + 1)),
        serverId: firstText(record.backendId),
        source: 'local',
        sourceLabel: 'Local',
        analysisType: analysisFrom(record),
        lot: firstText(record.lote, record.lot, 'Sem lote') || 'Sem lote',
        createdAt: record.createdAt || record.initialWeighedAt || record.created_at,
        plannedAt,
        dripAt: record.dripAt || record.drippingAt || plannedAt,
        elapsedMin: elapsedMin(record.createdAt || record.initialWeighedAt || record.created_at, nowValue),
        responsible: firstText(record.monitor, record.monitorName, '-') || '-',
        sampleType: firstText(record.species, record.productBrand, '-') || '-',
        productBrand: firstText(record.productBrand, record.species, '-') || '-',
        shift: firstText(record.shift, record.turno, '-') || '-',
        sector: firstText(record.plantName, record.sectorName, '-') || '-',
        fabDate: firstText(record.fabDate, '-') || '-',
        gross: record.gross,
        net: record.net,
        finalNet: record.finalNet,
        dripPct: record.grossAbsPct || record.lossPct,
        marketIndicator: record.marketIndicator,
        marketWarning: Boolean(record.marketWarning),
        observations: firstText(record.notes, record.note, record.obs, '-'),
        syncStatus: firstText(record.syncStatus, 'local'),
        syncedAt: record.syncedAt || null,
        syncError: firstText(record.syncError),
        raw: record
      };
      normalized.status = mapStatus(normalized);
      normalized.stage = stageFrom(normalized, nowValue);
      normalized.result = detectResult(normalized);
      return normalized;
    });
  }

  function normalizeServerRows(weighings, options) {
    const rows = Array.isArray(weighings) ? weighings : [];
    const nowValue = options && options.nowMs;
    return rows.map((weighing, idx) => {
      const notes = firstText(weighing.notes);
      const normalized = {
        id: String(weighing.client_record_id || weighing.id || weighing.weighing_id || 'SRV-' + (idx + 1)),
        clientRecordId: firstText(weighing.client_record_id),
        serverId: firstText(weighing.id, weighing.weighing_id),
        source: 'server',
        sourceLabel: 'API',
        analysisType: analysisFrom(weighing),
        lot: firstText(weighing.lot_code, weighing.lote, 'Sem lote') || 'Sem lote',
        createdAt: weighing.initial_weighed_at || weighing.created_at,
        plannedAt: expectedAt(weighing),
        dripAt: weighing.drip_at || weighing.expected_at || expectedAt(weighing),
        elapsedMin: elapsedMin(weighing.initial_weighed_at || weighing.created_at, nowValue),
        responsible: firstText(weighing.monitor_name, weighing.monitor, '-') || '-',
        sampleType: firstText(weighing.sample_type, weighing.product_brand, weighing.species, '-') || '-',
        productBrand: firstText(weighing.product_brand, weighing.species, '-') || '-',
        shift: firstText(weighing.shift, weighing.turno, parseShiftFromNotes(notes), '-') || '-',
        sector: firstText(weighing.plant_name, weighing.sector_name, '-') || '-',
        fabDate: firstText(weighing.fabrication_date, '-') || '-',
        gross: weighing.initial_gross_g,
        net: weighing.initial_net_g,
        finalNet: weighing.final_net_g,
        dripPct: weighing.loss_pct,
        marketIndicator: weighing.market_indicator,
        marketWarning: Boolean(weighing.market_warning),
        observations: firstText(notes, '-'),
        syncStatus: 'synced',
        syncedAt: null,
        syncError: '',
        raw: weighing
      };
      normalized.status = mapStatus(normalized);
      normalized.stage = stageFrom(normalized, nowValue);
      normalized.result = detectResult(normalized);
      return normalized;
    });
  }

  function buildKeys(record) {
    const keys = [];
    const clientRecordId = firstText(record.clientRecordId, record.id);
    const serverId = firstText(record.serverId);
    const createdAt = firstText(record.createdAt);
    const lot = firstText(record.lot);
    if (clientRecordId) keys.push('client:' + clientRecordId);
    if (serverId) keys.push('server:' + serverId);
    if (lot || createdAt) keys.push('fallback:' + lot + '|' + createdAt);
    return keys;
  }

  function mergePair(localRecord, serverRecord, nowValue) {
    const merged = Object.assign({}, localRecord, serverRecord);
    merged.id = firstText(localRecord.id, localRecord.clientRecordId, serverRecord.clientRecordId, serverRecord.serverId);
    merged.clientRecordId = firstText(localRecord.clientRecordId, serverRecord.clientRecordId, localRecord.id);
    merged.serverId = firstText(serverRecord.serverId, localRecord.serverId);
    merged.source = 'merged';
    merged.sourceLabel = 'Local + API';
    merged.syncStatus = 'synced';
    merged.syncError = '';
    merged.observations = firstText(serverRecord.observations, localRecord.observations, '-');
    merged.responsible = firstText(serverRecord.responsible, localRecord.responsible, '-');
    merged.sampleType = firstText(serverRecord.sampleType, localRecord.sampleType, '-');
    merged.productBrand = firstText(serverRecord.productBrand, localRecord.productBrand, '-');
    merged.shift = firstText(serverRecord.shift, localRecord.shift, '-');
    merged.sector = firstText(serverRecord.sector, localRecord.sector, '-');
    merged.fabDate = firstText(serverRecord.fabDate, localRecord.fabDate, '-');
    merged.createdAt = firstText(serverRecord.createdAt, localRecord.createdAt);
    merged.plannedAt = serverRecord.plannedAt || localRecord.plannedAt || expectedAt(merged);
    merged.dripAt = serverRecord.dripAt || localRecord.dripAt || merged.plannedAt;
    merged.elapsedMin = elapsedMin(merged.createdAt, nowValue);
    merged.status = mapStatus(merged);
    merged.stage = stageFrom(merged, nowValue);
    merged.result = detectResult(merged);
    return merged;
  }

  function mergeRecords(localRows, serverRows, options) {
    const localList = Array.isArray(localRows) ? localRows.slice() : [];
    const serverList = Array.isArray(serverRows) ? serverRows.slice() : [];
    const nowValue = options && options.nowMs;
    const serverByKey = new Map();
    const usedServerIds = new Set();
    const mergedRows = [];

    serverList.forEach((record) => {
      buildKeys(record).forEach((key) => {
        if (key && !serverByKey.has(key)) {
          serverByKey.set(key, record);
        }
      });
    });

    localList.forEach((record) => {
      const match = buildKeys(record).map((key) => serverByKey.get(key)).find(Boolean);
      if (match) {
        mergedRows.push(mergePair(record, match, nowValue));
        if (match.serverId) usedServerIds.add(match.serverId);
        return;
      }
      mergedRows.push(record);
    });

    serverList.forEach((record) => {
      if (record.serverId && usedServerIds.has(record.serverId)) return;
      const matchedByClient = record.clientRecordId && localList.some((localRecord) => firstText(localRecord.clientRecordId, localRecord.id) === record.clientRecordId);
      if (matchedByClient) return;
      mergedRows.push(record);
    });

    return mergedRows;
  }

  function summarizeSources(records) {
    return (Array.isArray(records) ? records : []).reduce((summary, record) => {
      if (record.source === 'merged') summary.merged += 1;
      else if (record.source === 'server') summary.server += 1;
      else summary.local += 1;
      return summary;
    }, { local: 0, server: 0, merged: 0 });
  }

  global.DripSupervisorData = {
    firstText,
    parseShiftFromNotes,
    elapsedMin,
    expectedAt,
    detectResult,
    mapStatus,
    stageFrom,
    analysisFrom,
    normalizeLocalRows,
    normalizeServerRows,
    mergeRecords,
    summarizeSources
  };
})(window);
