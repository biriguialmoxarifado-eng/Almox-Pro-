/**
 * ============================================================
 * ALMOXA PRO — MODULES/_ModuleList.gs
 * Lista mestra de todos os módulos do sistema. Consumida por
 * Core_ModuleManager.initAll() no bootstrap. Módulos já
 * implementados (Auth, Audit, Backup, Doctor, Biometria,
 * Manutenção) entram como seus próprios objetos reais; os
 * demais entram como descritores MOD_XX gerados no esqueleto.
 * ============================================================
 */

const ALL_MODULES = [
  Auth_Service,
  Usuarios_Core,
  IdentityService,
  Service_Loja,
  Service_Solicitacao,
  Service_PreCompra,
  Service_Ferramenta,
  Service_Migration, // MÓDULO 07 — substitui o placeholder vazio MOD_00_MIGRATION (nunca teve rota nenhuma desde a Fase 1)
  Service_AIEngine,
  Service_Rastreabilidade,
  Service_CentralDados,
  Service_Skills,
  MOD_02_IMPORTACAO,
  MOD_03_CADASTROS,
  MOD_04_NOTA_FISCAL,
  MOD_05_CONFERENCIA,
  MOD_06_ESTOQUE,
  MOD_07_RESERVAS,
  Audit_Core,
  MOD_09_SAIDAS,
  MOD_10_INVENTARIO,
  MOD_11_EXPORTACAO,
  MOD_12_RELATORIOS,
  Backup_Core,
  Doctor_Core,
  MOD_15_IA,
  MOD_16_PROJETOS,
  MOD_17_OBRAS,
  MOD_18_ATIVIDADES,
  MOD_19_EQUIPE,
  MOD_20_OCORRENCIAS,
  MOD_21_NOTIFICACOES,
  Auth_Biometric,
  MOD_23_ETIQUETAS,
  MOD_24_SAP,
  MOD_25_CONFIGURACOES,
  Maintenance_Core
];
