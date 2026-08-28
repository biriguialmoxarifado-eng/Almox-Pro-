/**
 * ============================================================
 * ALMOXA PRO — Maintenance_Sandbox.gs   (/MAINTENANCE — NOVO)
 * Onde você cola suas próprias ideias para testar. Já vem com
 * 2 experimentos de exemplo mostrando o padrão a seguir:
 * um que só LÊ (seguro, sempre pode rodar em produção) e um
 * que simula ESCRITA (respeita o dryRun manualmente).
 *
 * COMO ADICIONAR UMA IDEIA NOVA:
 *
 *   Maintenance_Core.registerExperiment(
 *     'meu_experimento_01',
 *     'Nome curto',
 *     'O que esse experimento está tentando validar',
 *     function (context) {
 *       // sua ideia aqui — pode chamar DB_Query, Integration_*,
 *       // Utils_*, etc. normalmente.
 *       if (context.dryRun) {
 *         context.log('Rodando em modo simulação, nada será gravado.');
 *         return { simulado: true };
 *       }
 *       // código real de escrita, só executa se dryRun=false
 *       return { ok: true };
 *     }
 *   );
 * ============================================================
 */

const Maintenance_Sandbox = (function () {

  function registerBuiltInExamples() {

    Maintenance_Core.registerExperiment(
      'ping_core',
      'Ping no Core',
      'Confere se Core_Config, DB_Core e Auth_Session respondem sem erro — smoke test rápido para quando você mexe em algo e quer saber na hora se quebrou o básico.',
      function (context) {
        const out = {};
        out.configOk = !!Core_Config.get('APP_NAME');
        try { DB_Core.ss(); out.spreadsheetOk = true; } catch (e) { out.spreadsheetOk = false; out.spreadsheetErro = e.message; }
        out.sessionServiceOk = typeof Auth_Session.currentUserEmailSafe === 'function';
        context.log('Ping concluído: ' + JSON.stringify(out));
        return out;
      }
    );

    Maintenance_Core.registerExperiment(
      'exemplo_escrita_segura',
      'Exemplo de escrita segura',
      'Mostra o padrão para experimentos que gravam dado: só grava de verdade se dryRun=false, senão só descreve o que faria.',
      function (context) {
        const dadoTeste = { origem: 'Maintenance_Sandbox', criadoEm: new Date() };
        if (context.dryRun) {
          context.log('DRY RUN — não vou gravar nada. Registraria: ' + JSON.stringify(dadoTeste));
          return { wouldInsert: dadoTeste };
        }
        // Só chega aqui se você rodar com dryRun:false explicitamente.
        const inserted = DB_Insert.insert('EXPERIMENTOS_LOG', {
          experimentoId: 'exemplo_escrita_segura',
          nome: 'grava de teste',
          status: 'TESTE_MANUAL',
          resultadoJson: JSON.stringify(dadoTeste),
          data: new Date()
        });
        return { inserted };
      }
    );
  }

  return { registerBuiltInExamples };
})();
