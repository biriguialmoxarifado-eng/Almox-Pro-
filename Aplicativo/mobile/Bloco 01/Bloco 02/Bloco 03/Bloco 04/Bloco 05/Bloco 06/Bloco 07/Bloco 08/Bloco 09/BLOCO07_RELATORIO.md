# ALMOXA PRO — BLOCO 07: RELATÓRIOS
### Relatório técnico

---

## Aviso crítico sobre este bloco

A auditoria (seção 1 do contrato, obrigatória antes de qualquer
arquivo) achou uma infraestrutura de relatórios já pronta e
extensa: Service_Relatorio.gs, Service_Exportacao.gs,
Integration_PDF.gs, Utils_Export.gs, MOD_12_RELATORIOS.gs,
API_Relatorios.gs — da Fase 9 do backend original, com 13 tipos
de relatório já reais e exportação de verdade em CSV/PDF/Google
Sheets (o caminho real pra "Excel" no Apps Script, honesto sobre
não gerar .xlsx binário puro sem lib externa). Não reconstruí
nada disso. Comparei item a item com os 6 relatórios centrais
desta spec e achei gaps genuínos, todos preenchidos reaproveitando
módulo já existente.

## Gaps genuínos encontrados e corrigidos

| Gap | O que faltava | Como foi resolvido |
|---|---|---|
| Ocorrências | Nenhum builder — tabela já existia (Módulo 06) | BUILDERS.OCORRENCIAS novo |
| Compras/Pré-Compras | Nenhum builder — módulo já disponível (Módulo 03), contrato pedia "quando disponível" | BUILDERS.PRE_COMPRAS novo |
| Inventário detalhado | INVENTARIOS só devolvia a linha-resumo, nunca o item (código/quantidade sistema/contada/diferença/valor) que a seção 4 pede | BUILDERS.INVENTARIOS_DETALHADO novo — delega 100% pra Service_Inventario.relatorio() (Bloco 04), nunca recalcula |
| Valor inventariado | Nenhum agregado financeiro multi-inventário | BUILDERS.VALOR_INVENTARIADO novo — soma o financeiro que o Bloco 04 já calcula por inventário |
| Itens por PEP | Nenhum builder | BUILDERS.ITENS_POR_PEP novo — agrupa por classificadorPEP (campo do Bloco de IA) |
| Rastreabilidade | Nenhum builder | BUILDERS.RASTREABILIDADE novo — delega pro Módulo 10, zero duplicação |
| Divergências/Movimentações sem descrição do item | Retornava só a linha crua, sem nome do produto | Enriquecido com produtoDescricao/itemDescricao, mesmo padrão já usado em ESTOQUE |
| Permissão financeira | relatorio.generate era só VIEW pra qualquer tipo — seção 14 pede "quem pode acessar informações financeiras" separado | Checagem nova: VALOR_INVENTARIADO/CURVA_ABC exigem permissão AUDIT (GESTOR/AUDITOR/ADMIN — ALMOXARIFE/OPERADOR ficam de fora) |
| Escopo de obra | Nenhuma restrição — qualquer perfil via dado de qualquer obra | MESTRE_OBRA agora só vê a própria obra (usuario.obraAtual); perfis de gestão continuam vendo tudo |

## Honestidade sobre "Itens por PEP"

O campo classificadorPEP existe no schema de MOVIMENTOS desde os
Blocos de IA (13-15), mas nenhum módulo de negócio o preenche
ainda — documentado honestamente desde aquela entrega. O
relatório funciona de verdade (agrupa, soma, conta materiais
distintos), mas hoje sempre devolve lista vazia até algum módulo
começar a classificar movimentações. Testado explicitamente que
isso não quebra nem finge dado.

## Cuidado tomado com a permissão financeira

Auth_RBAC.can() usa um vocabulário fechado de ações genéricas
(VIEW/CREATE/EDIT/APPROVE/EXPORT/AUDIT/IMPORT) — conferi isso
lendo o código antes de escrever a checagem, pra não inventar uma
ação (FINANCEIRO) que falharia silenciosamente (cairia no VIEW
padrão e liberaria geral, o oposto do que a seção 14 pede). Usei
AUDIT, que já é exatamente o nível de confiança certo no
vocabulário existente.

## Front — tela ampliada (seção 3)

