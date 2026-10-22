# WEB

API REST em **Node.js + Express + Prisma + MySQL** do Portal Web de Atividades Complementares.
O frontend (React + Vite + Bootstrap) consome esta API; ele não faz parte deste repositório.

**Etapa atual (Sprint 3):**

- acesso ao banco migrado de SQL puro (mysql2) para o **Prisma**;
- login, cadastro e senhas **removidos**: o sistema vai usar o login da Unifor;
- **CRUD completo de atividades** e rotas GET de **categorias**, **tipos** e **cursos**;
- **GET /progresso** com horas concluídas, pendentes, restantes e **por categoria**.

Envio de certificados (submissões) e Painel do Coordenador ficam para as próximas sprints;
as tabelas já existem.

---

## 1. Requisitos

- Node.js **20.10 ou superior** (testado com 22)
- MySQL **8.0** ou superior

## 2. Instalação passo a passo

```bash
# 1) Instalar as dependências (isso também roda `prisma generate`)
npm install

# 2) Criar o arquivo de configuração e ajustar DATABASE_URL
cp .env.example .env
```

### 2.1 Criar o usuário do MySQL

No cliente MySQL (como root), crie um usuário só para o projeto. A permissão de criar bancos
é necessária porque o Prisma usa um banco temporário ("shadow database") no `migrate dev` e
porque `npm test` recria o banco de testes.

```sql
CREATE USER 'portal_app'@'localhost' IDENTIFIED BY 'escolha-uma-senha';
GRANT ALL PRIVILEGES ON *.* TO 'portal_app'@'localhost';
FLUSH PRIVILEGES;
```

> Em produção, dê permissões só no banco da aplicação e use `npm run db:migrate`
> (que não precisa do banco temporário).

No `.env`:

```
DATABASE_URL="mysql://portal_app:escolha-uma-senha@localhost:3306/portal_atividades"
DATABASE_URL_TEST="mysql://portal_app:escolha-uma-senha@localhost:3306/portal_atividades_test"
```

### 2.2 Criar as tabelas e os dados iniciais

```bash
npm run db:migrate   # aplica as migrações: cria as 10 tabelas
                     # (se o Prisma disser que o banco não existe:
                     #  CREATE DATABASE portal_atividades CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;)
npm run db:seed      # categorias (Ensino, Pesquisa, Extensão) e tipos de atividade
npm run db:demo      # OPCIONAL: cursos, usuários, atividades e submissões FICTÍCIOS
```

> **Quem já tinha o banco da Sprint 2** (criado com `npm run db:setup`): esse banco não é
> compatível com o Prisma. Apague-o antes (`DROP DATABASE portal_atividades;`) e rode os
> comandos acima. Os dados eram só de teste.

O `db:demo` reproduz o dashboard das telas: o aluno `DEMOALU01` tem 125 h aprovadas de 200 h
(Ensino 40/60, Pesquisa 35/50, Extensão 50/90), 1 pendente e 1 rejeitada aguardando correção.
Ele se recusa a rodar com `NODE_ENV=production`.

| Perfil        | Matrícula   |
|---------------|-------------|
| ADMINISTRADOR | `DEMOADM01` |
| COORDENADOR   | `DEMOCOO01` (curso [DEMO] Ciência da Computação) |
| ORGANIZADOR   | `DEMOORG01` |
| ALUNO         | `DEMOALU01` (Ciência da Computação), `DEMOALU02` (Sistemas de Informação) |

### 2.3 Rodar

```bash
npm run dev     # desenvolvimento (reinicia ao salvar)
npm start       # normal
```

Teste rápido: `http://localhost:3000/api/saude` → `{"status":"ok","banco":"ok"}`.

Para ver e editar os dados numa interface gráfica: `npm run db:studio` (Prisma Studio).

### 2.4 Cadastrar usuários (enquanto não há integração com a Unifor)

```bash
npm run usuario:criar -- --matricula ADM0001 --nome "Maria Souza" --perfil ADMINISTRADOR
npm run usuario:criar -- --matricula 2023104567 --nome "Lucas Souza" --perfil ALUNO --curso-id 1
npm run usuario:criar -- --matricula COO0001 --nome "Coordenação CC" --perfil COORDENADOR --curso-id 1
```

Se a matrícula já existir, o comando atualiza o perfil e o curso.

## 3. Identificação do usuário (no lugar do login)

O portal ficará dentro do sistema da Unifor, que já faz o login. **Nossa API não tem mais
cadastro, login nem senha.** Ainda não sabemos como a Unifor vai informar quem é o usuário,
então toda essa lógica ficou em **um único arquivo**: `src/middlewares/identificacao.js`.

