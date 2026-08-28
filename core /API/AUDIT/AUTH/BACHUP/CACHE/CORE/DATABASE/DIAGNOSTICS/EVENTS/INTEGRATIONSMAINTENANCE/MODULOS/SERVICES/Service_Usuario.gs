/**
 * ============================================================
 * ALMOXA PRO — Service_Usuario.gs
 * Tabela principal: USUARIOS
 *
 * MÓDULO 01 (contrato "PROMPTS_MODULOS_01_02_03") — completa o
 * que estava esqueleto (get/search/create/update). `salvarFoto`
 * já era real desde a Fase 3 do Front Mobile e não foi tocada.
 *
 * PRINCÍPIO CENTRAL DO CONTRATO: este módulo é a autoridade de
 * identidade — nenhum outro módulo deve inventar sua própria
 * regra de perfil/permissão. Tudo aqui delega pro RBAC existente
 * (`Auth_RBAC`), nunca cria uma segunda fonte de verdade.
 * ============================================================
 */

const Service_Usuario = (function () {

  /**
   * Escopo real de campos por perfil (seção 5/7 do contrato:
   * "consultar usuário permitido pelo perfil", "não expor campos
   * administrativos para perfis sem autorização"). `senha_hash`
   * NUNCA sai daqui pra ninguém, nem pra ADMIN, nem pro próprio
   * dono — não existe caso de uso legítimo pro Front precisar
   * do hash da senha.
   */
  function _filtrarCampos(usuarioAlvo, ctx) {
    if (!usuarioAlvo) return null;
    const ehProprio = String(usuarioAlvo.ID) === String(ctx.userId);
    const ehAdmin = ctx.perfil === CORE_CONSTANTS.PERFIS.ADMIN;

    const base = {
      ID: usuarioAlvo.ID, nome: usuarioAlvo.nome, matricula: usuarioAlvo.matricula,
      cargo: usuarioAlvo.cargo, funcao: usuarioAlvo.funcao, fotoUrl: usuarioAlvo.fotoUrl,
      obraAtual: usuarioAlvo.obraAtual
    };

    if (!ehProprio && !ehAdmin) return base; // identificação básica, nada administrativo

    return Object.assign({}, base, {
      email: usuarioAlvo.email, telefone: usuarioAlvo.telefone,
      perfil: usuarioAlvo.perfil, status: usuarioAlvo.status,
      ambiente: usuarioAlvo.ambiente, permissoes: usuarioAlvo.permissoes,
      dataCadastro: usuarioAlvo.dataCadastro, ultimoAcesso: usuarioAlvo.ultimoAcesso,
      statusBiometria: usuarioAlvo.statusBiometria, dataAtualizacao: usuarioAlvo.dataAtualizacao
      // senha_hash, sessaoAtual, biometricId, faceCredentialId,
      // consentimentoBiometrico, dataConsentimento: nunca expostos via API,
      // nem pro próprio dono nem pro ADMIN — seção 7 do contrato.
    });
  }

  function get(ctx) {
    const alvo = DB_Query.get('USUARIOS', ctx.payload.id);
    if (!alvo) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Usuário não encontrado.', {}, ctx.requestId);
    return Core_Response.ok(_filtrarCampos(alvo, ctx), '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * Busca por nome/matrícula (seção 5: "pesquisar por nome,
   * matrícula/identificador"). Cada linha do resultado passa
   * pelo MESMO filtro de escopo do `get()` — perfil comum
   * pesquisando colega vê só identificação básica, nunca dado
   * administrativo de terceiro.
   */
  function search(ctx) {
    const termo = (ctx.payload && ctx.payload.query) || '';
    const termoNorm = termo ? Utils_String.normalize(termo) : null;

    const rows = DB_Query.find('USUARIOS', u => {
      if (u.status === 'EXCLUIDO') return false; // exclusão lógica, se existir
      if (!termoNorm) return true;
      const alvo = Utils_String.normalize((u.nome || '') + ' ' + (u.matricula || ''));
      return alvo.includes(termoNorm);
    });

    const filtrados = rows.map(u => _filtrarCampos(u, ctx));
    return Core_Response.ok(filtrados, '', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * Criação administrativa (rota já exige ADMIN via RBAC — seção
   * 7: "nunca aceitar perfil vindo do Front sem validação").
   * Aqui a validação é dupla: RBAC barra quem não é ADMIN antes
   * de chegar aqui, e esta função barra qualquer string de perfil
   * que não exista no enum real — nunca aceita um valor arbitrário
   * só porque veio de alguém autorizado a criar usuário.
   */
  function create(ctx) {
    const p = ctx.payload || {};
    try {
      DB_Validation.requireFields(p, ['nome', 'matricula', 'senha', 'perfil']);
    } catch (e) {
      return Core_Response.error(e.code || CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, e.message, {}, ctx.requestId);
    }

    const perfisValidos = Object.values(CORE_CONSTANTS.PERFIS);
    if (!perfisValidos.includes(p.perfil)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
        'Perfil inválido. Use um de: ' + perfisValidos.join(', '), {}, ctx.requestId);
    }
    if (String(p.senha).length < 4) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Senha muito curta (mínimo 4 caracteres).', {}, ctx.requestId);
    }
    if (DB_Query.exists('USUARIOS', u => u.matricula === p.matricula)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Já existe um usuário com essa matrícula.', {}, ctx.requestId);
    }

    const novo = DB_Insert.insert('USUARIOS', {
      matricula: p.matricula, nome: p.nome, email: p.email || '', telefone: p.telefone || '',
      cargo: p.cargo || '', funcao: p.funcao || '', perfil: p.perfil,
      status: 'ATIVO', obraAtual: p.obraAtual || '', ambiente: '', permissoes: '',
      dataCadastro: new Date(), ultimoAcesso: '', sessaoAtual: '',
      biometricId: '', faceCredentialId: '', statusBiometria: 'INATIVO',
      consentimentoBiometrico: false, dataConsentimento: '', dataAtualizacao: new Date(),
      senha_hash: Auth_Tokens.hash(p.senha), fotoUrl: ''
    });

    // Nunca logar a senha em texto puro, nem o hash — seção 7 do contrato.
    Audit_Service.record(ctx, 'USER_CREATED', { entidade: 'USUARIOS', entidadeId: novo.ID }, null, { perfil: novo.perfil, status: novo.status });
    Event_Bus.emit(EVENT_TYPES.USER_CREATED, { userId: novo.ID, perfil: novo.perfil }, ctx);

    return Core_Response.ok(_filtrarCampos(novo, ctx), 'Usuário criado.', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * Atualização administrativa (rota exige ADMIN via RBAC).
   * Campos sensíveis (senha, foto) ficam FORA desta função de
   * propósito: senha não tem rota de redefinição neste contrato
   * (fora de escopo — não inventar), e foto é sempre
   * `usuario.salvarFoto`, self-service, nunca por aqui.
   */
  function update(ctx) {
    const p = ctx.payload || {};
    const alvo = DB_Query.get('USUARIOS', p.id);
    if (!alvo) return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.NOT_FOUND, 'Usuário não encontrado.', {}, ctx.requestId);

    if (p.perfil) {
      const perfisValidos = Object.values(CORE_CONSTANTS.PERFIS);
      if (!perfisValidos.includes(p.perfil)) {
        return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR,
          'Perfil inválido. Use um de: ' + perfisValidos.join(', '), {}, ctx.requestId);
      }
    }
    if (p.matricula && p.matricula !== alvo.matricula && DB_Query.exists('USUARIOS', u => u.matricula === p.matricula)) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'Já existe outro usuário com essa matrícula.', {}, ctx.requestId);
    }

    const camposPermitidos = ['nome', 'matricula', 'email', 'telefone', 'cargo', 'funcao', 'perfil', 'status', 'obraAtual', 'ambiente'];
    const alteracoes = {};
    camposPermitidos.forEach(campo => {
      if (p[campo] !== undefined) alteracoes[campo] = p[campo];
    });
    // senha_hash e fotoUrl NUNCA entram aqui, mesmo se vierem no
    // payload — filtrados de propósito (seção 6/7 do contrato).
    alteracoes.dataAtualizacao = new Date();

    const perfilMudou = alteracoes.perfil !== undefined && alteracoes.perfil !== alvo.perfil;
    const statusMudou = alteracoes.status !== undefined && alteracoes.status !== alvo.status;

    DB_Update.byId('USUARIOS', alvo.ID, alteracoes);
    const atualizado = DB_Query.get('USUARIOS', alvo.ID);

    Audit_Service.record(ctx, 'USER_UPDATED', { entidade: 'USUARIOS', entidadeId: alvo.ID },
      { perfil: alvo.perfil, status: alvo.status }, { perfil: atualizado.perfil, status: atualizado.status });
    Event_Bus.emit(EVENT_TYPES.USER_UPDATED, { userId: alvo.ID }, ctx);
    if (perfilMudou) Event_Bus.emit(EVENT_TYPES.USER_PROFILE_CHANGED, { userId: alvo.ID, de: alvo.perfil, para: atualizado.perfil }, ctx);
    if (statusMudou) Event_Bus.emit(EVENT_TYPES.USER_STATUS_CHANGED, { userId: alvo.ID, de: alvo.status, para: atualizado.status }, ctx);

    return Core_Response.ok(_filtrarCampos(atualizado, ctx), 'Usuário atualizado.', 'SUCCESS', {}, ctx.requestId);
  }

  /**
   * Já era real desde a Fase 3 do Front Mobile — preservada sem
   * alteração (regra do contrato: "não remover funcionalidades
   * das fases anteriores"). Continua usando ctx.userId da sessão
   * validada, nunca um id vindo do payload.
   */
  function salvarFoto(ctx) {
    const { fotoBase64 } = ctx.payload || {};
    if (!fotoBase64) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR, 'fotoBase64 é obrigatório.', {}, ctx.requestId);
    }

    const folderId = Core_Config.get('DRIVE_FOLDER_DOCS') || Core_Config.get('DRIVE_FOLDER_ID');
    if (!folderId) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.EXTERNAL_INTEGRATION_NOT_CONFIGURED, 'DRIVE_FOLDER_DOCS não configurado — configure antes de salvar fotos.', {}, ctx.requestId);
    }

    try {
      const pasta = Utils_File.getOrCreateFolder(folderId, 'Fotos_Usuarios');
      const bytes = Utilities.base64Decode(fotoBase64.replace(/^data:image\/\w+;base64,/, ''));
      const blob = Utilities.newBlob(bytes, 'image/jpeg', 'usuario_' + ctx.userId + '_' + new Date().getTime() + '.jpg');
      const arquivo = pasta.createFile(blob);
      arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const fotoUrl = 'https://drive.google.com/uc?export=view&id=' + arquivo.getId();

      DB_Update.byId('USUARIOS', ctx.userId, { fotoUrl: fotoUrl, dataAtualizacao: new Date() });
      Audit_Service.record(ctx, 'USUARIO_FOTO_ATUALIZADA', { entidade: 'USUARIOS', entidadeId: ctx.userId });

      return Core_Response.ok({ fotoUrl: fotoUrl }, 'Foto salva.', 'SUCCESS', {}, ctx.requestId);
    } catch (e) {
      return Core_Response.error(CORE_CONSTANTS.RESPONSE_CODES.INTERNAL_ERROR, 'Falha ao salvar a foto: ' + e.message, {}, ctx.requestId);
    }
  }

  return {
    get,
    search,
    create,
    update,
    salvarFoto,
    _filtrarCampos // exposto pra outros módulos (ex: futuro módulo de Aprovações) nunca remontarem esse filtro sozinhos
  };
})();
