# ALMOXA PRO — MÓDULO 09: AI ENGINE
### Relatório técnico de implementação

---

## Auditoria antes de codificar

Service_IA.gs já existia (Fase 12 do backend) com 3 funções reais
e transparentes: sugerirCompra, detectarAnomalias, analisarConsumo
— regras estatísticas simples (média, desvio padrão, projeção
linear), documentadas explicitamente como "não é machine
learning". Nada disso foi reescrito. O Service_AIEngine novo é
uma camada de orquestração por cima: assistente, resumo por
perfil, alertas com explicação, preferências — compondo dado real
de todos os outros módulos, nunca reinventando cálculo que já
existe.

## Transparência central (a mesma exigida pelo contrato)

- consultar() não é NLP real. É um roteador por palavra-chave
  sobre um conjunto conhecido de perguntas — documentado no
  próprio código. Pergunta fora desse conjunto recebe "não
  reconheci", nunca uma resposta inventada. Testado
  explicitamente.
- Nenhuma chamada a API externa de IA. Não há LLM, não há serviço
  pago configurado. Por isso não existe "IA indisponível" pra
  tratar (seção 13 do contrato) — é 100% cálculo interno sobre
  dado que já está no banco.
- A IA nunca grava em tabela de negócio. Conferido por inspeção
  (nenhuma chamada DB_Insert/DB_Update/DB_Delete neste arquivo
  toca ESTOQUE, RESERVAS, SOLICITACOES, etc.) e testado na
  prática: rodei 3 consultas de IA e conferi que o saldo do
  estoque não mudou nem um pouco.

## Bug de segurança real encontrado e corrigido antes de fechar

definirPreferencia — a função que configura quais notificações
cada usuário recebe — não conferia dono nem exigia ADMIN pra
configurar a preferência de outra pessoa. Como a permissão de
rota é ampla de propósito (mesmo padrão self-scope usado em todo
o sistema), qualquer OPERADOR conseguia mudar a preferência de
notificação de qualquer outro usuário. Corrigido antes de fechar
o teste — agora só o próprio dono ou ADMIN pode definir.

## O que foi implementado

- consultar: reconhece perguntas sobre estoque crítico/mínimo, reservas pendentes, pré-compra sem retorno, aprovações pendentes, ferramenta não devolvida, nota fiscal pendente — cada uma delegando pra uma consulta real, nunca fabricando número.
- resumoOperacional: literalmente diferente por perfil (ALMOXARIFE/MESTRE_OBRA/GESTOR/ADMIN), testado confirmando que as chaves do resumo mudam.
- alertasInteligentes: 7 categorias (estoque, reserva vencendo, pré-compra sem retorno, aprovação pendente, inventário com divergência, NF pendente, ferramenta não devolvida), cada item com explicacao textual construída a partir de número real — não é só "estoque baixo", é "disponível está X, mínimo é Y, consumo médio é Z, cobertura estimada W dias" (seção 4 do contrato, testado).
- preverConsumo: repasse pra Service_IA.analisarConsumo, sempre com aviso explícito de que é estimativa (testado).
- analisarFornecedores: repasse pra Service_PreCompra.sugerirFornecedores, com aviso de que a IA nunca escolhe fornecedor sozinha.
- relatorioInteligente: narrativa curta em cima dos mesmos alertas (4 tipos: pendências, estoque, compras, inventário).
- montarMensagemNotificacao: texto personalizado com nome real e números reais, no formato exato do exemplo do contrato.
- definirPreferencia/obterPreferencias: as 10 categorias exatas da seção 9, com bug de segurança corrigido (acima).
- historicoInteracoes: consulta IA_INTERACOES, onde consultar() grava toda pergunta/resposta/data automaticamente (seção 12 do contrato).

## Arquivos criados

- SERVICES/Service_AIEngine.gs
- TESTS/Test_Modulo09_AIEngine.gs

## Arquivos alterados

- DATABASE/DB_Mapping.gs — IA_INTERACOES/IA_PREFERENCIAS novas
- MODULES/_ModuleList.gs — módulo registrado