**Por enquanto (só desenvolvimento e testes)** o usuário é identificado pelo cabeçalho HTTP:

```
X-Matricula: DEMOALU01
```

- Sem o cabeçalho, só as rotas públicas funcionam.
- Matrícula inexistente ou usuário inativo → **401**.
- O **perfil sempre vem do banco**, nunca da requisição.
- Qualquer pessoa pode mandar esse cabeçalho, então ele **não é segurança**. Por isso a API
  **se recusa a iniciar** com `NODE_ENV=production` e `IDENTIFICACAO_MODO=cabecalho`.

**Quando a integração existir**, só `identificarUsuario` muda (ler um token ou cookie da
Unifor e achar o usuário pela matrícula). As rotas e regras continuam iguais.

## 4. Testes automatizados

```bash
npm test
```

O comando:

1. usa `DATABASE_URL_TEST` (o nome precisa terminar em `_test`);
2. **apaga e recria** esse banco com as migrações (`prisma migrate reset`);
3. roda os testes com o executor nativo do Node (`node:test`).

São **90 testes em 6 arquivos**:

| Arquivo | O que cobre |
|---|---|
| `calculoProgresso.test.js` | Fórmulas do progresso (unitário, sem banco) |
| `identificacao.test.js` | Cabeçalho X-Matricula, 401/403, modo produção, rotas antigas removidas |
| `catalogo.test.js` | GET de categorias, tipos e cursos |
| `atividades.test.js` | Criar, listar com filtros, detalhar, editar e cancelar; permissões e validações |
| `progresso.test.js` | Horas concluídas, pendentes, restantes e por categoria; quem vê o quê |
| `banco.test.js` | UNIQUE, chaves estrangeiras e restrições CHECK do próprio MySQL |

## 5. Estrutura de pastas

```
prisma/
  schema.prisma          modelo de dados (fonte da verdade do banco)
  migrations/            SQL aplicado pelo Prisma (inclui as restrições CHECK)
  seed.js                categorias e tipos (obrigatório)
  seed-demo.js           dados fictícios (opcional)
scripts/
  criar-usuario.js       cria/promove usuários pela linha de comando
  testar.js              prepara o banco de testes e roda os testes
src/
  server.js              ponto de entrada (conecta no banco e abre a porta)
  app.js                 Express: CORS, JSON, rotas, erros
  config/                env.js (lê o .env), prisma.js (cliente único), perfis.js
  routes/index.js        mapa URL → controller (+ identificação e permissões)
  controllers/           lê a requisição e monta a resposta
  services/              regras de negócio e consultas Prisma
    calculoProgresso.js  fórmulas do progresso (função pura, sem banco)
  middlewares/           identificacao.js (quem é o usuário), erros.js
  utils/                 AppError, validações, conversões numéricas
tests/                   testes automatizados
```

Fluxo de uma requisição: `rota → identificação → permissão → controller → service → Prisma → MySQL`.

Com o Prisma, a antiga pasta `repositories/` deixou de ser necessária: o Prisma já é a camada de
acesso a dados e os services chamam o Prisma direto.

## 6. Banco de dados

10 tabelas (veja `prisma/schema.prisma`, todo comentado):

| Tabela | Para quê |
|---|---|
| `cursos` | Curso e carga horária mínima |
| `curso_categoria_metas` | **Nova.** Meta visual de horas por categoria em cada curso (ex.: Ensino 60 h) |
| `usuarios` | Todos os perfis numa tabela. **Sem senha.** `curso_id` = curso do aluno ou curso que o coordenador coordena |
| `categorias` | **Ensino, Pesquisa, Extensão** (antes eram 6 categorias misturadas) |
| `tipos_atividade` | **Nova.** Evento, Minicurso, Workshop, Curso, Estágio, Monitoria, Projeto, Voluntariado, Publicação, Visita técnica, Outro |
| `atividades` | Catálogo. Ganhou `tipo_id` e `imagem_url` (imagem do card) |
| `atividade_cursos` | Cursos para os quais a atividade é recomendada |
| `submissoes` | Pedidos de validação de horas (`atividade_id` vazio = atividade externa) |
| `comprovantes` | Arquivos enviados |
| `avaliacoes` | Histórico das decisões do coordenador |

A tabela `sessoes` foi removida junto com o login.

Regras garantidas pelo próprio MySQL (CHECK, na migração): submissão APROVADA precisa de horas
aprovadas, horas aprovadas ≤ solicitadas, REJEITADA precisa de justificativa, horas e cargas > 0,
término ≥ início. Registros usados no histórico não podem ser apagados: as chaves estrangeiras usam RESTRICT.

