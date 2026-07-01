# Especificação — App de prontuário de apoio em cosmiatria (Windows)

> **Como usar este documento no Claude Code**
> 1. Abra o Claude Code e cole este documento inteiro como contexto.
> 2. Anexe os dois arquivos que acompanham esta spec:
>    - `mapa-facial-cosmiatria.jsx` → referência de **comportamento** da interação do mapa.
>    - `catalogo-semente-injetaveis-brasil.csv` → catálogo inicial de produtos para importar.
> 3. **Não peça o app inteiro de uma vez.** Siga a ordem de trabalho abaixo. O Code constrói uma parte, roda, você testa e aprova, e só então avança.

---

## 0. Natureza e ordem de trabalho

**O que é:** registro de **apoio** para um único dermatologista. **Não substitui** o prontuário oficial (não é S-RES certificado). Funciona **offline**, sem nuvem, sem telemetria. Interface em **português do Brasil**, limpa e rápida de preencher (uso entre um paciente e outro).

**Dado sensível (LGPD):** o app guarda dado pessoal de saúde. Segurança é requisito, não enfeite.

**Ordem obrigatória de construção (não pular etapas):**
1. Modelo de dados + segurança (§1)
2. Mapa facial interativo (§2)
3. Cadastro de paciente (§3)
4. Catálogo/estoque de produtos (§4)
5. Atendimento/sessão (§5)
6. Histórico e relatórios (§6)

Em cada etapa: rodar, mostrar, esperar aprovação. **Fazer perguntas quando algo estiver ambíguo**; quando não, adotar padrões sensatos e documentar as decisões.

---

## 1. Modelo de dados e segurança (começar por aqui)

- Banco local **SQLite criptografado em repouso** (SQLCipher).
- Acesso por **senha mestra**. Sem senha, sem dados.
- **Backup** automático periódico do banco para arquivo + botão de backup manual. Avisar de forma visível se nenhum backup foi feito há mais de N dias.
- Nenhum dado sai da máquina.
- **PARE antes de finalizar a criptografia e o backup e explique as decisões**: como a chave é derivada da senha, onde fica, como restaurar um backup. Nada de criptografia "caseira" mal feita.

---

## 2. Mapa facial interativo (parte central — usar o `.jsx` anexo como referência de comportamento)

**Gesto (validado no protótipo):**
- **Toque rápido = bolus** (ponto).
- **Arrastar = trajeto** (vetor) de cânula/retroinjeção — desenha uma linha do ponto de entrada à direção/extensão.

**Cada marcação registra:**
- **Marca → Produto (SKU)** vindos do catálogo (§4), e **Lote** vinculado.
- **Dose**: Unidades (U) para toxina; ml para preenchedor e bioestimulador. **A unidade deriva do produto escolhido** (não perguntar o tipo separadamente).
- **Região anatômica**: sugerida automaticamente pelo ponto/âncora mais próximo do clique, **editável**.
- **Instrumento** (agulha/cânula), **plano de profundidade**, **técnica** (bolus, retroinjeção linear, leque, cross-hatching, pontos seriados, torre/coluna).
- Produto **"Outros"** → ver regra de catálogo em §4 (adicionar ao catálogo com dedup, **não** texto solto).

**Visual e edição:**
- Cores por tipo de produto; tamanho do ponto reflete a dose.
- Editar e remover marcações. Mostrar **somas totais** e **somas por região**, ao vivo.
- **Vistas frontal e perfil**, cada uma com seu próprio mapa por sessão.

**Atlas anatômico (substituir o line-art simples do protótipo):**
- Desenhar atlas detalhado: **ligamentos de retenção, terços faciais**, sub-regiões de **lábio** (filtro, arco do cupido, vermelhão, lábio superior D/E, inferior, comissuras) e de **mento** (sulco mentolabial, pré-jowl, **pogônio**, **menton**).
- Camada **opcional** de **zonas de perigo vascular** (artéria facial, angular, etc.) ligável/desligável.
- Manter as âncoras de região do protótipo como base da sugestão automática.

**Foto do paciente (em vez de 3D-da-foto):**
- Permitir upload de foto frontal/perfil como **camada de fundo opcional** do mapa, sobre a qual se clica.
- **NÃO** gerar malha 3D a partir da foto. (Eventual 3D futuro = modelo de cabeça **genérico rotacionável**, fora do escopo inicial.)
- Foto é dado sensível: mesma criptografia em repouso do restante do prontuário.

---

## 3. Cadastro de paciente

- Nome, data de nascimento, CPF, contato, alergias, histórico médico relevante, observações, foto opcional.
- **Identificadores externos**: lista de pares **(rótulo + valor)** — ex.: "Registro hospitalar", "Prontuário PUC". Permitir **mais de um**. Indexados para busca.
- Busca rápida por nome **ou** identificador.

---

## 4. Catálogo / estoque de produtos (hierárquico)

