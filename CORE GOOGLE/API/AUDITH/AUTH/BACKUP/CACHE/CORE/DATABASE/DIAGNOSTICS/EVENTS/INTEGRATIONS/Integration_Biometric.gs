/**
 * ============================================================
 * ALMOXA PRO — Integration_Biometric.gs
 * FASE 11 — Provider biométrico REAL: DEVICE_SECRET.
 *
 * MODELO DE SEGURANÇA (documentado com honestidade — seção 70
 * proíbe declarar integração real que não seja de verdade):
 *
 * O Apps Script roda 100% no servidor, sem acesso a câmera,
 * leitor de digital ou sensor biométrico algum — isso só existe
 * no dispositivo do usuário (celular/notebook). Então NENHUM
 * provider rodando em Apps Script pode "ler" biometria de
 * verdade. O que É real e funciona de ponta a ponta:
 *
 * 1. O dispositivo do usuário gera/guarda um segredo (deviceSecret)
 *    protegido pelo Keystore/Secure Enclave do aparelho — o
 *    sistema operacional só libera esse segredo depois de Face
 *    ID / digital / PIN do dispositivo (isso é nativo do
 *    celular, fora do escopo do Apps Script).
 * 2. O app manda esse segredo pro servidor (sempre via HTTPS).
 * 3. O servidor NUNCA guarda o segredo em texto puro — só o hash
 *    dele (igual senha), como `credentialReference` na tabela
 *    BIOMETRIA. Nem o servidor nem um vazamento de planilha
 *    revelam o segredo original.
 * 4. "verify" = comparar hash(segredo enviado) com o hash salvo.
 *
 * Isso é honestamente equivalente, em segurança, a autenticação
 * por senha — só que a "senha" é um segredo longo e aleatório
 * que o usuário nunca digita, protegido pela biometria do
 * próprio aparelho. NÃO é verificação biométrica server-side
 * (isso exigiria WebAuthn com verificação de assinatura
 * assimétrica — criptograficamente pesado demais pra manter
 * nesta fase sem biblioteca externa) — mas é uma implementação
 * REAL, funcional e testável hoje, sem depender de nenhum SDK
 * pago de terceiro.
 *
 * Trocar de provider no futuro (WebAuthn, SDK de terceiro) exige
 * só implementar o mesmo contrato aqui — nada muda em
 * Auth_Biometric nem nas rotas.
 * ============================================================
 */

const Integration_Biometric = (function () {

  function _hash(segredo) {
    return Auth_Tokens.hash(String(segredo || ''));
  }

  const deviceSecretProvider = {

    register(payload) {
      const { userId, deviceSecret } = payload || {};
      if (!userId || !deviceSecret) {
        throw Object.assign(new Error('userId e deviceSecret são obrigatórios para registrar biometria.'), { code: CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR });
      }
      if (String(deviceSecret).length < 16) {
        throw Object.assign(new Error('deviceSecret muito curto — o app deve gerar um segredo aleatório de pelo menos 16 caracteres, não uma senha digitada.'), { code: CORE_CONSTANTS.RESPONSE_CODES.VALIDATION_ERROR });
      }

      // Revoga cadastro biométrico anterior do mesmo usuário, se houver
      // (evita acumular credenciais órfãs — só uma ativa por vez nesta fase).
      const anterior = DB_Query.findOne('BIOMETRIA', b => String(b.userId) === String(userId) && b.status === 'ATIVO');
      if (anterior) DB_Update.byId('BIOMETRIA', anterior.ID, { status: 'SUBSTITUIDO', dataAtualizacao: new Date() });

      const biometricId = Utils_ID.uuid();
      DB_Insert.insert('BIOMETRIA', {
        biometricId, userId, provider: 'DEVICE_SECRET',
        credentialReference: _hash(deviceSecret),
        status: 'ATIVO', consentimento: true,
        dataCadastro: new Date(), dataAtualizacao: new Date(), ultimoUso: ''
      });
      DB_Update.byId('USUARIOS', userId, {
        biometricId, statusBiometria: 'ATIVO',
        consentimentoBiometrico: true, dataConsentimento: new Date()
      });

      return { biometricId, provider: 'DEVICE_SECRET' };
    },

    verify(payload) {
      const { userId, deviceSecret } = payload || {};
      if (!userId || !deviceSecret) {
        return { verificado: false, motivo: 'userId e deviceSecret são obrigatórios.' };
      }
      const cred = DB_Query.findOne('BIOMETRIA', b => String(b.userId) === String(userId) && b.status === 'ATIVO');
      if (!cred) return { verificado: false, motivo: 'Usuário não tem biometria ativa cadastrada.' };

      const ok = cred.credentialReference === _hash(deviceSecret);
      if (ok) DB_Update.byId('BIOMETRIA', cred.ID, { ultimoUso: new Date() });
      return { verificado: ok };
    },

    identify(payload) {
      // 1:N — varre credenciais ativas procurando o segredo.
      // Aviso honesto de escala: isso é O(n) sobre usuários com
      // biometria ativa. Pra times pequenos/médios (dezenas a
      // poucas centenas) roda instantâneo; times muito grandes
      // vão querer trocar por WebAuthn (identificação por
      // credentialId, não por varredura) nesta mesma interface.
      const { deviceSecret } = payload || {};
      if (!deviceSecret) return { encontrado: false, motivo: 'deviceSecret é obrigatório.' };

      const hash = _hash(deviceSecret);
      const cred = DB_Query.findOne('BIOMETRIA', b => b.status === 'ATIVO' && b.credentialReference === hash);
      if (cred) DB_Update.byId('BIOMETRIA', cred.ID, { ultimoUso: new Date() });
      return cred ? { encontrado: true, userId: cred.userId } : { encontrado: false };
    },

    delete(payload) {
      const { userId } = payload || {};
      const cred = DB_Query.findOne('BIOMETRIA', b => String(b.userId) === String(userId) && b.status === 'ATIVO');
      if (cred) DB_Update.byId('BIOMETRIA', cred.ID, { status: 'REVOGADO', dataAtualizacao: new Date() });
      DB_Update.byId('USUARIOS', userId, { biometricId: '', statusBiometria: 'INATIVO' });
      return { removido: !!cred };
    },

    status(payload) {
      const { userId } = payload || {};
      const cred = DB_Query.findOne('BIOMETRIA', b => String(b.userId) === String(userId) && b.status === 'ATIVO');
      return { ativo: !!cred, ultimoUso: cred ? cred.ultimoUso : null, dataCadastro: cred ? cred.dataCadastro : null };
    },

    healthCheck() { return { status: CORE_CONSTANTS.DOCTOR_STATUS.OK }; }
  };

  function healthCheck() {
    const provider = Core_Config.get('BIOMETRIC_PROVIDER');
    return { status: provider !== 'NONE' ? CORE_CONSTANTS.DOCTOR_STATUS.OK : CORE_CONSTANTS.DOCTOR_STATUS.NOT_CONFIGURED, provider };
  }

  return { healthCheck, deviceSecretProvider };
})();