Screen_Reports.html já existia (Front Mobile) mas só tinha 4 tipos
sem filtro nem exportação. Ampliado com:
- Os 6 cards nomeados pela seção 3 (Inventários/Divergências/
  Ocorrências/Valor Inventariado/Itens por PEP/Movimentações) —
  mantidos os que já existiam (Estoque, Estoque Crítico, Reservas,
  Auditoria), conforme a seção 3 pede explicitamente ("adicionar...
  sem remover os seis principais").
- Filtros básicos (período, obra) — só os universais, sem inventar
  filtro sem correspondente real (seção 10).
- Botões de exportação (PDF/CSV/Excel) reaproveitando
  relatorio.export, que já existia — nenhuma rota nova no Front.
- Responsividade reaproveitada dos breakpoints já criados na
  Integração 03 (.grid-tablet-2col).

## Arquivos alterados

```
SERVICES/Service_Relatorio.gs — 5 builders novos, 2 enriquecidos, permissão financeira, escopo de obra
API/API_Relatorios.gs         — permissão relatorio.financeiro registrada
FRONTEND/Screen_Reports.html  — 6 cards + filtros + exportação real
TESTS/Test_IntegracaoFinal.gs — teste novo no runner mestre
```

## Arquivo criado

```
TESTS/Test_Bloco07_Relatorios.gs
```

## Nenhuma rota de backend nova precisou ser criada

relatorio.generate/relatorio.export já existiam e já eram
genéricos o bastante — todos os gaps foram preenchidos dentro do
próprio BUILDERS, sem precisar de rota nova.

## Testes executados — Test_Bloco07_Relatorios.gs

Builder de ocorrências funcionando; builder de pré-compras
funcionando; inventário detalhado compondo de verdade (esperado
10, contado 8, diferença -2 — número real, não texto formatado
como fonte de cálculo, seção 7); valor inventariado agregando
corretamente; permissão financeira bloqueando operador comum
(PERMISSION_DENIED) mas liberando relatório comum pro mesmo
usuário; PEP honesto (nunca inventa dado); rastreabilidade
delegando corretamente pro Módulo 10; escopo de obra bloqueando
MESTRE_OBRA de ver reserva de outra obra e confirmando que ele vê
a própria; gestor continuando a ver todas as obras; divergências
enriquecidas com descrição do item.

O núcleo já testado antes (ESTOQUE/MOVIMENTACOES/RESERVAS/OBRAS/
FORNECEDORES/NOTAS_FISCAIS/AUDITORIA/CURVA_ABC/exportação real
CSV-PDF-Sheets) tem cobertura própria em Test_Fase9_Relatorios.gs
— não duplicado aqui.

## Dependências

Nenhuma nova. Reaproveita Service_Inventario (Bloco 04),
Service_Rastreabilidade (Módulo 10), Service_PreCompra (Módulo
03), Integration_PDF/Integration_GoogleDrive/
Integration_GoogleSheets (Fase 9, já existentes).

## Limitações reais (não escondidas)

- Excel real (.xlsx binário): continua não existindo — Apps
  Script não escreve esse formato nativo sem biblioteca externa.
  O caminho real é Google Sheets (baixável como .xlsx pelo
  próprio usuário), documentado desde a Fase 9, preservado aqui.
- Pré-visualização (seção 11): o backend já devolve o dataset
  completo com cabeçalho/resumo antes da exportação (generate()
  sempre roda primeiro) — mas uma tela dedicada de
  "pré-visualização formatada" (cabeçalho ALMOXA PRO, gráficos)
  não foi construída; a versão mobile mostra cards resumidos,
  suficiente pro uso no celular, mas não é a pré-visualização
  rica que telas de desktop poderiam ter.
- Gráficos: não implementados — a spec permite "quando
  aplicável", e nenhum gráfico foi considerado essencial pra
  esta rodada.
- PEP sempre vazio hoje: consequência de uma decisão já tomada e
  documentada em blocos anteriores (nenhum módulo popula
  classificadorPEP ainda), não uma lacuna nova.

---

## Critério de conclusão (seção 18, item a item)

Tela real ✅ (ampliada, não mock) · Dados reais ✅ (nenhum valor
inventado, financeiro vem do Bloco 04) · API integrada ✅ (rotas
já existentes reaproveitadas) · Data Layer integrado ✅ · Filtros
funcionando ✅ (período/obra, com correspondência real nos dados)
· Relatórios funcionando ✅ (6 centrais + os que já existiam) ·
Exportação PDF/Excel funcionando ✅ (reaproveitada) · Permissões
funcionando ✅ (financeiro + escopo de obra, testados) · Auditoria
funcionando ✅ (já registrava, agora com filtros no log) ·
Responsividade funcionando ✅ (breakpoints reaproveitados) · Testes
realizados ✅ · 217 arquivos, 0 erros de sintaxe ✅.

BLOCO 07 — CONCLUÍDO.
