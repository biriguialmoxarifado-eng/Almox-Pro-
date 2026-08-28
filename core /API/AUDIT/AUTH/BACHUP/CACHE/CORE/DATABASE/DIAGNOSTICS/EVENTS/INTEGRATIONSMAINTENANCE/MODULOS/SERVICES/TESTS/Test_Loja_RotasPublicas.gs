/**
 * ============================================================
 * ALMOXA PRO — Test_Loja_RotasPublicas.gs
 * Confere que loja.config/categorias/catalogo funcionam SEM
 * sessão (sessionId ausente) — é o requisito central da Fase 2
 * do Front Mobile (lojinha navegável antes do login).
 * ============================================================
 */

function Test_Loja_fluxoCompleto() {
  Core_API.bootstrap();

  // Produto de teste com categoria, pra provar que a lista de
  // categorias vem do cadastro real (nunca inventada).
  const loginAdmin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionId = loginAdmin.data.sessionId;
  Core_API.call({
    action: 'produto.create', sessionId,
    payload: { descricaoOriginal: 'Capacete de segurança', codigo: 'CAP-01', categoria: 'EPI' }
  });

  // ---- A partir daqui, SEM sessionId — simula visitante da loja ----
  const config = Core_API.call({ action: 'loja.config', payload: {} });
  Logger.log('LOJA CONFIG (sem sessão): ' + JSON.stringify(config));

  const categorias = Core_API.call({ action: 'loja.categorias', payload: {} });
  Logger.log('CATEGORIAS (sem sessão): ' + JSON.stringify(categorias));

  const catalogo = Core_API.call({ action: 'loja.catalogo', payload: { categoria: 'EPI' } });
  Logger.log('CATÁLOGO EPI (sem sessão): ' + JSON.stringify(catalogo));

  // ---- FASE 2 (revisão): revalidação de carrinho ----
  const produtoId = catalogo.data[0].produtoId;
  Core_API.call({ action: 'estoque.entry', sessionId, payload: { produtoId, localizacao: 'TESTE/LOJA', quantidade: 3 } });

  const validacaoOk = Core_API.call({ action: 'loja.validarCarrinho', payload: { itens: [{ produtoId, quantidade: 2 }] } });
  Logger.log('VALIDAÇÃO OK (pediu 2, tem 3): ' + JSON.stringify(validacaoOk));

  const validacaoFalha = Core_API.call({ action: 'loja.validarCarrinho', payload: { itens: [{ produtoId, quantidade: 999 }] } });
  Logger.log('VALIDAÇÃO DEVE FALHAR (pediu 999, tem 3): ' + JSON.stringify(validacaoFalha));

  // Rota comum (não-pública) continua exigindo sessão normalmente
  const estoqueSemSessao = Core_API.call({ action: 'estoque.get', payload: { id: 1 } });
  Logger.log('ESTOQUE SEM SESSÃO (deve continuar bloqueado): ' + JSON.stringify(estoqueSemSessao));

  const passou =
    config.success && !!config.data.welcomeTitle &&
    categorias.success && categorias.data.some(c => c.categoria === 'EPI') &&
    catalogo.success && catalogo.data.some(p => p.codigo === 'CAP-01') &&
    validacaoOk.success && validacaoOk.data.todosValidos === true &&
    validacaoFalha.success && validacaoFalha.data.todosValidos === false &&
    !estoqueSemSessao.success && estoqueSemSessao.code === CORE_CONSTANTS.RESPONSE_CODES.SESSION_EXPIRED;

  Logger.log('=== RESULTADO LOJA (rotas públicas): ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Loja (rotas públicas): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌'));
  return { config, categorias, catalogo, validacaoOk, validacaoFalha, estoqueSemSessao, passou };
}
