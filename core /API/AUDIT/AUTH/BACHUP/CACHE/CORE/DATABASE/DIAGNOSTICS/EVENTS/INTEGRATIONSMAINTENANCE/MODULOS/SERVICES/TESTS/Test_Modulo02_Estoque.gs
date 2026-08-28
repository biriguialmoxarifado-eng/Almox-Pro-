/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo02_Estoque.gs
 *
 * Foca no que é NOVO no Módulo 02 (classificação verde/amarelo/
 * vermelho, consumo médio diário, gatilho de pré-compra). As
 * funções que já existiam (entrada, saída, transferência,
 * ajuste, busca textual, escopo por perfil, estoque mínimo,
 * reserva/liberação, histórico) já têm cobertura própria em
 * Test_Fase4_Estoque.gs, Test_Estoque_Buscar.gs e
 * Test_Reserva_Seguranca.gs — não duplico aqui.
 * ============================================================
 */

function Test_Modulo02_Estoque_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;
  const ctx = Core_Context.build({ action: 'teste', userId: admin.data.userId, sessionId: sessionAdmin, perfil: 'ADMIN' });

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Classificação M2', codigo: 'M2-CLASS' } });
  const produtoId = produto.data.ID;
  const local = 'TESTE-M2/CLASSIFICACAO';

  // ---- 1) Sem mínimo configurado → NAO_CONFIGURADO ----
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId, localizacao: local, quantidade: 100 } });
  const semMinimo = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId, localizacao: local } });
  resultados.semMinimoNaoConfigurado = semMinimo.success && semMinimo.data.classificacao === 'NAO_CONFIGURADO';

  // ---- 2) Mínimo baixo, saldo alto → VERDE ----
  Core_API.call({ action: 'estoque.setMinimo', sessionId: sessionAdmin, payload: { produtoId, localizacao: local, estoqueMinimo: 10 } });
  const verde = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId, localizacao: local } });
  resultados.saldoAltoEhVerde = verde.success && verde.data.classificacao === 'VERDE';

  // ---- 3) Saldo baixado pra faixa amarela (mínimo=10, fator padrão 1.5 → amarelo até 15) ----
  Core_API.call({ action: 'estoque.exit', sessionId: sessionAdmin, payload: { produtoId, localizacao: local, quantidade: 87 } }); // sobra 13
  const amarelo = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId, localizacao: local } });
  resultados.saldoNaFaixaEhAmarelo = amarelo.success && amarelo.data.classificacao === 'AMARELO' && amarelo.data.disponivel === 13;

  // ---- 4) Saldo abaixo do mínimo → VERMELHO ----
  Core_API.call({ action: 'estoque.exit', sessionId: sessionAdmin, payload: { produtoId, localizacao: local, quantidade: 5 } }); // sobra 8, abaixo do mínimo 10
  const vermelho = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId, localizacao: local } });
  resultados.saldoAbaixoMinimoEhVermelho = vermelho.success && vermelho.data.classificacao === 'VERMELHO';

  // ---- 5) Consumo médio: histórico insuficiente ainda (só 2 saídas até aqui) ----
  resultados.historicoInsuficienteAntes = amarelo.data.historicoSuficiente === false;

  // Registra mais saídas pequenas pra completar o mínimo de eventos (padrão: 3)
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId, localizacao: local, quantidade: 50 } });
  Core_API.call({ action: 'estoque.exit', sessionId: sessionAdmin, payload: { produtoId, localizacao: local, quantidade: 1 } });
  const comHistorico = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId, localizacao: local } });
  resultados.historicoSuficienteDepois = comHistorico.success && comHistorico.data.historicoSuficiente === true && comHistorico.data.consumoMedioDiario > 0;
  resultados.diasCoberturaCalculado = comHistorico.data.diasCobertura !== null;

  // ---- 6) Gatilho de pré-compra emite evento pra quem está AMARELO, sem criar compra ----
  let eventoRecebido = null;
  Event_Bus.on(EVENT_TYPES.ESTOQUE_AMARELO_IDENTIFICADO, function (payload) {
    if (String(payload.produtoId) === String(produtoId) && payload.localizacao === local) eventoRecebido = payload;
  });
  Core_API.call({ action: 'estoque.setMinimo', sessionId: sessionAdmin, payload: { produtoId, localizacao: local, estoqueMinimo: 10 } });
  const gatilho = Service_Estoque.verificarNiveis(ctx);
  resultados.gatilhoRodou = gatilho.totalVerificados >= 1;
  resultados.gatilhoEmitiuEventoParaItemAmarelo = !!eventoRecebido;

  // ---- 7) Erro de produto/localização inexistente ----
  const inexistente = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId: 999999, localizacao: 'NAO-EXISTE' } });
  resultados.erroProdutoInexistente = !inexistente.success && inexistente.code === CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULO 02 (Estoque) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulo 02 (Estoque): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
