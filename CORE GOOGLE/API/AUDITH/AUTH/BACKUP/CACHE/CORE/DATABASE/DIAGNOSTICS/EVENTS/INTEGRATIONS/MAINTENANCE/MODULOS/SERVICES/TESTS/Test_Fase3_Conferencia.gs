/**
 * ============================================================
 * ALMOXA PRO — Test_Fase3_Conferencia.gs
 * Fluxo: login → produto+NF de teste (reaproveita padrão da
 * Fase 2) → inicia conferência → bipa 1 item completo, deixa o
 * outro faltando → finaliza → confere se gerou divergência de
 * FALTA → aprova a divergência.
 * ============================================================
 */

function Test_Fase3_fluxoCompleto() {
  Core_API.bootstrap();

  const login = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  if (!login.success) { Logger.log('LOGIN FALHOU: ' + JSON.stringify(login)); return login; }
  const sessionId = login.data.sessionId;

  const produto = Core_API.call({
    action: 'produto.create', sessionId,
    payload: { descricaoOriginal: 'Vergalhão CA-50 10mm', codigo: 'VERG-10', codigoBarras: '7891234500010' }
  });

  const nf = Core_API.call({
    action: 'nf.create', sessionId,
    payload: {
      fornecedor: { cnpj: '98765432000188', razaoSocial: 'Aços Teste LTDA' },
      nota: { numero: '000456', dataEmissao: '2026-08-21', valorTotal: 500.00 },
      itens: [{ descricao: 'Vergalhão CA-50 10mm', codigo: 'VERG-10', codigoBarras: '7891234500010', quantidade: 10, valorUnitario: 50.00 }]
    }
  });
  Logger.log('NF: ' + JSON.stringify(nf));
  if (!nf.success) return { login, produto, nf };
  const notaId = nf.data.nota.ID;

  const start = Core_API.call({ action: 'conferencia.start', sessionId, payload: { notaId } });
  Logger.log('START: ' + JSON.stringify(start));

  // Bipa só 7 das 10 esperadas (pra forçar FALTA)
  let scanResult;
  for (let i = 0; i < 7; i++) {
    scanResult = Core_API.call({ action: 'conferencia.scan', sessionId, payload: { notaId, codigo: '7891234500010' } });
    Utilities.sleep(2100); // passa do debounce de 2s pra cada bip contar
  }
  Logger.log('ÚLTIMO SCAN: ' + JSON.stringify(scanResult));

  const finish = Core_API.call({ action: 'conferencia.finish', sessionId, payload: { notaId } });
  Logger.log('FINISH: ' + JSON.stringify(finish));

  const divergencias = Core_API.call({ action: 'conferencia.divergence', sessionId, payload: { notaId } });
  Logger.log('DIVERGÊNCIAS: ' + JSON.stringify(divergencias));

  let aprovacao = null;
  if (divergencias.success && divergencias.data.length) {
    aprovacao = Core_API.call({
      action: 'conferencia.divergence', sessionId,
      payload: { resolver: 'aprovar', divergenciaId: divergencias.data[0].ID, motivo: 'Fornecedor confirmou envio parcial.' }
    });
    Logger.log('APROVAÇÃO DIVERGÊNCIA: ' + JSON.stringify(aprovacao));
  }

  const passou = finish.success
    && finish.data.notaStatus === 'DIVERGENTE'
    && finish.data.divergencias.length === 1
    && finish.data.divergencias[0].tipo === 'FALTA'
    && aprovacao && aprovacao.success && aprovacao.data.status === 'APROVADA';

  Logger.log('=== RESULTADO FASE 3: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Fase 3 (Conferência): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' — log completo em Ver → Registros de execução.');
  return { login, produto, nf, start, finish, divergencias, aprovacao, passou };
}