## Rotas (todas self-scope — mesmo padrão usado desde usuario.salvarFoto)

```
ia.consultar, ia.resumoOperacional, ia.alertasInteligentes,
ia.preverConsumo, ia.analisarFornecedores, ia.relatorioInteligente,
ia.montarMensagemNotificacao, ia.definirPreferencia,
ia.obterPreferencias, ia.historicoInteracoes
```

## Testes executados — Test_Modulo09_AIEngine.gs

Assistente reconhecendo "estoque crítico" com dado real; pergunta
fora do escopo não inventa resposta; alerta com explicação de
verdade (não "estoque baixo" genérico); resumo com chaves
diferentes por perfil; previsão sempre avisando estimativa;
mensagem personalizada; preferência configurada pelo admin
refletindo pro usuário certo; categoria sem configuração explícita
vem ativa por padrão; usuário não vê preferência de outro
(bloqueado); usuário não consegue definir preferência de outro (o
bug corrigido, testado); auditoria da IA registrando a interação;
e a prova mais importante — saldo de estoque idêntico antes/depois
de rodar 3 consultas de IA diferentes.

## 🟢 Concluído

Assistente contextual (roteador, documentado como tal), resumo
por perfil, alertas com explicação, previsão marcada como
estimativa, análise de fornecedor sem auto-aprovação, relatórios
narrativos, mensagem personalizada (texto pronto pra voz futura),
preferências de notificação com bug de segurança corrigido,
auditoria completa da IA, e — o mais importante — confirmação de
que a IA nunca altera dado de negócio.

## 🟡 Pendente (documentado, não escondido)

- NLP real / LLM: não existe, documentado desde o cabeçalho do
  arquivo. consultar() reconhece um conjunto fixo de perguntas,
  não qualquer pergunta em linguagem natural.
- Voz de verdade (TTS): seção 10 do contrato pede só "preparar
  arquitetura" — montarMensagemNotificacao já devolve texto plano
  pronto pra qualquer serviço de conversão futuro; nenhuma
  chamada de áudio foi implementada (a spec avisa pra não
  presumir API de voz gratuita).
- Tendência de preço temporal real: analisarFornecedores menciona
  quantos fornecimentos existem, mas não calcula uma tendência ao
  longo do tempo (subiu/desceu) — precisaria de mais pontos de
  dado histórico por fornecedor do que normalmente existe ainda
  no sistema; documentado no próprio retorno da função
  (tendencia), não fingido como calculado.
- Relatório inteligente por obra: a seção 7 lista "resumo por
  obra" — não implementei um filtro por obraId nesta rodada
  porque nem todo módulo (ex: Ferramentas) tem obraId formal
  ainda (documentado desde o Módulo 06); fica como extensão
  natural quando isso existir.

## 🔴 Bloqueado

Nenhum item bloqueado.

---

## Critério de conclusão

Backend existe e protegido (self-scope real, testado) ✅ ·
Reaproveita Service_IA/Service_PreCompra/Doctor_* sem duplicar
cálculo ✅ · IA nunca altera dado de negócio (testado) ✅ · Bug de
segurança encontrado e corrigido antes da entrega ✅ · Testes
passam ✅ · Pendências documentadas ✅ · Módulos 01-08 e Front
Mobile intocados (194 arquivos, 0 erros de sintaxe) ✅.

MÓDULO 09 — CONCLUÍDO (com pendências 🟡 registradas, nenhuma
bloqueante).

---

## OS TRÊS MÓDULOS DO CONTRATO "PROMPTS_MODULOS_07_08_09" ESTÃO COMPLETOS

07 (Migration Engine — orquestra Importação/Backup existentes),
08 (Doctor Engine — ampliado com a peça mais valiosa: detecção
automática de rota sem permissão explícita), 09 (AI Engine —
orquestra tudo por cima, nunca grava dado de negócio). Com os 6
módulos anteriores (01-06), são 9 módulos de negócio completos
além das 13 fases do backend e 9 fases do Front Mobile. 194
arquivos de backend validados, zero erros de sintaxe.
