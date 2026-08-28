/**
 * ============================================================
 * ALMOXA PRO — Test_Modulo04_Inventario.gs
 * Cobre a seção 9 do contrato, focando no que é NOVO (o núcleo
 * de criar/abrir/bipar/contar/recontar/finalizar/aprovar já
 * tinha teste próprio em Test_Fase6_Inventario.gs — não duplico).
 * ============================================================
 */

function Test_Modulo04_Inventario_fluxoCompleto() {
  Core_API.bootstrap();
  const resultados = {};

  const admin = Core_API.call({ action: 'auth.login', payload: { identificacao: 'admin', senha: 'almoxa123' } });
  const sessionAdmin = admin.data.sessionId;

  const operadorAutorizado = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Contador Autorizado M4', matricula: 'M4-OK-' + Date.now(), senha: '1234' } });
  const operadorNaoAutorizado = Core_API.call({ action: 'loja.cadastro', payload: { nome: 'Sem Autorização M4', matricula: 'M4-NOK-' + Date.now(), senha: '1234' } });
  const sessionOk = operadorAutorizado.data.sessionId;
  const sessionNok = operadorNaoAutorizado.data.sessionId;

  const produto = Core_API.call({ action: 'produto.create', sessionId: sessionAdmin, payload: { descricaoOriginal: 'Item Inventário M4', codigo: 'M4-INV' } });
  const local = 'TESTE-M4/INVENTARIO';
  Core_API.call({ action: 'estoque.entry', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: local, quantidade: 50 } });

  const criar = Core_API.call({
    action: 'inventario.create', sessionId: sessionAdmin,
    payload: { localizacao: local, equipeAutorizada: [operadorAutorizado.data.userId] }
  });
  resultados.criaInventario = criar.success;
  const idInventario = criar.data.ID;

  const conflito = Core_API.call({ action: 'inventario.create', sessionId: sessionAdmin, payload: { localizacao: local } });
  resultados.impedeConflitoDeEscopo = !conflito.success;

  const abrir = Core_API.call({ action: 'inventario.open', sessionId: sessionAdmin, payload: { id: idInventario } });
  resultados.abreInventario = abrir.success && abrir.data.contagens.length === 1;

  const contarNegado = Core_API.call({
    action: 'inventario.count', sessionId: sessionNok,
    payload: { inventarioId: idInventario, produtoId: produto.data.ID, quantidadeContada: 45 }
  });
  resultados.bloqueiaContadorNaoAutorizado = !contarNegado.success && contarNegado.code === CORE_CONSTANTS.RESPONSE_CODES.PERMISSION_DENIED;

  const contarOk = Core_API.call({
    action: 'inventario.count', sessionId: sessionOk,
    payload: { inventarioId: idInventario, produtoId: produto.data.ID, quantidadeContada: 45, dispositivo: 'celular-teste' }
  });
  resultados.contadorAutorizadoConta = contarOk.success && String(contarOk.data.operador) === String(operadorAutorizado.data.userId);

  const finalizar = Core_API.call({ action: 'inventario.finish', sessionId: sessionAdmin, payload: { id: idInventario } });
  resultados.finalizarDetectaDivergencia = finalizar.success && finalizar.data.divergentes.length === 1 && finalizar.data.divergenciasRegistradas.length === 1;

  const divergenciaId = finalizar.data.divergenciasRegistradas[0].ID;
  const justificar = Core_API.call({ action: 'inventario.justificarDivergencia', sessionId: sessionAdmin, payload: { divergenciaId, motivo: 'Consumo não lançado' } });
  resultados.justificaDivergencia = justificar.success && justificar.data.motivo === 'Consumo não lançado';

  const aprovar = Core_API.call({ action: 'inventario.approve', sessionId: sessionAdmin, payload: { id: idInventario, decisao: 'aprovar' } });
  const saldoFinal = Core_API.call({ action: 'estoque.get', sessionId: sessionAdmin, payload: { produtoId: produto.data.ID, localizacao: local } });
  resultados.aprovarAjustaEstoqueReal = aprovar.success && saldoFinal.success && saldoFinal.data.saldo === 45;

  const tentarContarDepoisDeFechado = Core_API.call({
    action: 'inventario.count', sessionId: sessionOk,
    payload: { inventarioId: idInventario, produtoId: produto.data.ID, quantidadeContada: 999 }
  });
  resultados.bloqueiaAlteracaoAposFechamento = !tentarContarDepoisDeFechado.success;

  const relatorio = Core_API.call({ action: 'inventario.relatorio', sessionId: sessionAdmin, payload: { id: idInventario } });
  resultados.relatorioReproduzDadosFinais = relatorio.success && relatorio.data.itens[0].contado === 45 && relatorio.data.itens[0].esperado === 50;

  const listaOperador = Core_API.call({ action: 'inventario.listar', sessionId: sessionOk, payload: {} });
  const listaOutroOperador = Core_API.call({ action: 'inventario.listar', sessionId: sessionNok, payload: {} });
  resultados.escopoDeListagemFunciona = listaOperador.success && listaOperador.data.some(i => i.ID === idInventario) &&
    listaOutroOperador.success && !listaOutroOperador.data.some(i => i.ID === idInventario);

  const futuroDataLiberacao = new Date(Date.now() + 3600 * 1000).toISOString();
  const criarComLiberacao = Core_API.call({
    action: 'inventario.create', sessionId: sessionAdmin,
    payload: { localizacao: 'TESTE-M4/LIBERACAO', dataLiberacao: futuroDataLiberacao }
  });
  const liberarAntesDaHora = Core_API.call({ action: 'inventario.liberar', sessionId: sessionAdmin, payload: { id: criarComLiberacao.data.ID } });
  resultados.bloqueiaLiberacaoAntesDaHora = !liberarAntesDaHora.success;

  const abrirSemLiberar = Core_API.call({ action: 'inventario.open', sessionId: sessionAdmin, payload: { id: criarComLiberacao.data.ID } });
  resultados.bloqueiaAbrirSemLiberarQuandoExigido = !abrirSemLiberar.success;

  const passou = Object.values(resultados).every(Boolean);

  Logger.log('=== RESULTADOS MÓDULO 04 (Inventário) ===');
  Logger.log(JSON.stringify(resultados, null, 2));
  Logger.log('=== ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Módulo 04 (Inventário): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — veja o Logger.'));

  return resultados;
}
