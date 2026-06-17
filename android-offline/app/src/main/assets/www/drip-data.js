(function (global) {
  const LEGACY_KEY = 'driptest_pesagem_inicial_v1';
  const STORE_KEY = 'driptest_store_v2';
  const STORE_VERSION = 2;
  const STANDARD_SAMPLE_COUNT = 6;
  const ANALYSIS_SHEET_SLOT_COUNT = 3;

  const immersionRanges = [
    { min: 0, max: 800, minutes: 65 },
    { min: 801, max: 900, minutes: 72 },
    { min: 901, max: 1000, minutes: 79 },
    { min: 1001, max: 1100, minutes: 86 },
    { min: 1101, max: 1200, minutes: 93 },
    { min: 1201, max: 1300, minutes: 100 },
    { min: 1301, max: 1400, minutes: 107 },
    { min: 1401, max: 1500, minutes: 114 },
    { min: 1501, max: 1600, minutes: 121 },
    { min: 1601, max: 1700, minutes: 128 },
    { min: 1701, max: 1800, minutes: 135 },
    { min: 1801, max: 1900, minutes: 142 },
    { min: 1901, max: 2000, minutes: 149 },
    { min: 2001, max: 2100, minutes: 156 },
    { min: 2101, max: 2200, minutes: 163 },
    { min: 2201, max: 2300, minutes: 170 },
    { min: 2301, max: 2400, minutes: 177 },
    { min: 2401, max: 2500, minutes: 184 },
    { min: 2501, max: 2600, minutes: 191 },
    { min: 2601, max: 2700, minutes: 198 },
    { min: 2701, max: 2800, minutes: 205 },
    { min: 2801, max: 2900, minutes: 212 },
    { min: 2901, max: 3000, minutes: 219 },
    { min: 3001, max: 3100, minutes: 226 },
    { min: 3101, max: 3200, minutes: 233 },
    { min: 3201, max: 3300, minutes: 240 },
    { min: 3301, max: 3400, minutes: 247 },
    { min: 3401, max: 3500, minutes: 254 },
    { min: 3501, max: 3600, minutes: 261 },
    { min: 3601, max: 3700, minutes: 268 },
    { min: 3701, max: 3800, minutes: 275 },
    { min: 3801, max: 3900, minutes: 282 },
    { min: 3901, max: 4000, minutes: 289 }
  ];

  const anchors = immersionRanges
    .map((range) => ({
      w: Math.round((range.min + range.max) / 2),
      minutes: range.minutes
    }))
    .sort((a, b) => a.w - b.w);

  function createId() {
    if (global.crypto && global.crypto.randomUUID) {
      return global.crypto.randomUUID();
    }
    return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  }

  function roundTwo(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function truncateNumber(value, decimalPlaces) {
    const numericValue = Number(value);
    const digits = Number.isInteger(decimalPlaces) && decimalPlaces >= 0 ? decimalPlaces : 6;
    if (!Number.isFinite(numericValue)) return null;
    const factor = 10 ** digits;
    return Math.trunc(numericValue * factor) / factor;
  }

  function truncateTwo(value) {
    return truncateNumber(value, 2);
  }

  function getFinalWeight(record) {
    if (!record) return null;
    if (record.finalNet != null) return Math.round(Number(record.finalNet));
    if (record.finalGross != null) return Math.round(Number(record.finalGross));
    return null;
  }

  // Peso drip = peso bruto - embalagem inicial - peso final.
  // Como `net` ja e o bruto descontado da embalagem inicial, a conta fica net - final.
  function calculateAbsorption(record) {
    const initialNet = Number(record && record.net);
    const finalWeight = getFinalWeight(record);
    if (!Number.isFinite(initialNet) || !Number.isFinite(finalWeight)) return null;
    return Math.round(initialNet - finalWeight);
  }

  // Percentual exibido na amostra: peso drip * 100 / peso liquido inicial.
  function calculateAbsorptionPercent(record) {
    const absorption = calculateAbsorption(record);
    const initialNet = Number(record && record.net);
    if (!Number.isFinite(absorption) || !Number.isFinite(initialNet) || initialNet <= 0) return null;
    return roundTwo((absorption * 100) / initialNet);
  }

  function calculateOfficialDripPercent(record) {
    const gross = Number(record && record.gross);
    const initialPack = Number(record && record.packGrams);
    const finalWeightWithPack = Number(record && record.finalNet);
    const finalPack = Number(record && record.finalPackGrams);
    const loss = gross - initialPack - finalWeightWithPack;
    const base = gross - initialPack - finalPack;
    if (!Number.isFinite(loss) || !Number.isFinite(base) || base <= 0) return null;
    return (loss * 100) / base;
  }

  // Percentual usado para drip medio e classificacao de mercado, preservando precisao.
  function calculateGrossAbsorptionPercent(gross, finalGross) {
    const initialGross = Number(gross);
    const finalGrossValue = Number(finalGross);
    if (!Number.isFinite(initialGross) || !Number.isFinite(finalGrossValue) || initialGross <= 0) {
      return null;
    }
    return ((initialGross - finalGrossValue) * 100) / initialGross;
  }

  function calculateRecordGrossAbsorptionPercent(record) {
    return calculateGrossAbsorptionPercent(record && record.gross, record && record.finalGross);
  }

  // Classificacao comercial por faixa percentual. Mantida aqui para evitar regras divergentes nas telas.
  function classifyMarketByPercent(percent) {
    const value = Number(percent);
    if (!Number.isFinite(value)) {
      return { indicator: null, warning: false };
    }
    if (value >= 8) return { indicator: 'Alterado (Mercado Interno)', warning: true };
    if (value >= 6) return { indicator: 'Mercado Interno', warning: false };
    if (value >= 5.1) return { indicator: 'União Europeia (Sugerir exportação)', warning: false };
    if (value >= 4) return { indicator: 'Rússia (Sugerir exportação)', warning: false };
    return { indicator: 'Normal', warning: false };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeProductBrand(value, species) {
    const raw = String(value || '').trim();
    const speciesText = String(species || '').trim();
    const source = raw || speciesText;
    const normalized = source
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalized === 'frango friato' || normalized === 'friato' || normalized === 'ave friato') {
      return 'Ave Friato';
    }

    if (normalized === 'frango nutriza' || normalized === 'nutriza' || normalized === 'ave nutriza') {
      return 'Ave Nutriza';
    }

    return source || 'Não informado';
  }

  function normalizeShift(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes('1') || normalized.includes('manha')) return '1° Manhã';
    if (normalized.includes('2') || normalized.includes('noite')) return '2° Noite';
    return raw;
  }

  function createEmptyStore() {
    return {
      version: STORE_VERSION,
      initialRecords: [],
      absorptionTests: [],
      archivedAnalyses: [],
      updatedAt: Date.now()
    };
  }

  // Tempo de imersao calculado pelo peso bruto; fora das faixas exatas, interpola entre pontos conhecidos.
  function computeMinutesWithInterpolation(grams) {
    const weight = Math.round(Number(grams) || 0);
    const directRange = immersionRanges.find((range) => weight >= range.min && weight <= range.max);
    if (directRange) return { minutes: directRange.minutes, interpolated: false };

    if (weight < anchors[0].w) {
      return { minutes: anchors[0].minutes, interpolated: true };
    }

    if (weight > 4000) {
      return { minutes: null, interpolated: false };
    }

    let lower = anchors[0];
    let upper = anchors[anchors.length - 1];

    for (let i = 0; i < anchors.length; i += 1) {
      if (anchors[i].w <= weight) lower = anchors[i];
      if (anchors[i].w >= weight) {
        upper = anchors[i];
        break;
      }
    }

    if (lower.w === upper.w) {
      return { minutes: lower.minutes, interpolated: false };
    }

    const ratio = (weight - lower.w) / (upper.w - lower.w);
    const minutes = Math.round(lower.minutes + ratio * (upper.minutes - lower.minutes));
    return { minutes, interpolated: true };
  }

  // Normaliza registros salvos/importados para manter compatibilidade com versoes anteriores do app.
  function normalizeInitialRecord(item) {
    const packKg = item.packKg == null ? 0.006 : Number(item.packKg);
    const packGrams = Math.round(Number(item.packGrams) || packKg * 1000);
    const gross = Math.round(Number(item.gross) || 0);
    const net = Math.round(Number(item.net) || Math.max(0, gross - packGrams));
    const computed = computeMinutesWithInterpolation(gross);
    const species = String(item.species || 'Outra');
    const productBrand = normalizeProductBrand(item.productBrand || item.brand || item.marcaProduto || item.marca, species);
    const finalGross = item.finalGross != null ? Math.round(Number(item.finalGross)) : undefined;
    const finalPackKg = item.finalPackKg != null ? Number(item.finalPackKg) : undefined;
    const finalPackGrams = finalPackKg != null
      ? Math.round(finalPackKg * 1000)
      : (item.finalPackGrams != null ? Math.round(Number(item.finalPackGrams)) : undefined);

    let finalNet;
    if (item.finalNet != null) {
      finalNet = Math.round(Number(item.finalNet));
    } else if (finalGross != null) {
      finalNet = finalGross - (finalPackGrams || 0);
    }

    const lossAbs = calculateAbsorption({ net, finalNet, finalGross });
    const lossPct = calculateAbsorptionPercent({ net, finalNet, finalGross });

    // Calculate absorption percent based on gross weights as requested:
    // (Peso Bruto - Peso Bruto Final) * 100 / Peso Bruto
    const grossAbsPct = calculateGrossAbsorptionPercent(gross, finalGross);

    const market = classifyMarketByPercent(grossAbsPct);

    return {
      id: String(item.id || createId()),
      species,
      productBrand,
      lote: String(item.lote || ''),
      monitor: String(item.monitor || item.monitora || ''),
      plantName: String(item.plantName || item.sectorName || item.setor || item.plant || item.planta || ''),
      shift: normalizeShift(item.shift || item.turno || item.productionShift),
      turno: normalizeShift(item.shift || item.turno || item.productionShift),
      fabDate: String(item.fabDate || item.fabricationDate || ''),
      gross,
      packKg,
      packGrams,
      net,
      timeMin: item.timeMin == null ? computed.minutes : Number(item.timeMin),
      interpolated: item.interpolated == null ? computed.interpolated : Boolean(item.interpolated),
      status: String(item.status || (finalNet != null ? 'final' : 'Inicial')),
      createdAt: Number(item.createdAt || Date.now()),
      finalGross,
      finalNet,
      finalPackKg,
      finalPackGrams,
      lossAbs,
      lossPct,
      grossAbsPct,
      marketIndicator: market.indicator,
      marketWarning: market.warning,
      finalAt: item.finalAt ? Number(item.finalAt) : undefined
    };
  }

  function normalizeAbsorptionTest(item) {
    const initialWeight = Number(item.initialWeight);
    const finalWeight = Number(item.finalWeight);
    const dryWeight = item.dryWeight == null || item.dryWeight === '' ? null : Number(item.dryWeight);
    const absorption = Number(item.absorption);
    const absorptionPercent = item.absorptionPercent == null ? null : Number(item.absorptionPercent);
    const species = String(item.species || 'Outra');
    const productBrand = normalizeProductBrand(item.productBrand || item.brand || item.marcaProduto || item.marca, species);

    return {
      id: String(item.id || createId()),
      recordId: item.recordId ? String(item.recordId) : '',
      species,
      productBrand,
      lote: String(item.lote || ''),
      plantName: String(item.plantName || item.sectorName || item.setor || item.plant || item.planta || ''),
      shift: normalizeShift(item.shift || item.turno || item.productionShift),
      turno: normalizeShift(item.shift || item.turno || item.productionShift),
      baseType: item.baseType === 'dry' ? 'dry' : 'initial',
      initialWeight: Number.isFinite(initialWeight) ? roundTwo(initialWeight) : 0,
      finalWeight: Number.isFinite(finalWeight) ? roundTwo(finalWeight) : 0,
      dryWeight: Number.isFinite(dryWeight) ? roundTwo(dryWeight) : null,
      absorption: Number.isFinite(absorption) ? roundTwo(absorption) : 0,
      absorptionPercent: Number.isFinite(absorptionPercent) ? roundTwo(absorptionPercent) : null,
      note: String(item.note || ''),
      createdAt: Number(item.createdAt || Date.now())
    };
  }

  function normalizeArchivedAnalysis(item) {
    const initialRecords = Array.isArray(item.initialRecords) ? item.initialRecords.map(normalizeInitialRecord) : [];
    const absorptionTests = Array.isArray(item.absorptionTests) ? item.absorptionTests.map(normalizeAbsorptionTest) : [];
    const report = item.report && typeof item.report === 'object' ? clone(item.report) : null;
    const user = item.user && typeof item.user === 'object' ? clone(item.user) : {};
    const lot = user.lot || (initialRecords[0] && initialRecords[0].lote) || '';

    return {
      id: String(item.id || createId()),
      archivedAt: Number(item.archivedAt || Date.now()),
      status: String(item.status || 'archived'),
      user,
      summary: {
        lot,
        monitor: user.monitorName || user.monitor || (initialRecords[0] && initialRecords[0].monitor) || '',
        plantName: user.plantName || user.sectorName || (initialRecords[0] && initialRecords[0].plantName) || '',
        shift: user.shift || user.turno || (initialRecords[0] && (initialRecords[0].shift || initialRecords[0].turno)) || '',
        fabricationDate: user.fabDate || (initialRecords[0] && initialRecords[0].fabDate) || '',
        initialRecords: initialRecords.length,
        finalizedRecords: initialRecords.filter((record) => record.finalNet != null || String(record.status).toLowerCase() === 'final').length,
        absorptionTests: absorptionTests.length
      },
      initialRecords,
      absorptionTests,
      report
    };
  }

  function syncLegacy(records) {
    try {
      global.localStorage.setItem(LEGACY_KEY, JSON.stringify(records.map(normalizeInitialRecord)));
    } catch (error) {
      console.warn('Erro ao sincronizar armazenamento legado', error);
    }
  }

  function normalizeStore(store) {
    const initialRecords = Array.isArray(store.initialRecords) ? store.initialRecords.map(normalizeInitialRecord) : [];
    const absorptionTests = Array.isArray(store.absorptionTests) ? store.absorptionTests.map(normalizeAbsorptionTest) : [];
    const archivedAnalyses = Array.isArray(store.archivedAnalyses) ? store.archivedAnalyses.map(normalizeArchivedAnalysis) : [];

    return {
      version: STORE_VERSION,
      initialRecords,
      absorptionTests,
      archivedAnalyses,
      updatedAt: Date.now()
    };
  }

  function saveStore(store) {
    const normalized = normalizeStore(store);
    try {
      global.localStorage.setItem(STORE_KEY, JSON.stringify(normalized));
      syncLegacy(normalized.initialRecords);
    } catch (error) {
      console.warn('Erro ao salvar store DripTest', error);
    }
    return normalized;
  }

  function migrateLegacy() {
    try {
      const raw = global.localStorage.getItem(LEGACY_KEY);
      if (!raw) return createEmptyStore();

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return createEmptyStore();

      const migrated = normalizeStore({
        initialRecords: parsed,
        absorptionTests: []
      });

      saveStore(migrated);
      return migrated;
    } catch (error) {
      console.warn('Erro ao migrar armazenamento legado', error);
      return createEmptyStore();
    }
  }

  function loadStore() {
    try {
      const raw = global.localStorage.getItem(STORE_KEY);
      if (!raw) return migrateLegacy();

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return migrateLegacy();

      const normalized = normalizeStore(parsed);
      syncLegacy(normalized.initialRecords);
      return normalized;
    } catch (error) {
      console.warn('Erro ao carregar store DripTest', error);
      return migrateLegacy();
    }
  }

  function getInitialRecords() {
    return clone(loadStore().initialRecords);
  }

  function saveInitialRecords(records) {
    const store = loadStore();
    store.initialRecords = Array.isArray(records) ? records.map(normalizeInitialRecord) : [];
    return saveStore(store).initialRecords;
  }

  function clearInitialRecords() {
    const store = loadStore();
    store.initialRecords = [];
    return saveStore(store).initialRecords;
  }

  function getAbsorptionTests() {
    return clone(loadStore().absorptionTests).sort((a, b) => b.createdAt - a.createdAt);
  }

  function saveAbsorptionTest(test) {
    const store = loadStore();
    const normalized = normalizeAbsorptionTest(test);
    const existingIndex = store.absorptionTests.findIndex((item) => item.id === normalized.id);

    if (existingIndex >= 0) {
      store.absorptionTests[existingIndex] = normalized;
    } else {
      store.absorptionTests.unshift(normalized);
    }

    saveStore(store);
    return normalized;
  }

  function clearAbsorptionTests() {
    const store = loadStore();
    store.absorptionTests = [];
    return saveStore(store).absorptionTests;
  }

  function getArchivedAnalyses() {
    return clone(loadStore().archivedAnalyses)
      .sort((a, b) => Number(b.archivedAt || 0) - Number(a.archivedAt || 0));
  }

  function archiveCurrentAnalysis(options) {
    const store = loadStore();
    const initialRecords = Array.isArray(store.initialRecords) ? store.initialRecords : [];
    const absorptionTests = Array.isArray(store.absorptionTests) ? store.absorptionTests : [];

    if (!initialRecords.length && !absorptionTests.length) {
      return null;
    }

    // O relatorio e calculado antes da limpeza para congelar o pacote ativo.
    const report = buildReportData();
    const archived = normalizeArchivedAnalysis({
      id: createId(),
      archivedAt: Date.now(),
      user: options && options.user ? options.user : {},
      initialRecords,
      absorptionTests,
      report
    });

    store.archivedAnalyses = [archived].concat(store.archivedAnalyses || []);
    store.initialRecords = [];
    store.absorptionTests = [];
    saveStore(store);
    return clone(archived);
  }

  // Consolida pesagens, testes e medias por lote para alimentar telas de laudo e exportacoes.
  function buildReportData() {
    const store = loadStore();
    const initialRecords = store.initialRecords.slice().sort((a, b) => a.createdAt - b.createdAt);
    const absorptionTests = store.absorptionTests.slice().sort((a, b) => b.createdAt - a.createdAt);
    const finalizedRecords = initialRecords.filter((record) => record.finalNet != null || String(record.status).toLowerCase() === 'final');
    const uniqueLots = new Set(initialRecords.map((record) => String(record.lote || '').trim()).filter(Boolean));
    const uniqueMonitors = new Set(initialRecords.map((record) => String(record.monitor || '').trim()).filter(Boolean));
    const uniquePlants = new Set(initialRecords.map((record) => String(record.plantName || '').trim()).filter(Boolean));
    const uniqueShifts = new Set(initialRecords.map((record) => normalizeShift(record.shift || record.turno)).filter(Boolean));
    const uniqueSpecies = new Set(initialRecords.map((record) => String(record.species || '').trim()).filter(Boolean));
    const uniqueBrands = new Set(initialRecords.map((record) => normalizeProductBrand(record.productBrand, record.species)).filter(Boolean));
    const uniqueFabDates = new Set(initialRecords.map((record) => String(record.fabDate || '').trim()).filter(Boolean));
    const totalTimeMin = initialRecords.reduce((sum, record) => sum + (Number(record.timeMin) || 0), 0);
    const totalLossAbs = finalizedRecords.reduce((sum, record) => sum + (Number(record.lossAbs) || 0), 0);
    const totalGross = initialRecords.reduce((sum, record) => sum + (Number(record.gross) || 0), 0);
    const totalNetInitial = initialRecords.reduce((sum, record) => sum + (Number(record.net) || 0), 0);
    const totalFinalNet = finalizedRecords.reduce((sum, record) => sum + (Number(record.finalNet) || 0), 0);
    const averageTimeMin = initialRecords.length ? roundTwo(totalTimeMin / initialRecords.length) : null;
    const averageLossPct = finalizedRecords.length
      ? truncateTwo(finalizedRecords.reduce((sum, record) => sum + (Number(record.lossPct) || 0), 0) / STANDARD_SAMPLE_COUNT)
      : null;
    const averageAbsorption = absorptionTests.length
      ? roundTwo(absorptionTests.reduce((sum, test) => sum + (Number(test.absorption) || 0), 0) / absorptionTests.length)
      : null;
    const averageAbsorptionPercent = absorptionTests.length
      ? roundTwo(absorptionTests.reduce((sum, test) => sum + (Number(test.absorptionPercent) || 0), 0) / absorptionTests.length)
      : null;
    const flowDurations = finalizedRecords
      .map((record) => formatDurationMinutes(record.createdAt, record.finalAt))
      .filter((value) => Number.isFinite(value));
    const bySpecies = buildGroupSummary(initialRecords, (record) => record.species, 'Não informado');
    const byBrand = buildGroupSummary(initialRecords, (record) => normalizeProductBrand(record.productBrand, record.species), 'Marca não informada');
    const byLot = buildGroupSummary(initialRecords, (record) => record.lote, 'Sem lote');
    const byMonitor = buildGroupSummary(initialRecords, (record) => record.monitor, 'Sem monitor');
    const byShift = buildGroupSummary(initialRecords, (record) => normalizeShift(record.shift || record.turno), 'Sem turno');
    const byPlant = buildGroupSummary(initialRecords, (record) => record.plantName, 'Setor não informado');

    // Compute lot-average gross absorption percent (drip média) and apply lot-level market classification
    const lotSummaries = buildLotSummaries(finalizedRecords);
    const lotAverages = new Map(lotSummaries.map((item) => [item.key, item.averageGrossAbsPct]));

    const finalizedWithLotIndicator = finalizedRecords.map((r) => {
      const lotKey = normalizeGroupKey(r.lote, 'Sem lote');
      const lotAvg = lotAverages.has(lotKey) ? lotAverages.get(lotKey) : null;
      let marketIndicator = r.marketIndicator;
      let marketWarning = Boolean(r.marketWarning);
      if (lotAvg != null) {
        const market = classifyMarketByPercent(lotAvg);
        marketIndicator = market.indicator;
        marketWarning = market.warning;
      }
      return Object.assign({}, r, { lotGrossAbsPct: lotAvg, marketIndicator, marketWarning });
    });

    return {
      generatedAt: Date.now(),
      laudo: {
        title: 'Laudo técnico de análise de gotejamento',
        objective: 'Registrar e consolidar pesagens iniciais e finais para avaliação de perda/absorção no processo DripTest.',
        method: 'Pesagem inicial do produto, cálculo do peso líquido descontando embalagem, determinação do tempo previsto pelo peso bruto, acompanhamento do cronograma e registro da pesagem final.',
        traceability: {
          lots: Array.from(uniqueLots).sort((a, b) => a.localeCompare(b, 'pt-BR')),
          monitors: Array.from(uniqueMonitors).sort((a, b) => a.localeCompare(b, 'pt-BR')),
          plants: Array.from(uniquePlants).sort((a, b) => a.localeCompare(b, 'pt-BR')),
          shifts: Array.from(uniqueShifts).sort((a, b) => a.localeCompare(b, 'pt-BR')),
          species: Array.from(uniqueSpecies).sort((a, b) => a.localeCompare(b, 'pt-BR')),
          brands: Array.from(uniqueBrands).sort((a, b) => a.localeCompare(b, 'pt-BR')),
          fabricationDates: Array.from(uniqueFabDates).sort()
        }
      },
      metadata: {
        storeVersion: store.version || STORE_VERSION,
        updatedAt: store.updatedAt || null,
        firstCreatedAt: initialRecords.length ? initialRecords[0].createdAt : null,
        lastCreatedAt: initialRecords.length ? initialRecords[initialRecords.length - 1].createdAt : null,
        firstFinalAt: minNumber(finalizedRecords, (record) => record.finalAt),
        lastFinalAt: maxNumber(finalizedRecords, (record) => record.finalAt)
      },
      totals: {
        initialRecords: initialRecords.length,
        finalizedRecords: finalizedWithLotIndicator.length,
        pendingRecords: initialRecords.length - finalizedWithLotIndicator.length,
        marketWarnings: finalizedWithLotIndicator.filter((r) => r.marketWarning).length,
        absorptionTests: absorptionTests.length,
        lots: uniqueLots.size,
        monitors: uniqueMonitors.size,
        plants: uniquePlants.size,
        shifts: uniqueShifts.size,
        species: uniqueSpecies.size,
        brands: uniqueBrands.size,
        fabricationDates: uniqueFabDates.size,
        totalTimeMin,
        totalLossAbs,
        totalGross,
        totalNetInitial,
        totalFinalNet,
        averageTimeMin,
        averageFlowMinutes: flowDurations.length ? averageNumbers(flowDurations, (value) => value) : null,
        averageLossPct,
        averageAbsorption,
        averageAbsorptionPercent,
        interpolatedRecords: initialRecords.filter((record) => record.interpolated).length,
        recordsWithoutTime: initialRecords.filter((record) => record.timeMin == null).length,
        highestGross: maxNumber(initialRecords, (record) => record.gross),
        lowestGross: minNumber(initialRecords, (record) => record.gross),
        highestLossAbs: maxNumber(finalizedRecords, (record) => record.lossAbs),
        highestLossPct: maxNumber(finalizedRecords, (record) => record.lossPct)
      },
      groups: {
        bySpecies,
        byBrand,
        byLot,
        byMonitor,
        byPlant,
        byShift
      },
      lotSummaries,
      initialRecords,
      finalizedRecords: finalizedWithLotIndicator,
      absorptionTests
    };
  }

  function formatDateTime(ts) {
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatDurationMinutes(startTs, endTs) {
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs < startTs) return '-';
    return Math.round((endTs - startTs) / 60000);
  }

  function sumNumbers(items, selector) {
    return items.reduce((sum, item) => sum + (Number(selector(item)) || 0), 0);
  }

  function averageNumbers(items, selector) {
    if (!items.length) return null;
    return roundTwo(sumNumbers(items, selector) / items.length);
  }

  function formatPreciseNumber(value, decimalPlaces) {
    const truncated = truncateNumber(value, decimalPlaces);
    if (!Number.isFinite(truncated)) return '-';
    const digits = Number.isInteger(decimalPlaces) && decimalPlaces >= 0 ? decimalPlaces : 6;
    return truncated
      .toFixed(digits)
      .replace(/\.?0+$/, '')
      .replace('.', ',');
  }

  function minNumber(items, selector) {
    const values = items
      .map((item) => Number(selector(item)))
      .filter((value) => Number.isFinite(value));
    return values.length ? Math.min(...values) : null;
  }

  function maxNumber(items, selector) {
    const values = items
      .map((item) => Number(selector(item)))
      .filter((value) => Number.isFinite(value));
    return values.length ? Math.max(...values) : null;
  }

  function normalizeGroupKey(value, fallback) {
    const text = String(value == null ? '' : value).trim();
    return text || fallback;
  }

  function countUnique(items, selector) {
    return new Set(items.map(selector).filter(Boolean)).size;
  }

  function buildLotSummaries(finalizedRecords) {
    const lotGroups = new Map();

    finalizedRecords.forEach((record) => {
      const lotKey = normalizeGroupKey(record && record.lote, 'Sem lote');
      let percent = Number(record && record.lotGrossAbsPct);
      if (!Number.isFinite(percent)) percent = Number(record && record.grossAbsPct);
      if (!Number.isFinite(percent)) {
        percent = calculateGrossAbsorptionPercent(record && record.gross, record && record.finalGross);
      }
      if (!Number.isFinite(percent)) return;
      if (!lotGroups.has(lotKey)) lotGroups.set(lotKey, []);
      lotGroups.get(lotKey).push(percent);
    });

    return Array.from(lotGroups.entries())
      .map(([key, values]) => {
        const averageGrossAbsPct = values.reduce((sum, current) => sum + current, 0) / STANDARD_SAMPLE_COUNT;
        const market = classifyMarketByPercent(averageGrossAbsPct);
        return {
          key,
          records: values.length,
          averageGrossAbsPct,
          averageGrossAbsPctDisplay: formatPreciseNumber(averageGrossAbsPct, 6),
          marketIndicator: market.indicator,
          marketWarning: market.warning
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key, 'pt-BR'));
  }

  function getRecordSampleOrder(record) {
    const candidates = [
      record && record.sampleNumber,
      record && record.sample_number,
      record && record.sampleIndex,
      record && record.sample_index,
      record && record.order,
      record && record.ordem
    ];

    for (let index = 0; index < candidates.length; index += 1) {
      const value = Number(candidates[index]);
      if (Number.isFinite(value) && value > 0) return value;
    }

    return null;
  }

  function compareAnalysisSheetRecords(a, b) {
    const explicitA = getRecordSampleOrder(a);
    const explicitB = getRecordSampleOrder(b);
    if (explicitA != null || explicitB != null) {
      return (explicitA == null ? Number.MAX_SAFE_INTEGER : explicitA) - (explicitB == null ? Number.MAX_SAFE_INTEGER : explicitB);
    }

    const netDiff = Number(b && b.net || 0) - Number(a && a.net || 0);
    if (netDiff) return netDiff;

    const grossDiff = Number(b && b.gross || 0) - Number(a && a.gross || 0);
    if (grossDiff) return grossDiff;

    return Number(a && a.createdAt || 0) - Number(b && b.createdAt || 0);
  }

  function chunkItems(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }

  function groupAnalysisSheetRecords(records) {
    const groups = new Map();

    records.forEach((record) => {
      const lote = normalizeGroupKey(record && record.lote, 'Sem lote');
      const shift = normalizeShift(record && (record.shift || record.turno)) || 'Sem turno';
      const fabDate = normalizeGroupKey(record && record.fabDate, 'Sem data');
      const productBrand = normalizeProductBrand(record && record.productBrand, record && record.species);
      const plantName = normalizeGroupKey(record && record.plantName, 'Setor não informado');
      const key = [lote, shift, fabDate, productBrand, plantName].join('||');

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          lote,
          shift,
          fabDate,
          productBrand,
          plantName,
          records: []
        });
      }

      groups.get(key).records.push(record);
    });

    return Array.from(groups.values())
      .map((group) => {
        const sortedRecords = group.records.slice().sort(compareAnalysisSheetRecords);
        return Object.assign({}, group, {
          records: sortedRecords,
          firstCreatedAt: minNumber(sortedRecords, (record) => record.createdAt),
          lastFinalAt: maxNumber(sortedRecords, (record) => record.finalAt)
        });
      })
      .sort((a, b) => {
        const timeA = Number.isFinite(a.lastFinalAt) ? a.lastFinalAt : (Number.isFinite(a.firstCreatedAt) ? a.firstCreatedAt : 0);
        const timeB = Number.isFinite(b.lastFinalAt) ? b.lastFinalAt : (Number.isFinite(b.firstCreatedAt) ? b.firstCreatedAt : 0);
        if (timeA !== timeB) return timeA - timeB;
        return a.key.localeCompare(b.key, 'pt-BR');
      });
  }

  function buildAnalysisSheetData(report) {
    const sourceReport = report && typeof report === 'object' ? report : buildReportData();
    const store = loadStore();
    const analyses = [];
    let analysisNumber = 0;

    function appendAnalysisGroups(records, source) {
      const finalizedRecords = (records || [])
        .filter((record) => record && (record.finalGross != null || record.finalNet != null));

      groupAnalysisSheetRecords(finalizedRecords).forEach((group) => {
        const chunks = chunkItems(group.records, STANDARD_SAMPLE_COUNT);
        const partCount = chunks.length;

        chunks.forEach((chunkRecords, partIndex) => {
          analysisNumber += 1;
          analyses.push({
            key: `${source.id || 'active'}::${partCount > 1 ? `${group.key}::part-${partIndex + 1}` : group.key}`,
            sourceId: source.id || '',
            sourceType: source.type || 'active',
            archivedAt: source.archivedAt || null,
            analysisNumber,
            partNumber: partIndex + 1,
            partCount,
            lote: group.lote,
            shift: group.shift,
            fabDate: group.fabDate,
            productBrand: group.productBrand,
            plantName: group.plantName,
            records: chunkRecords,
            sampleCount: chunkRecords.length,
            firstCreatedAt: minNumber(chunkRecords, (record) => record.createdAt),
            lastFinalAt: maxNumber(chunkRecords, (record) => record.finalAt),
            isPartial: chunkRecords.length < STANDARD_SAMPLE_COUNT
          });
        });
      });
    }

    (store.archivedAnalyses || [])
      .slice()
      .sort((a, b) => Number(a.archivedAt || 0) - Number(b.archivedAt || 0))
      .forEach((archived) => {
        appendAnalysisGroups(archived.initialRecords, {
          id: archived.id,
          type: 'archived',
          archivedAt: archived.archivedAt
        });
      });

    appendAnalysisGroups(sourceReport.finalizedRecords || [], { id: 'active', type: 'active' });

    const sheets = [];
    if (!analyses.length) {
      sheets.push({
        sheetNumber: 1,
        status: 'open',
        analyses: [],
        availableSlots: ANALYSIS_SHEET_SLOT_COUNT
      });
    } else {
      for (let index = 0; index < analyses.length; index += ANALYSIS_SHEET_SLOT_COUNT) {
        const sheetNumber = sheets.length + 1;
        const analysisChunk = analyses
          .slice(index, index + ANALYSIS_SHEET_SLOT_COUNT)
          .map((analysis, slotIndex) => Object.assign({}, analysis, {
            sheetNumber,
            slotNumber: slotIndex + 1
          }));

        sheets.push({
          sheetNumber,
          status: analysisChunk.length === ANALYSIS_SHEET_SLOT_COUNT ? 'closed' : 'open',
          analyses: analysisChunk,
          availableSlots: ANALYSIS_SHEET_SLOT_COUNT - analysisChunk.length
        });
      }
    }

    const openSheet = sheets.find((sheet) => sheet.status === 'open');

    return {
      generatedAt: sourceReport.generatedAt || Date.now(),
      totalAnalyses: analyses.length,
      totalSheets: sheets.length,
      openSheetNumber: openSheet ? openSheet.sheetNumber : null,
      sheets
    };
  }

  function buildGroupSummary(records, selector, fallback) {
    const groups = new Map();

    records.forEach((record) => {
      const key = normalizeGroupKey(selector(record), fallback);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });

    return Array.from(groups.entries())
      .map(([key, items]) => {
        const finalized = items.filter((item) => item.finalNet != null || String(item.status).toLowerCase() === 'final');
        const flowDurations = items
          .map((item) => formatDurationMinutes(item.createdAt, item.finalAt))
          .filter((value) => Number.isFinite(value));

        return {
          key,
          records: items.length,
          finalized: finalized.length,
          pending: items.length - finalized.length,
          species: countUnique(items, (item) => normalizeGroupKey(item.species, '')),
          lots: countUnique(items, (item) => normalizeGroupKey(item.lote, '')),
          monitors: countUnique(items, (item) => normalizeGroupKey(item.monitor, '')),
          shifts: countUnique(items, (item) => normalizeShift(item.shift || item.turno)),
          totalGross: sumNumbers(items, (item) => item.gross),
          totalNetInitial: sumNumbers(items, (item) => item.net),
          totalFinalNet: sumNumbers(finalized, (item) => item.finalNet),
          totalLossAbs: sumNumbers(finalized, (item) => item.lossAbs),
          averageGross: averageNumbers(items, (item) => item.gross),
          averageNetInitial: averageNumbers(items, (item) => item.net),
          averageFinalNet: averageNumbers(finalized, (item) => item.finalNet),
          averageTimeMin: averageNumbers(items, (item) => item.timeMin),
          averageLossPct: averageNumbers(finalized, (item) => item.lossPct),
          averageFlowMinutes: flowDurations.length ? averageNumbers(flowDurations, (value) => value) : null,
          firstCreatedAt: minNumber(items, (item) => item.createdAt),
          lastCreatedAt: maxNumber(items, (item) => item.createdAt),
          lastFinalAt: maxNumber(finalized, (item) => item.finalAt)
        };
      })
      .sort((a, b) => b.records - a.records || a.key.localeCompare(b.key, 'pt-BR'));
  }

  function joinOrDash(values) {
    return Array.isArray(values) && values.length ? values.join(', ') : '-';
  }

  function buildLaudoConclusion(report) {
    if (!report.totals.initialRecords) {
      return 'Sem registros de pesagem para emissão de conclusão técnica.';
    }

    if (!report.totals.finalizedRecords) {
      return 'Laudo parcial: há pesagens iniciais registradas, mas ainda não existem pesagens finais para conclusão de perda/absorção.';
    }

    if (report.totals.pendingRecords > 0) {
      return 'Laudo parcial: existem pesagens finais registradas, mas ainda há amostras pendentes de finalização.';
    }

    return 'Laudo concluído: todas as amostras registradas possuem pesagem final e indicadores consolidados de perda/absorção.';
  }

  function buildReportText() {
    const report = buildReportData();
    const trace = report.laudo.traceability;
    const lines = [
      'DRIPTEST - LAUDO TÉCNICO DE ANÁLISE DE GOTEJAMENTO',
      'Gerado em: ' + formatDateTime(report.generatedAt),
      '',
      'Identificação do laudo',
      'Objetivo: ' + report.laudo.objective,
      'Método: ' + report.laudo.method,
      'Lote(s): ' + joinOrDash(trace.lots),
      'Marca(s) do produto: ' + joinOrDash(trace.brands),
      'Espécie(s): ' + joinOrDash(trace.species),
      'Setor(es) da análise: ' + joinOrDash(trace.plants),
      'Turno(s): ' + joinOrDash(trace.shifts),
      'Monitor(es): ' + joinOrDash(trace.monitors),
      'Data(s) de fabricação: ' + joinOrDash(trace.fabricationDates),
      '',
      'Rastreabilidade',
      'Versão do store: ' + report.metadata.storeVersion,
      'Atualizado em: ' + (report.metadata.updatedAt ? formatDateTime(report.metadata.updatedAt) : '-'),
      'Primeiro cadastro: ' + (report.metadata.firstCreatedAt ? formatDateTime(report.metadata.firstCreatedAt) : '-'),
      'Último cadastro: ' + (report.metadata.lastCreatedAt ? formatDateTime(report.metadata.lastCreatedAt) : '-'),
      'Última finalização: ' + (report.metadata.lastFinalAt ? formatDateTime(report.metadata.lastFinalAt) : '-'),
      '',
      'Resultados consolidados',
      'Registros iniciais: ' + report.totals.initialRecords,
      'Registros finalizados: ' + report.totals.finalizedRecords,
      'Registros pendentes: ' + report.totals.pendingRecords,
      'Testes de absorção: ' + report.totals.absorptionTests,
      'Lotes únicos: ' + report.totals.lots,
      'Monitores únicos: ' + report.totals.monitors,
      'Setores únicos: ' + report.totals.plants,
      'Turnos únicos: ' + report.totals.shifts,
      'Espécies únicas: ' + report.totals.species,
      'Marcas únicas: ' + report.totals.brands,
      'Tempo total pelo bruto: ' + report.totals.totalTimeMin + ' min',
      'Tempo médio por registro: ' + (report.totals.averageTimeMin == null ? '-' : report.totals.averageTimeMin + ' min'),
      'Tempo médio de fluxo real: ' + (report.totals.averageFlowMinutes == null ? '-' : report.totals.averageFlowMinutes + ' min'),
      'Peso bruto total: ' + report.totals.totalGross + ' g',
      'Peso líquido inicial total: ' + report.totals.totalNetInitial + ' g',
      'Peso líquido final total: ' + report.totals.totalFinalNet + ' g',
      'Absorção total: ' + report.totals.totalLossAbs + ' g',
      'Média de perda percentual final: ' + (report.totals.averageLossPct == null ? '-' : report.totals.averageLossPct + ' %'),
      'Absorção média em testes: ' + (report.totals.averageAbsorption == null ? '-' : report.totals.averageAbsorption + ' g'),
      'Absorção média percentual: ' + (report.totals.averageAbsorptionPercent == null ? '-' : report.totals.averageAbsorptionPercent + ' %'),
      'Registros interpolados: ' + report.totals.interpolatedRecords,
      'Registros sem tempo calculado: ' + report.totals.recordsWithoutTime,
      report.totals.marketWarnings ? ('Avisos de mercado (registros com absorção >= 8%): ' + report.totals.marketWarnings) : null,
      '',
      'Conclusão',
      buildLaudoConclusion(report),
      '',
      'Resumo por espécie'
    ];

    if (!report.groups.bySpecies.length) {
      lines.push('Nenhuma espécie registrada.');
    } else {
      report.groups.bySpecies.forEach((item, index) => {
        lines.push(
          (index + 1) + '. ' +
          item.key +
          '; registros ' + item.records +
          '; finalizados ' + item.finalized +
          '; pendentes ' + item.pending +
          '; bruto total ' + item.totalGross + ' g' +
          '; líquido inicial total ' + item.totalNetInitial + ' g' +
          '; líquido final total ' + item.totalFinalNet + ' g' +
          '; absorção total ' + item.totalLossAbs + ' g' +
          '; tempo médio ' + (item.averageTimeMin == null ? '-' : item.averageTimeMin + ' min')
        );
      });
    }

    lines.push('', 'Resumo por marca do produto');

    if (!report.groups.byBrand.length) {
      lines.push('Nenhuma marca registrada.');
    } else {
      report.groups.byBrand.forEach((item, index) => {
        lines.push(
          (index + 1) + '. ' +
          item.key +
          '; registros ' + item.records +
          '; finalizados ' + item.finalized +
          '; pendentes ' + item.pending +
          '; bruto total ' + item.totalGross + ' g' +
          '; líquido inicial total ' + item.totalNetInitial + ' g' +
          '; líquido final total ' + item.totalFinalNet + ' g' +
          '; absorção total ' + item.totalLossAbs + ' g'
        );
      });
    }

    lines.push('', 'Resumo por setor da análise');

    if (!report.groups.byPlant.length) {
      lines.push('Nenhum setor identificado.');
    } else {
      report.groups.byPlant.forEach((item, index) => {
        lines.push(
          (index + 1) + '. ' +
          item.key +
          '; registros ' + item.records +
          '; finalizados ' + item.finalized +
          '; pendentes ' + item.pending +
          '; bruto total ' + item.totalGross + ' g' +
          '; líquido inicial total ' + item.totalNetInitial + ' g' +
          '; absorção total ' + item.totalLossAbs + ' g'
        );
      });
    }

    lines.push('', 'Resumo por turno');

    if (!report.groups.byShift.length) {
      lines.push('Nenhum turno identificado.');
    } else {
      report.groups.byShift.forEach((item, index) => {
        lines.push(
          (index + 1) + '. ' +
          item.key +
          '; registros ' + item.records +
          '; finalizados ' + item.finalized +
          '; pendentes ' + item.pending +
          '; monitores ' + item.monitors +
          '; bruto total ' + item.totalGross + ' g'
        );
      });
    }

    lines.push('', 'Resumo por lote');

    if (!report.groups.byLot.length) {
      lines.push('Nenhum lote identificado.');
    } else {
      const lotSummaryMap = new Map((report.lotSummaries || []).map((item) => [item.key, item]));
      report.groups.byLot.forEach((item, index) => {
        const lotSummary = lotSummaryMap.get(item.key);
        const averageText = lotSummary ? (lotSummary.averageGrossAbsPctDisplay + ' %') : '-';
        const marketText = lotSummary && lotSummary.marketIndicator ? lotSummary.marketIndicator : '-';
        lines.push(
          (index + 1) + '. ' +
          item.key +
          '; registros ' + item.records +
          '; finalizados ' + item.finalized +
          '; monitores ' + item.monitors +
          '; bruto total ' + item.totalGross + ' g' +
          '; absorção total ' + item.totalLossAbs + ' g' +
          '; drip médio ' + averageText +
          '; sugestao ' + marketText
        );
      });
    }

    lines.push('', 'Últimas pesagens');

    if (!report.initialRecords.length) {
      lines.push('Nenhuma pesagem salva.');
    } else {
      report.initialRecords.slice(-15).reverse().forEach((record, index) => {
        const finalAtText = record.finalAt ? formatDateTime(record.finalAt) : '-';
        const totalFlowMin = formatDurationMinutes(record.createdAt, record.finalAt);
        lines.push(
          (index + 1) + '. ' +
          record.species +
          '; marca ' + normalizeProductBrand(record.productBrand, record.species) +
          '; lote ' + (record.lote || '-') +
          '; setor ' + (record.plantName || '-') +
          '; turno ' + (normalizeShift(record.shift || record.turno) || '-') +
          '; monitor(a) ' + (record.monitor || '-') +
          '; fabricação ' + (record.fabDate || '-') +
          '; bruto ' + record.gross + ' g' +
          '; embalagem inicial ' + (record.packGrams == null ? '-' : record.packGrams + ' g') +
          '; líquido inicial ' + record.net + ' g' +
          '; tempo previsto ' + (record.timeMin == null ? '-' : record.timeMin + ' min') +
          '; interpolado ' + (record.interpolated ? 'sim' : 'não') +
          '; bruto final ' + (record.finalGross == null ? '-' : record.finalGross + ' g') +
          '; embalagem final ' + (record.finalPackGrams == null ? '-' : record.finalPackGrams + ' g') +
          '; final ' + (record.finalNet == null ? '-' : record.finalNet + ' g') +
          '; absorção final ' + (record.lossAbs == null ? '-' : record.lossAbs + ' g') +
          '; absorção final % ' + (record.lossPct == null ? '-' : record.lossPct + ' %') +
          '; finalizado em ' + finalAtText +
          '; tempo total (cadastro->final) ' + (totalFlowMin === '-' ? '-' : totalFlowMin + ' min') +
          '; status ' + record.status +
          '; data ' + formatDateTime(record.createdAt)
        );
      });
    }

    lines.push('', 'Testes de absorção');

    if (!report.absorptionTests.length) {
      lines.push('Nenhum teste de absorção salvo.');
    } else {
      report.absorptionTests.slice(0, 12).forEach((test, index) => {
        lines.push(
          (index + 1) + '. ' +
          test.species +
          '; marca ' + normalizeProductBrand(test.productBrand, test.species) +
          '; lote ' + (test.lote || '-') +
          '; setor ' + (test.plantName || '-') +
          '; base ' + test.baseType +
          '; peso inicial ' + test.initialWeight +
          '; peso final ' + test.finalWeight +
          '; peso seco ' + (test.dryWeight == null ? '-' : test.dryWeight) +
          '; absorção ' + test.absorption +
          '; percentual ' + (test.absorptionPercent == null ? '-' : test.absorptionPercent + ' %') +
          '; nota ' + (test.note || '-') +
          '; data ' + formatDateTime(test.createdAt)
        );
      });
    }

    return lines.join('\n');
  }

  function buildWhatsappReportText() {
    const report = buildReportData();
    const trace = report.laudo.traceability;
    return [
      'DRIPTEST - LAUDO TÉCNICO',
      '',
      'Lote(s): ' + joinOrDash(trace.lots),
      'Setor: ' + joinOrDash(trace.plants),
      'Turno(s): ' + joinOrDash(trace.shifts),
      'Fabricação: ' + joinOrDash(trace.fabricationDates),
      'Monitor(es): ' + joinOrDash(trace.monitors),
      'Espécie(s): ' + joinOrDash(trace.species),
      'Marca(s): ' + joinOrDash(trace.brands),
      '',
      'Amostras: ' + report.totals.initialRecords,
      'Finalizadas: ' + report.totals.finalizedRecords,
      'Pendentes: ' + report.totals.pendingRecords,
      'Peso líquido inicial: ' + report.totals.totalNetInitial + ' g',
      'Peso líquido final: ' + report.totals.totalFinalNet + ' g',
      'Perda total: ' + report.totals.totalLossAbs + ' g',
      'Perda média: ' + (report.totals.averageLossPct == null ? '-' : report.totals.averageLossPct + ' %'),
      '',
      'Conclusão: ' + buildLaudoConclusion(report),
      '',
      'Emitido em: ' + formatDateTime(report.generatedAt)
    ].join('\n');
  }

  function csvEscape(value) {
    const text = String(value == null ? '' : value);
    if (/[;"\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function buildReportCsv() {
    const report = buildReportData();
    const rows = [[
      'tipo',
      'id',
      'especie',
      'marca_produto',
      'lote',
      'setor_analise',
      'monitor',
      'turno',
      'data_fabricacao',
      'peso_bruto_g',
      'peso_embalagem_inicial_kg',
      'peso_embalagem_inicial_g',
      'peso_liquido_inicial_g',
      'tempo_interpolado',
      'peso_liquido_final_g',
      'peso_bruto_final_g',
      'peso_embalagem_final_kg',
      'peso_embalagem_final_g',
      'tempo_min',
      'tempo_total_fluxo_min',
      'absorcao_final_g',
      'absorcao_g',
      'absorcao_percentual',
      'observacao',
      'status',
      'criado_em',
      'finalizado_em'
    ]];

    report.initialRecords.forEach((record) => {
      rows.push([
        'pesagem',
        record.id,
        record.species,
        normalizeProductBrand(record.productBrand, record.species),
        record.lote || '',
        record.plantName || '',
        record.monitor || '',
        normalizeShift(record.shift || record.turno),
        record.fabDate || '',
        record.gross,
        record.packKg == null ? '' : record.packKg,
        record.packGrams == null ? '' : record.packGrams,
        record.net,
        record.interpolated ? 'sim' : 'nao',
        record.finalNet == null ? '' : record.finalNet,
        record.finalGross == null ? '' : record.finalGross,
        record.finalPackKg == null ? '' : record.finalPackKg,
        record.finalPackGrams == null ? '' : record.finalPackGrams,
        record.timeMin == null ? '' : record.timeMin,
        record.finalAt ? formatDurationMinutes(record.createdAt, record.finalAt) : '',
        record.lossAbs == null ? '' : record.lossAbs,
        '',
        '',
        '',
        record.status,
        new Date(record.createdAt).toISOString(),
        record.finalAt ? new Date(record.finalAt).toISOString() : ''
      ]);
    });

    report.absorptionTests.forEach((test) => {
      rows.push([
        'absorcao',
        test.id,
        test.species,
        normalizeProductBrand(test.productBrand, test.species),
        test.lote || '',
        test.plantName || '',
        '',
        normalizeShift(test.shift || test.turno),
        '',
        '',
        '',
        '',
        test.initialWeight,
        '',
        test.finalWeight,
        '',
        '',
        '',
        '',
        '',
        '',
        test.absorption,
        test.absorptionPercent == null ? '' : test.absorptionPercent,
        test.note || '',
        `teste_absorcao:${test.baseType || 'initial'}`,
        new Date(test.createdAt).toISOString(),
        ''
      ]);
    });

    return rows.map((row) => row.map(csvEscape).join(';')).join('\n');
  }

  async function computeTextSha256(text) {
    try {
      const enc = new TextEncoder();
      const data = enc.encode(String(text));
      const hashBuffer = await (crypto.subtle || crypto.webkitSubtle).digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('Hash SHA-256 não disponível', e);
      return null;
    }
  }

  function buildReportJson() {
    const report = buildReportData();
    return JSON.stringify(report, null, 2);
  }

  async function buildReportPackageJson() {
    const report = buildReportData();
    const reportText = JSON.stringify(report);
    const hash = await computeTextSha256(reportText);
    const pkg = {
      metadata: {
        generatedAt: report.generatedAt,
        version: STORE_VERSION,
        app: 'DripTest',
        hashAlgorithm: 'SHA-256',
        hash: hash
      },
      report
    };
    return JSON.stringify(pkg, null, 2);
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ';' && !inQuotes) {
        row.push(value);
        value = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1;
        row.push(value);
        value = '';
        if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
        row = [];
        continue;
      }

      value += char;
    }

    row.push(value);
    if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
    return rows;
  }

  function normalizeHeader(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function parseNumber(value) {
    if (value == null || value === '') return null;
    const text = String(value).trim();
    let normalized = text;

    if (text.includes(',') && text.includes('.')) {
      normalized = text.replace(/\./g, '').replace(',', '.');
    } else if (text.includes(',')) {
      normalized = text.replace(',', '.');
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseDate(value) {
    if (!value) return Date.now();
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function importInitialRecordsFromCsv(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) {
      return { imported: 0, skipped: 0 };
    }

    const headers = rows[0].map(normalizeHeader);
    const dataRows = rows.slice(1);
    const store = loadStore();
    let imported = 0;
    let skipped = 0;

    dataRows.forEach((cells) => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = cells[index];
      });

      if (item.tipo && normalizeHeader(item.tipo) !== 'pesagem') {
        skipped += 1;
        return;
      }

      const species = item.especie || item.species;
      const productBrand = normalizeProductBrand(item.marca_produto || item.marca || item.product_brand || item.brand, species);
      const gross = parseNumber(item.peso_bruto_g || item.gross);
      const lote = item.lote || '';
      const monitor = item.monitor || item.monitora || '';
      const shift = normalizeShift(item.turno || item.shift || item.production_shift || item.equipe);
      const plantName = item.setor_analise || item.setor || item.plant_name || item.planta || '';
      const packKg = parseNumber(item.peso_embalagem_kg || item.packkg);
      const packGrams = parseNumber(item.peso_embalagem_g || item.packgrams);
      const net = parseNumber(item.peso_liquido_inicial_g || item.net);
      const finalNet = parseNumber(item.peso_liquido_final_g || item.finalnet);
      const timeMin = parseNumber(item.tempo_min || item.timemin);
      const finalAtRaw = item.finalizado_em || item.finalat;
      const finalAt = finalAtRaw ? parseDate(finalAtRaw) : undefined;

      if (!species || !Number.isFinite(gross) || gross <= 0) {
        skipped += 1;
        return;
      }

      const effectivePackKg = Number.isFinite(packKg) ? packKg : 0.006;
      const effectivePackGrams = Number.isFinite(packGrams) ? Math.round(packGrams) : Math.round(effectivePackKg * 1000);
      const computed = computeMinutesWithInterpolation(gross);

      store.initialRecords.push(normalizeInitialRecord({
        id: item.id || createId(),
        species,
        productBrand,
        lote,
        monitor,
        shift,
        turno: shift,
        plantName,
        fabDate: item.data_fabricacao || item.fabdate || '',
        gross,
        packKg: effectivePackKg,
        packGrams: effectivePackGrams,
        net: Number.isFinite(net) ? net : Math.max(0, gross - effectivePackGrams),
        timeMin: Number.isFinite(timeMin) ? timeMin : computed.minutes,
        status: finalNet != null ? 'final' : (item.status || 'Inicial'),
        finalNet: finalNet == null ? undefined : finalNet,
        createdAt: parseDate(item.criado_em || item.createdat),
        finalAt: finalNet == null ? undefined : finalAt
      }));
      imported += 1;
    });

    saveStore(store);
    return { imported, skipped };
  }

  function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  let nativeRequestSeq = 0;
  const nativeRequestMap = new Map();

  function hasAndroidBridge() {
    return Boolean(global.AndroidBridge);
  }

  function sanitizeDocumentName(value, fallback) {
    const text = String(value || '').trim();
    const normalized = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || fallback;
  }

  function buildNativeRequestId(prefix) {
    nativeRequestSeq += 1;
    return `${prefix}-${Date.now()}-${nativeRequestSeq}`;
  }

  function parseNativePayload(payload) {
    if (!payload) return null;
    if (typeof payload === 'object') return payload;
    try {
      return JSON.parse(payload);
    } catch (error) {
      console.warn('Resposta nativa invalida', error);
      return null;
    }
  }

  function settleNativeRequest(payload) {
    const message = parseNativePayload(payload);
    if (!message || !message.requestId) return null;
    const pending = nativeRequestMap.get(message.requestId);
    if (!pending) return message;
    nativeRequestMap.delete(message.requestId);
    if (message.ok === false) {
      pending.reject(new Error(message.error || 'Falha na operacao nativa.'));
      return message;
    }
    pending.resolve(message);
    return message;
  }

  global.__dripNativeComplete = function __dripNativeComplete(payload) {
    return settleNativeRequest(payload);
  };

  function requestAndroidBridge(method, payload, options) {
    if (!hasAndroidBridge() || typeof global.AndroidBridge[method] !== 'function') {
      return Promise.reject(new Error('Bridge Android indisponivel.'));
    }

    const requestId = buildNativeRequestId(method);
    const body = Object.assign({ requestId }, payload || {});
    const mode = options && options.expectAsync ? 'async' : 'sync';

    return new Promise((resolve, reject) => {
      if (mode === 'async') {
        nativeRequestMap.set(requestId, { resolve, reject });
      }

      try {
        const raw = global.AndroidBridge[method](JSON.stringify(body));
        const reply = parseNativePayload(raw);

        if (mode === 'sync') {
          if (reply && reply.ok === false) {
            reject(new Error(reply.error || 'Falha na operacao nativa.'));
            return;
          }
          resolve(reply || { ok: true, requestId });
          return;
        }

        if (reply && reply.ok === false) {
          nativeRequestMap.delete(requestId);
          reject(new Error(reply.error || 'Falha na operacao nativa.'));
        }
      } catch (error) {
        if (mode === 'async') {
          nativeRequestMap.delete(requestId);
        }
        reject(error);
      }
    });
  }

  function scheduleNativeReminder(record, options) {
    if (!record || !record.id) {
      return Promise.reject(new Error('Registro invalido para lembrete.'));
    }

    const timeMin = Number(record.timeMin);
    const createdAt = Number(record.createdAt || Date.now());
    if (!Number.isFinite(timeMin) || timeMin <= 0) {
      return Promise.reject(new Error('Este registro nao possui tempo valido para lembrete.'));
    }

    const triggerAt = createdAt + timeMin * 60000;
    const title = options && options.title ? options.title : 'Hora do gotejamento';
    const species = String(record.species || 'Amostra');
    const lote = String(record.lote || '-');
    const text = options && options.text
      ? options.text
      : `${species} | Lote ${lote} | Tempo ${timeMin} min`;

    return requestAndroidBridge('scheduleReminder', {
      reminderId: String(record.id),
      triggerAt,
      title,
      text
    });
  }

  function cancelNativeReminder(reminderId) {
    if (!reminderId) {
      return Promise.resolve({ ok: true });
    }
    return requestAndroidBridge('cancelReminder', {
      reminderId: String(reminderId)
    });
  }

  function saveHtmlAsPdf(filename, html, options) {
    const safeName = sanitizeDocumentName(filename, 'driptest-documento') + '.pdf';
    return requestAndroidBridge('savePdfFromHtml', {
      filename: safeName,
      html: String(html || ''),
      title: options && options.title ? options.title : safeName,
      share: Boolean(options && options.share),
      open: Boolean(options && options.open),
      text: options && options.text ? String(options.text) : '',
      landscape: Boolean(options && options.landscape)
    }, { expectAsync: true });
  }

  function saveReportAsPdf(filename, report, options) {
    const safeName = sanitizeDocumentName(filename, 'driptest-laudo') + '.pdf';
    return requestAndroidBridge('saveReportPdf', {
      filename: safeName,
      report: report || {},
      user: options && options.user ? options.user : {},
      reportNumber: options && options.reportNumber ? String(options.reportNumber) : '',
      hash: options && options.hash ? String(options.hash) : '',
      sourceLabel: options && options.sourceLabel ? String(options.sourceLabel) : '',
      issuedAt: options && options.issuedAt ? options.issuedAt : '',
      title: options && options.title ? String(options.title) : safeName,
      share: Boolean(options && options.share),
      open: Boolean(options && options.open),
      text: options && options.text ? String(options.text) : ''
    }, { expectAsync: true });
  }

  global.DripData = {
    LEGACY_KEY,
    STORE_KEY,
    STORE_VERSION,
    ANALYSIS_SHEET_SLOT_COUNT,
    getFinalWeight,
    calculateAbsorption,
    calculateAbsorptionPercent,
    calculateOfficialDripPercent,
    calculateGrossAbsorptionPercent,
    calculateRecordGrossAbsorptionPercent,
    classifyMarketByPercent,
    normalizeShift,
    computeMinutesWithInterpolation,
    createId,
    getInitialRecords,
    saveInitialRecords,
    clearInitialRecords,
    getAbsorptionTests,
    saveAbsorptionTest,
    clearAbsorptionTests,
    getArchivedAnalyses,
    archiveCurrentAnalysis,
    buildReportData,
    buildAnalysisSheetData,
    buildReportText,
    buildWhatsappReportText,
    buildReportCsv,
    buildReportJson,
    buildReportPackageJson,
    computeTextSha256,
    formatPreciseNumber,
    importInitialRecordsFromCsv,
    downloadTextFile,
    hasAndroidBridge,
    scheduleNativeReminder,
    cancelNativeReminder,
    saveHtmlAsPdf,
    saveReportAsPdf,
    sanitizeDocumentName
  };
})(window);
