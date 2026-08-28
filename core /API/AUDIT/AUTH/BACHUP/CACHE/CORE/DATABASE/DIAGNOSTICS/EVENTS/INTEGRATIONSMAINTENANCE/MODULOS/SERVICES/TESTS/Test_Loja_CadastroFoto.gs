/**
 * ============================================================
 * ALMOXA PRO — Test_Loja_CadastroFoto.gs
 * FASE 3 DO FRONT MOBILE.
 * ============================================================
 */

function Test_Loja_CadastroFoto_fluxoCompleto() {
  Core_API.bootstrap();

  const obrasAntes = Core_API.call({ action: 'loja.obras', payload: {} });
  Logger.log('OBRAS (sem sessão): ' + JSON.stringify(obrasAntes));

  const matriculaTeste = 'MOB-' + new Date().getTime();
  const cadastro = Core_API.call({
    action: 'loja.cadastro', payload: {
      nome: 'Funcionário Teste Mobile', matricula: matriculaTeste, cargo: 'Pedreiro', senha: '1234'
    }
  });
  Logger.log('CADASTRO (sem sessão prévia): ' + JSON.stringify(cadastro));
  if (!cadastro.success) return { obrasAntes, cadastro };
  const sessionId = cadastro.data.sessionId;

  const cadastroDuplicado = Core_API.call({
    action: 'loja.cadastro', payload: { nome: 'Outro', matricula: matriculaTeste, senha: '1234' }
  });
  Logger.log('CADASTRO DUPLICADO (deve falhar): ' + JSON.stringify(cadastroDuplicado));

  // Foto: um JPEG mínimo válido em base64 (1x1 pixel), só pra testar o pipeline de upload
  const fotoBase64Minima = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
  const salvarFoto = Core_API.call({ action: 'usuario.salvarFoto', sessionId, payload: { fotoBase64: fotoBase64Minima } });
  Logger.log('SALVAR FOTO: ' + JSON.stringify(salvarFoto));

  const passou =
    obrasAntes.success &&
    cadastro.success && cadastro.data.perfil === CORE_CONSTANTS.PERFIS.OPERADOR &&
    !cadastroDuplicado.success &&
    salvarFoto.success && !!salvarFoto.data.fotoUrl;

  Logger.log('=== RESULTADO CADASTRO/FOTO: ' + (passou ? 'PASSOU' : 'FALHOU') + ' ===');
  SpreadsheetApp.getUi().alert('Teste Cadastro/Foto (Fase 3 Front): ' + (passou ? 'PASSOU ✅' : 'FALHOU ❌ — se falhou por Drive, configure DRIVE_FOLDER_DOCS.'));
  return { obrasAntes, cadastro, cadastroDuplicado, salvarFoto, passou };
}
