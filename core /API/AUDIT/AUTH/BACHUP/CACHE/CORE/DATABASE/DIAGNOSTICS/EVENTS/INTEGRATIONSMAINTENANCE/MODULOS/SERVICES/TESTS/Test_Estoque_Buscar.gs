/**
 * ============================================================
 * ALMOXA PRO — Test_Estoque_Buscar.gs
 * FASE 6 DO FRONT MOBILE — confirma que o detalhe por
 * localização (reservado/bloqueado/mínimo) só vai pra quem
 * gerencia estoque, mesmo a rota sendo VIEW pra todo mundo.
 * ============================================================
 */

function Test_Estoque_Buscar_fluxoCompleto() {
  Core_API.bootstrap();

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item busca teste', codigo: 'BUSCA-01' } });
  const produtoId = produto.data.ID;
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId, localizacao: 'TESTE/BUSCA', quantidade: 5 } });

  const operador = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Busca Operador', matricula: 'BUSCA-OP-' + Date.now(), senha: '1234' } });
  const sessionOp = operador.data.sessionId;

  const buscaAdmin = Core_API.call({ action: 'estoque.buscar', sessionId: sessionAdmin, payload: { busca: 'busca teste' } });
  Logger.log('BUSCA COMO ADMIN (deve ter localizacoes): ' + JSON.stringify(buscaAdmin));

  const buscaOperador = Core_API.call({ action: 'estoque.buscar', sessionId: sessionOp, payload: { busca: 'busca teste' } });
  Logger.log('BUSCA COMO OPERADOR (não deve ter localizacoes): ' + JSON.stringify(buscaOperador));

  const passou =
    buscaAdmin.success && buscaAdmin.data.length === 1 && Array.isArray(buscaAdmin.data[0].localizacoes) &&
    buscaOperador.success && buscaOperador.data.length === 1 && buscaOperador.data[0].localizacoes === undefined &&
    buscaOperador.data[0].totalDisponivel === 5;

  Logger.log('=== RESULTADO ESCOPO ESTOQUE: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Escopo Estoque (Fase 6 Front): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌'));
  return { buscaAdmin, buscaOperador, passou };
}
