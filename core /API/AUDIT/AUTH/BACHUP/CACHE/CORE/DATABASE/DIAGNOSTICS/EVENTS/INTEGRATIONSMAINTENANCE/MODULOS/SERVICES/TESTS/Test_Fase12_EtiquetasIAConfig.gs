/**
 * ============================================================
 * ALMOXA PRO — Test_Fase12_EtiquetasIAConfig.gs
 * Fluxo: gera etiqueta de produto e imprime (PDF real) → cria
 * cenário de estoque crítico e testa ia.sugerirCompra → cria
 * movimentos com um valor fora do padrão e testa
 * ia.detectarAnomalias → testa ia.analisarConsumo → lê e
 * atualiza uma configuração.
 * ============================================================
 */

function Test_Fase12_fluxoCompleto() {
  Core_API.bootstrap();

  const login = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  if (!login.success) { Logger.log('LOGIN FALHOU'); return login; }
  const sessionId = login.data.sessionId;

  // ---- Etiqueta ----
  const produto = Core_API.call({ action: 'produto.create', sessionId, payload: { descricaoOriginal: 'Prego 18x27', codigo: 'PREGO-1827', codigoBarras: '7890001112223' } });
  const produtoId = produto.data.ID;

  const etiqueta = Core_API.call({ action: 'etiqueta.generate', sessionId, payload: { tipo: 'PRODUTO', referenciaId: produtoId } });
  Logger.log('ETIQUETA GERADA: ' + JSON.stringify(etiqueta));

  const impressao = Core_API.call({ action: 'etiqueta.print', sessionId, payload: { id: etiqueta.data.ID } });
  Logger.log('ETIQUETA IMPRESSA: ' + JSON.stringify(impressao));

  // ---- IA: sugestão de compra ----
  const localizacao = 'OBRA-TESTE/DEPOSITO-PREGOS';
  Core_API.call({ action: 'estoque.entry', sessionId, payload: { produtoId, localizacao, quantidade: 5 } });
  Core_API.call({ action: 'estoque.setMinimo', sessionId, payload: { produtoId, localizacao, estoqueMinimo: 20 } });

  const sugestao = Core_API.call({ action: 'ia.sugerirCompra', sessionId, payload: {} });
  Logger.log('IA SUGESTÃO DE COMPRA: ' + JSON.stringify(sugestao));

  // ---- IA: anomalia (gera movimentos normais + 1 fora do padrão) ----
  const localAnomalia = 'OBRA-TESTE/DEPOSITO-ANOMALIA';
  for (let i = 0; i < 5; i++) {
    Core_API.call({ action: 'estoque.entry', sessionId, payload: { produtoId, localizacao: localAnomalia, quantidade: 10 } });
  }
  Core_API.call({ action: 'estoque.entry', sessionId, payload: { produtoId, localizacao: localAnomalia, quantidade: 500 } }); // fora do padrão de propósito

  const anomalias = Core_API.call({ action: 'ia.detectarAnomalias', sessionId, payload: { janelaDias: 1 } });
  Logger.log('IA ANOMALIAS: ' + JSON.stringify(anomalias));

  // ---- IA: análise de consumo ----
  Core_API.call({ action: 'estoque.exit', sessionId, payload: { produtoId, localizacao: localAnomalia, quantidade: 30, motivo: 'Consumo teste' } });
  const consumo = Core_API.call({ action: 'ia.analisarConsumo', sessionId, payload: { produtoId, periodoDias: 30 } });
  Logger.log('IA ANÁLISE DE CONSUMO: ' + JSON.stringify(consumo));

  // ---- Configurações ----
  const configAntes = Core_API.call({ action: 'config.get', sessionId, payload: { chave: 'RESERVATION_DEFAULT_HOURS' } });
  Logger.log('CONFIG ANTES: ' + JSON.stringify(configAntes));

  const configUpdate = Core_API.call({ action: 'config.update', sessionId, payload: { chave: 'RESERVATION_DEFAULT_HOURS', valor: 72 } });
  Logger.log('CONFIG ATUALIZADA: ' + JSON.stringify(configUpdate));

  const passou =
    etiqueta.success && etiqueta.data.conteudoQR === 'PRODUTO:' + produtoId &&
    impressao.success &&
    sugestao.success && sugestao.data.sugestoes.some(s => String(s.produtoId) === String(produtoId)) &&
    anomalias.success && anomalias.data.totalAnomalias >= 1 &&
    consumo.success && consumo.data.totalConsumido === 30 &&
    configUpdate.success && configUpdate.data.valor === 72;

  Logger.log('=== RESULTADO FASE 12: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Fase 12 (Etiquetas/IA/Configurações): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' — log completo em Ver → Registros de execução.');
  return { login, etiqueta, impressao, sugestao, anomalias, consumo, configAntes, configUpdate, passou };
}