**Mudar o banco depois:** edite `schema.prisma` e rode `npm run db:migrate:dev -- --name descricao`.
O Prisma gera a nova migração e as restrições CHECK existentes continuam no banco.

## 7. API

Base: `http://localhost:3000/api`. JSON nas requisições e respostas. Datas em ISO 8601 (UTC).

| Método | Rota | Quem pode | O que faz |
|---|---|---|---|
| GET | `/saude` | público | API e banco no ar |
| GET | `/usuarios/me` | identificado | Dados do usuário e do curso |
| GET | `/categorias` | público | Categorias ativas (`?incluirInativas=true` só ADMINISTRADOR) |
| GET | `/tipos-atividade` | público | Tipos ativos (`?incluirInativos=true` só ADMINISTRADOR) |
| GET | `/cursos` | público | Cursos ativos, carga mínima e metas por categoria |
| GET | `/atividades` | público | Catálogo com filtros e paginação |
| GET | `/atividades/:id` | público | Detalhe de uma atividade |
| POST | `/atividades` | ORGANIZADOR, ADMINISTRADOR | Cria (o organizador é quem cria) |
| PATCH | `/atividades/:id` | dono ou ADMINISTRADOR | Edita só os campos enviados |
| DELETE | `/atividades/:id` | dono ou ADMINISTRADOR | **Cancela** (não apaga) |
| GET | `/progresso` | ALUNO | Progresso do próprio aluno |
| GET | `/progresso/:matricula` | o próprio ALUNO; COORDENADOR (só alunos do seu curso); ADMINISTRADOR | Progresso de um aluno |

### 7.1 GET /atividades — filtros

Todos opcionais, na query string:

| Parâmetro | Exemplo | Efeito |
|---|---|---|
| `busca` | `workshop` | Título, descrição, categoria ou tipo (sem diferenciar maiúsculas/acentos) |
| `categoriaId`, `tipoId` | `2` | Botões Ensino/Pesquisa/Extensão e Eventos/Minicursos/Workshops |
| `modalidade` | `ONLINE` | `PRESENCIAL`, `ONLINE` ou `HIBRIDA` |
| `de`, `ate` | `2026-11-01` | Período da data de início (AAAA-MM-DD, horário de Fortaleza) |
| `cargaMin`, `cargaMax` | `4` | Faixa de carga horária |
| `cursoId` | `1` | Só as recomendadas para esse curso |
| `compativeis` | `true` | Só as recomendadas para o curso de quem está identificado |
| `situacao` | `passadas` | `futuras` (padrão: ainda vão acontecer ou em andamento), `passadas` ou `todas` |
| `incluirCanceladas` | `true` | Inclui canceladas (padrão: não) |
| `minhas` | `true` | Só as do organizador identificado |
| `pagina`, `porPagina` | `1`, `20` | Paginação (máx. 100 por página) |

Por padrão, a lista vem da atividade mais próxima para a mais distante. Resposta:

```json
{
  "atividades": [{
    "id": 1,
    "titulo": "Workshop de Desenvolvimento Web",
    "descricao": "Fundamentos do desenvolvimento web...",
    "categoria": { "id": 3, "nome": "Extensão" },
    "tipo": { "id": 3, "nome": "Workshop" },
    "modalidade": "PRESENCIAL",
    "dataInicio": "2026-10-29T17:00:00.000Z",
    "dataFim": "2026-10-29T21:00:00.000Z",
    "local": "Auditório Central",
    "link": null,
    "imagemUrl": null,
    "cargaHoraria": 4,
    "prazoInscricao": "2026-10-28T02:59:00.000Z",
    "vagas": 80,
    "inscricaoInfo": "Inscrições pelo formulário do evento.",
    "contato": null,
    "organizador": { "id": 3, "nome": "Organizadora de Eventos" },
    "status": "ATIVA",
    "motivoCancelamento": null,
    "situacao": "FUTURA",
    "inscricoesAbertas": true,
    "cursosRecomendados": [{ "id": 1, "nome": "Ciência da Computação" }],
    "recomendadaParaVoce": true,
    "criadoEm": "...",
    "atualizadoEm": "..."
  }],
  "paginacao": { "pagina": 1, "porPagina": 20, "total": 4, "totalPaginas": 1 }
}
```

- `situacao`: `FUTURA`, `EM_ANDAMENTO`, `ENCERRADA` ou `CANCELADA`, calculada na hora.
- `recomendadaParaVoce`: `true`/`false` quando quem consulta tem curso; `null` sem identificação.
  Serve para **destacar**: as demais atividades continuam aparecendo.