**Estrutura em três níveis, toda gerenciável pela interface (NÃO fixar no código):**
- **MARCA / fabricante** (ex.: Restylane, Juvéderm, Belotero, Sculptra, Radiesse, Ellansé, Botox…).
- **PRODUTO / SKU** (ex.: Restylane → Lyft, Defyne, Kysse…). Atributos opcionais por SKU: tipo, tecnologia/reticulação, apresentação (volume/unidades), região indicada típica, concentração (mg/ml).
- **LOTE**: cada SKU recebe um ou mais lotes, cada lote com **validade** e quantidade em estoque.

**Seleção em cascata (validada no protótipo):** ao registrar, o profissional escolhe **MARCA → PRODUTO → LOTE**. Lote e validade ficam **obrigatórios e vinculados ao atendimento**. Alertar SKUs com lote vencido ou próximo do vencimento.

**Regra do "Outros" / adicionar (importante):**
- Em **marca** e em **produto**, oferecer **"+ adicionar"** que **cria a entrada no catálogo de forma persistente** (não texto solto no atendimento).
- Ao adicionar, **normalizar e deduplicar** (comparar ignorando maiúsculas/minúsculas e espaços) para não criar duplicatas tipo "Lyft" vs "lyft" vs "Restylane Lyft".
- O **tipo** (toxina/preenchedor/bioestimulador) e a **unidade** (U/ml) **derivam do produto** escolhido.
- Permitir **editar / renomear / mesclar** entradas do catálogo pela interface, para corrigir duplicatas que escaparem.

**Importação inicial (CSV anexo):**
- Suportar importação do arquivo `catalogo-semente-injetaveis-brasil.csv`.
- Colunas: `marca, sku, tipo, ativo, apresentacao, tecnologia, regiao_indicada, concentracao_mg_ml, observacao`.
- Mapear `tecnologia` → reticulação/tecnologia do gel. `concentracao_mg_ml` vem **em branco de propósito** (preenchível depois).
- O CSV contém avisos na coluna `observacao` (ex.: toxinas com registro encerrado/fora de mercado) — **respeitar e exibir** esses avisos, não importar silenciosamente como produto normal.

---

## 5. Atendimento / sessão

Cada atendimento tem **data** e pode conter vários procedimentos:
- **Toxina, Preenchedor, Bioestimulador** → via mapa facial (§2).
- **Laser / Luz**: equipamento, parâmetros (fluência, spot, frequência, nº de disparos/passadas), áreas tratadas.
- **Peeling**: agente, concentração, nº de camadas, tempo, neutralização, áreas.
- **Outros** (fios, microagulhamento, enzima): campos genéricos editáveis.

---

## 6. Histórico e relatórios

- **Linha do tempo por paciente** com todos os atendimentos.
- **Comparar sessões** e somar unidades/ml por região ao longo do tempo.
- **Exportar PDF** do atendimento (paciente, identificadores, data, procedimentos, lotes, validades, imagem do mapa) para arquivo/assinatura.

---

## 7. Técnico

- Stack sugerida: **Electron + SQLite (SQLCipher)** — bom para o mapa em SVG/Canvas e fácil de instalar no Windows. Alternativa: **Python + PyQt + SQLite**. Escolha priorizando confiabilidade e instalação simples no Windows.
- **Offline-first**. Gerar um **instalador para Windows** ao final.

---

## 8. Decisões e ressalvas já fechadas (não revisitar sem motivo)

- **Tap = bolus, arraste = trajeto.** Confirmado como o gesto desejado.
- **Cascata Marca → Produto → Lote** com "adicionar" persistente e **dedup**. Texto-livre-por-sessão foi **descartado** (fragmenta o histórico e o estoque).
- **Unidade derivada do produto** (U para toxina, ml para preenchedor/bioestimulador).
- **Região sugerida automaticamente**, editável.
- **3D-da-foto descartado.** Em vez disso: atlas 2D detalhado + foto como camada de fundo opcional. 3D genérico rotacionável só como v2.
- **`concentracao_mg_ml` do CSV fica em branco** (número clínico; preencher pela bula, não de memória).
- **Catálogo-semente cobre** Restylane, Juvéderm, Belotero, Sculptra, Radiesse, Ellansé e as toxinas registradas na Anvisa. **Não cobre** marcas brasileiras (Rennova/Elleva, HArmonyCa, Biogelis, Saypha, E.P.T.Q., Perfectha…) — adicionar pela interface ou via segundo CSV.

## 9. Lembretes operacionais (para o profissional, fora do código)

- **Testar a restauração de um backup de verdade** antes de confiar nele. Backup que você nunca restaurou não é backup.
- Pedir a alguém de confiança técnica para revisar como a criptografia ficou.
- Conferir o `catalogo-semente` contra o produto físico em mãos — lote e validade reais sempre vêm do frasco, não da lista.
