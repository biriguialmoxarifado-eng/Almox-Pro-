/**
 * ============================================================
 * ALMOXA PRO — Service_IA.gs
 * FASE 12 — IMPLEMENTADO DE VERDADE.
 *
 * TRANSPARÊNCIA IMPORTANTE (seção 57 permite estas funções, mas
 * a spec proíbe declarar integração/capacidade que não seja
 * real — seção 70): isto NÃO é machine learning, rede neural,
 * nem modelo preditivo treinado. São REGRAS ESTATÍSTICAS
 * simples e auditáveis (média, desvio padrão, projeção linear)
 * — funcionam de verdade, com dado real, mas são "IA" no sentido
 * de "assistência inteligente baseada em regra", não no sentido
 * de aprendizado de máquina. Documentando isso pra não vender
 * mais do que existe.
 *
 * "IA não poderá alterar dados críticos sem controle" (seção 57)
 * — por isso as três funções aqui só GERAM SUGESTÃO, nunca
 * gravam nada sozinhas (nenhuma chama DB_Insert/DB_Update).
 * ============================================================
 */

const Service_IA = (function () {

  function _media(arr) { return arr.length ? Utils_Array.sum(arr, x => x) / arr.length : 0; }
  function _desvioPadrao(arr, media) {
    if (arr.length < 2) return 0;
    const variancia = Utils_Array.sum(arr, x => Math.pow(x - media, 2)) / (arr.length - 1);
    return Math.sqrt(variancia);
  }

  // ---- Sugestão de compra: baseada em estoque mínimo (regra transparente) ----
  function sugerirCompra(ctx) {
    const criticos = DB_Query.find('ESTOQUE', r => Number(r.estoqueMinimo) > 0 && Number(r.saldo) <= Number(r.estoqueMinimo));

    const sugestoes = criticos.map(item => {
      const produto = DB_Query.get('PRODUTOS', item.produtoId);
      // Regra simples e auditável: repor até o dobro do mínimo,
      // descontando o que já está reservado (não conta duas vezes).
      const alvo = Number(item.estoqueMinimo) * 2;
      const quantidadeSugerida = Math.max(0, alvo - Number(item.saldo) - Number(item.reservado || 0));
      return {
        produtoId: item.produtoId,
        produtoDescricao: produto ? produto.descricaoOriginal : '',
        localizacao: item.localizacao,
        saldoAtual: item.saldo,
        estoqueMinimo: item.estoqueMinimo,
        quantidadeSugerida,
        regra: 'Repor até 2x o estoque mínimo, descontando reservas.'
      };
    }).filter(s => s.quantidadeSugerida > 0);

    return Core_Response.ok({
      totalSugestoes: sugestoes.length,
      sugestoes,
      metodologia: 'Regra determinística sobre estoque mínimo — não é previsão de demanda por machine learning.'
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- Detecção de anomalias: desvio estatístico (z-score) sobre MOVIMENTOS ----
  function detectarAnomalias(ctx) {
    const janelaDias = (ctx.payload && ctx.payload.janelaDias) || 90;
    const limite = new Date(Date.now() - janelaDias * 24 * 3600 * 1000);

    const movimentos = DB_Query.find('MOVIMENTOS', m => new Date(m.data) >= limite && ['ENTRADA', 'SAIDA'].includes(m.tipo));
    const porProduto = Utils_Array.groupBy(movimentos, m => m.produtoId + '_' + m.tipo);

    const anomalias = [];
    Object.keys(porProduto).forEach(chave => {
      const grupo = porProduto[chave];
      if (grupo.length < 4) return; // amostra pequena demais pra ter desvio confiável

      const quantidades = grupo.map(m => Number(m.quantidade) || 0);
      const media = _media(quantidades);
      const desvio = _desvioPadrao(quantidades, media);
      if (desvio === 0) return;

      grupo.forEach(m => {
        const zScore = (Number(m.quantidade) - media) / desvio;
        if (Math.abs(zScore) >= 2) { // 2 desvios padrão = fora do padrão usual
          const produto = DB_Query.get('PRODUTOS', m.produtoId);
          anomalias.push({
            movimentoId: m.ID, produtoId: m.produtoId,
            produtoDescricao: produto ? produto.descricaoOriginal : '',
            tipo: m.tipo, quantidade: m.quantidade, mediaHistorica: Utils_Currency.round2(media),
            desvioPadrao: Utils_Currency.round2(desvio), zScore: Utils_Currency.round2(zScore),
            data: m.data
          });
        }
      });
    });

    return Core_Response.ok({
      totalAnalisado: movimentos.length, totalAnomalias: anomalias.length, anomalias,
      metodologia: 'Desvio estatístico (z-score ≥ 2) sobre o histórico de movimentações — não é detecção por modelo treinado.'
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  // ---- Análise de consumo: projeção linear simples ----
  function analisarConsumo(ctx) {
    const { produtoId, periodoDias } = ctx.payload || {};
    if (!produtoId) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'produtoId é obrigatório.', {}, ctx.requestId);

    const dias = periodoDias || 30;
    const limite = new Date(Date.now() - dias * 24 * 3600 * 1000);
    const saidas = DB_Query.find('MOVIMENTOS', m => String(m.produtoId) === String(produtoId) && m.tipo === 'SAIDA' && new Date(m.data) >= limite);

    const totalConsumido = Utils_Array.sum(saidas, m => m.quantidade);
    const consumoDiarioMedio = totalConsumido / dias;

    const saldos = DB_Query.find('ESTOQUE', r => String(r.produtoId) === String(produtoId));
    const saldoTotal = Utils_Array.sum(saldos, r => r.saldo);
    const diasRestantes = consumoDiarioMedio > 0 ? Math.floor(saldoTotal / consumoDiarioMedio) : null;

    return Core_Response.ok({
      produtoId, periodoAnalisadoDias: dias,
      totalConsumido, consumoDiarioMedio: Utils_Currency.round2(consumoDiarioMedio),
      saldoAtualTotal: saldoTotal,
      diasRestantesNoRitmoAtual: diasRestantes,
      metodologia: 'Média móvel simples do período — projeção linear, não considera sazonalidade.'
    }, '', 'SUCCESS', {}, ctx.requestId);
  }

  return { sugerirCompra, detectarAnomalias, analisarConsumo };
})();