- O card mostra **Data** e **Horário** separados: o React formata `dataInicio` no fuso local
  (ex.: `new Date(dataInicio).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })`).

### 7.2 POST /atividades e PATCH /atividades/:id

```json
{
  "titulo": "Workshop de Desenvolvimento Web",
  "descricao": "Fundamentos do desenvolvimento web com projetos práticos.",
  "categoriaId": 3,
  "tipoId": 3,
  "modalidade": "PRESENCIAL",
  "dataInicio": "2026-11-10T14:00",
  "dataFim": "2026-11-10T18:00",
  "local": "Auditório Central",
  "cargaHoraria": 4,
  "vagas": 80,
  "prazoInscricao": "2026-11-08T23:59",
  "inscricaoInfo": "Inscrições pelo formulário do evento.",
  "contato": "eventos@exemplo.edu",
  "link": null,
  "imagemUrl": "https://exemplo.edu/banner.jpg",
  "cursoIds": [1]
}
```

| Regra | Detalhe |
|---|---|
| Obrigatórios | `titulo` (3–200), `descricao` (10–5000), `categoriaId`, `tipoId`, `modalidade`, `dataInicio`, `cargaHoraria` |
| Datas | Sem fuso (`2026-11-10T14:00`) = horário de Fortaleza (`FUSO_HORARIO`). `dataFim` ≥ `dataInicio`; `prazoInscricao` ≤ fim da atividade |
| Local e link | PRESENCIAL/HIBRIDA exigem `local`; ONLINE exige `link` ou `local` (ex.: "Microsoft Teams"). URLs só `http(s)` |
| Carga horária | > 0, até 999,99, no máximo 2 casas decimais |
| Referências | Categoria, tipo e cursos precisam existir e estar ativos |
| Ignorados | `organizadorId`, `status`, `id` (o organizador é sempre quem cria) |

No **PATCH** só os campos enviados mudam. Mande `null` para limpar um campo opcional.
`cursoIds` substitui a lista inteira. Atividade cancelada não pode ser editada (**409**).

### 7.3 DELETE /atividades/:id — cancelar

Corpo opcional: `{ "motivo": "Palestrante indisponível" }`. A atividade fica com
`status: "CANCELADA"`, sai do catálogo padrão, mas continua consultável e ligada às submissões.
Cancelar de novo dá **409**.

### 7.4 GET /progresso

```json
{
  "aluno": { "id": 4, "matricula": "DEMOALU01", "nome": "Aluno Exemplo" },
  "curso": { "id": 1, "nome": "Ciência da Computação" },
  "horas": { "minima": 200, "concluidas": 125, "pendentes": 8, "restantes": 75 },
  "percentualConcluido": 62.5,
  "cargaHorariaCumprida": false,
  "porCategoria": [
    { "categoria": { "id": 1, "nome": "Ensino" },   "horasConcluidas": 40, "horasPendentes": 0, "meta": 60, "percentualMeta": 66.7 },
    { "categoria": { "id": 3, "nome": "Extensão" }, "horasConcluidas": 50, "horasPendentes": 8, "meta": 90, "percentualMeta": 55.6 },
    { "categoria": { "id": 2, "nome": "Pesquisa" }, "horasConcluidas": 35, "horasPendentes": 0, "meta": 50, "percentualMeta": 70 }
  ],
  "submissoes": { "pendentes": 1, "aprovadas": 4, "rejeitadas": 1, "aguardandoCorrecao": 1 },
  "calculadoEm": "2026-10-22T21:34:18.000Z"
}
```

**Fórmulas:**

- concluídas = soma das horas **aprovadas** das submissões APROVADAS (horas pendentes **não** contam);
- pendentes = soma das horas **solicitadas** das submissões PENDENTES;
- restantes = máximo(0, mínima − concluídas), **nunca negativo**;
- percentual = mínimo(100, concluídas ÷ mínima × 100), com 1 casa decimal, **nunca passa de 100**;
- por categoria: as mesmas somas por Ensino/Pesquisa/Extensão.

A **meta por categoria é só visual** (decisão do grupo): ela não limita as horas que contam nem
impede a conclusão. Curso sem meta cadastrada → `meta: null`.

Nada disso é gravado no banco: é recalculado a cada consulta. Se a carga mínima do curso mudar, o
progresso muda na hora, sem alterar as horas aprovadas.

### 7.5 Formato de erro

```json
{ "erro": { "codigo": "DADOS_INVALIDOS", "mensagem": "Verifique os dados enviados.",
            "detalhes": { "campos": { "local": "Informe o local para atividades presenciais ou híbridas." } } } }
```

| Status | Quando |
|---|---|
| 400 | Dados ou filtros inválidos (`detalhes.campos` traz o erro de cada campo) |
| 401 | Rota exige identificação, ou matrícula inválida/inexistente/inativa |
| 403 | Perfil sem permissão, ou registro de outra pessoa |
| 404 | Não encontrado |
| 409 | Conflito (já cancelada, duplicado, aluno sem curso) |
| 500 | Erro inesperado (mensagem genérica; o detalhe fica só no log do servidor) |

## 8. Como o React deve usar

```js
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
// Provisório: matrícula escolhida numa tela de "trocar usuário" de desenvolvimento.
const matricula = localStorage.getItem('matriculaDev');

export async function api(caminho, opcoes = {}) {
  const r = await fetch(`${API}${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      ...(matricula ? { 'X-Matricula': matricula } : {}),
      ...opcoes.headers,
    },
  });
  const dados = r.status === 204 ? null : await r.json();
  if (!r.ok) throw dados.erro; // { codigo, mensagem, detalhes }
  return dados;
}

// Dashboard
const progresso = await api('/progresso');
// Atividades Disponíveis: botão "Extensão" + busca
const { atividades } = await api(`/atividades?categoriaId=3&busca=${encodeURIComponent(texto)}`);
```

- A origem do Vite (`http://localhost:5173`) já está liberada em `CORS_ORIGINS`.
- Os botões Ensino/Pesquisa/Extensão usam `GET /categorias`; Eventos/Minicursos/Workshops usam `GET /tipos-atividade`.
- Para mostrar o menu certo (ex.: "Painel do Coordenador"), use `usuario.perfil` de `GET /usuarios/me`.
  Isso é só conveniência: **a API confere o perfil em toda operação**.

## 9. Decisões técnicas desta etapa

| Decisão | Por quê |
|---|---|
| **Prisma 6** (não o 7) | O Prisma 7 exige TypeScript/ES Modules e configuração extra. O 6 funciona direto com o `require` (CommonJS) que o projeto já usa. Dá para migrar depois. |
| **Migração inicial escrita à mão + CHECK** | O Prisma não representa CHECK no schema. A migração cria exatamente o que o `schema.prisma` descreve e acrescenta as restrições CHECK, que o Prisma mantém nas migrações seguintes. |
| **Login removido; identificação em um só arquivo** | O sistema usa o login da Unifor. Enquanto a integração não existe, o cabeçalho `X-Matricula` permite testar, e é proibido em produção. |
| **AVALIADOR virou COORDENADOR** | Mesmo nome das telas ("Painel do Coordenador"). |
| **Coordenador ligado a um curso** | A tela diz "estudantes do seu curso": o coordenador só vê o progresso dos alunos do curso dele. |
| **Categoria ≠ tipo** | Categoria (Ensino, Pesquisa, Extensão) define as horas por categoria; tipo (Evento, Workshop...) serve para filtrar. |
| **Metas por categoria só visuais** | Decisão do grupo. Ficam numa tabela própria por curso, para a coordenação ajustar. |
| **DELETE = cancelar** | Mantém o histórico e as submissões ligadas à atividade. |
| **Organizador só altera as próprias atividades** | Administrador altera qualquer uma. Coordenador não cria atividades (para liberar, basta incluir `COORDENADOR` em `PODEM_GERENCIAR_ATIVIDADES`, em `src/config/perfis.js`). |
| **Decimal convertido para número** | O Prisma devolve `Decimal` como texto no JSON (`"4.00"`). A API converte para número (`4`) e soma em centésimos para não acumular erro de arredondamento. |
| **Datas sem fuso = Fortaleza** | Evita que "14:00" digitado no formulário vire 11:00. Configurável em `FUSO_HORARIO`. |

## 10. Limitações e pendências

- **Integração com o login da Unifor:** não existe ainda. A API não deve ir para produção até
  `src/middlewares/identificacao.js` ler a identidade real.
- **Usuários:** também virão da base da Unifor. Por enquanto são criados com `npm run usuario:criar`.
- **Imagem da atividade:** é só um endereço (`imagemUrl`). Ainda não há upload de imagem.
- **Status "Em análise"**, que aparece no Painel do Coordenador, ainda não existe. Hoje os status
  são PENDENTE, APROVADA e REJEITADA; ele entra quando as rotas do painel forem feitas.
- **Gestão de categorias, tipos, cursos e metas** pela API ainda não foi feita (só leitura).
  Por enquanto, use `npm run db:studio`.
