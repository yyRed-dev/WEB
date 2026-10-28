# WEB
Portal web para os alunos acompanharem suas **horas complementares**: consultar atividades
disponíveis, enviar certificados de atividades externas e ver o progresso em relação à carga
horária exigida pelo curso. O coordenador avalia os certificados enviados pelos alunos do seu curso.

O sistema será entregue **dentro do ambiente da Unifor**, que já faz o login dos usuários.

Este repositório guarda as duas partes do projeto:

| Parte | Pasta | Tecnologias |
|---|---|---|
| **Backend** (API REST) | raiz do repositório | Node.js, Express 5, Prisma 6, MySQL 8 |
| **Frontend** | [`frontend/`](frontend/) | React 19, Vite 8, Bootstrap 5, React Router 7 |

## Situação atual

| Parte | Pronto | Próximos passos |
|---|---|---|
| Backend | Banco com Prisma, CRUD de atividades, categorias/tipos/cursos, progresso de horas por categoria, 90 testes automatizados | Envio de certificados (submissões), Painel do Coordenador, integração com o login da Unifor |
| Frontend | Projeto Vite, cabeçalho institucional, tema e as 5 rotas das telas | Construir as telas e ligá-las à API ([seção 9](#9-integração-com-o-frontend)) |

---

## Sumário

1. [Estrutura do repositório](#1-estrutura-do-repositório)
2. [Requisitos](#2-requisitos)
3. [Como rodar o projeto](#3-como-rodar-o-projeto)
4. [Identificação do usuário (no lugar do login)](#4-identificação-do-usuário-no-lugar-do-login)
5. [Testes automatizados](#5-testes-automatizados)
6. [Banco de dados](#6-banco-de-dados)
7. [API](#7-api)
8. [Organização do backend](#8-organização-do-backend)
9. [Integração com o frontend](#9-integração-com-o-frontend)
10. [Decisões técnicas](#10-decisões-técnicas)
11. [Limitações e pendências](#11-limitações-e-pendências)

---

## 1. Estrutura do repositório

```
WEB/
├── frontend/              ← aplicação React (tem package.json próprio)
│   ├── src/
│   │   ├── pages/         Dashboard, Activities, SubmitCertificate, MySubmissions, Coordinator
│   │   ├── components/    layout/InstitutionalHeader.jsx
│   │   └── styles/        theme.css
│   ├── index.html
│   └── vite.config.js
│
├── prisma/                ← BACKEND: modelo de dados, migrações e dados iniciais
├── scripts/               ← BACKEND: criar usuários, rodar testes
├── src/                   ← BACKEND: código da API
├── tests/                 ← BACKEND: testes automatizados
├── package.json           ← dependências do BACKEND
└── .env.example           ← configuração do BACKEND
```

São **dois projetos Node independentes**, cada um com o próprio `package.json` e o próprio
`node_modules`. Os comandos `npm` do backend rodam na **raiz**; os do frontend, dentro de `frontend/`.

## 2. Requisitos

- **Node.js 22 LTS** (mínimo 20.19 ou 22.12, exigido pelo Vite 8 do frontend)
- **MySQL 8.0** ou superior (só para o backend)
- Git

## 3. Como rodar o projeto

Para desenvolver é preciso deixar **dois terminais abertos**: um com a API, outro com o frontend.

### 3.1 Backend (terminal 1, na raiz)

```bash
npm install                # instala as dependências e roda `prisma generate`
cp .env.example .env       # depois ajuste DATABASE_URL e DATABASE_URL_TEST
```

**Usuário do MySQL.** No cliente MySQL (como root), crie um usuário para o projeto. Ele precisa
poder criar bancos, porque o Prisma usa um banco temporário ("shadow database") no `migrate dev`
e o `npm test` recria o banco de testes:

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

**Tabelas e dados:**

```bash
npm run db:migrate   # aplica as migrações e cria as 10 tabelas
                     # (se o Prisma disser que o banco não existe:
                     #  CREATE DATABASE portal_atividades CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;)
npm run db:seed      # categorias (Ensino, Pesquisa, Extensão) e tipos de atividade
npm run db:demo      # OPCIONAL: cursos, usuários, atividades e submissões FICTÍCIOS
```

**Subir a API:**

```bash
npm run dev          # reinicia sozinho ao salvar um arquivo
```

Teste rápido: abra `http://localhost:3000/api/saude` → `{"status":"ok","banco":"ok"}`.

Para ver e editar os dados numa interface gráfica: `npm run db:studio` (Prisma Studio).

### 3.2 Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev          # abre em http://localhost:5173
```

A API já aceita chamadas dessa origem (`CORS_ORIGINS` no `.env` do backend).

### 3.3 Dados de demonstração

O `npm run db:demo` reproduz o dashboard das telas: o aluno `DEMOALU01` tem 125 h aprovadas de
200 h (Ensino 40/60, Pesquisa 35/50, Extensão 50/90), uma submissão pendente e uma rejeitada
aguardando correção. Todos os registros levam o prefixo `[DEMO]`, e o comando se recusa a rodar
com `NODE_ENV=production`.

| Perfil        | Matrícula   |
|---------------|-------------|
| ADMINISTRADOR | `DEMOADM01` |
| COORDENADOR   | `DEMOCOO01` (curso [DEMO] Ciência da Computação) |
| ORGANIZADOR   | `DEMOORG01` |
| ALUNO         | `DEMOALU01` (Ciência da Computação), `DEMOALU02` (Sistemas de Informação) |

### 3.4 Cadastrar usuários (enquanto não há integração com a Unifor)

```bash
npm run usuario:criar -- --matricula ADM0001 --nome "Maria Souza" --perfil ADMINISTRADOR
npm run usuario:criar -- --matricula 2023104567 --nome "Lucas Souza" --perfil ALUNO --curso-id 1
npm run usuario:criar -- --matricula COO0001 --nome "Coordenação CC" --perfil COORDENADOR --curso-id 1
```

Se a matrícula já existir, o comando atualiza o perfil e o curso.

### 3.5 Comandos do backend

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe a API e reinicia ao salvar |
| `npm start` | Sobe a API |
| `npm test` | Recria o banco de testes e roda os testes |
| `npm run db:migrate` | Aplica as migrações pendentes |
| `npm run db:migrate:dev -- --name descricao` | Gera uma nova migração depois de editar o `schema.prisma` |
| `npm run db:seed` | Categorias e tipos de atividade |
| `npm run db:demo` | Dados fictícios de demonstração |
| `npm run db:studio` | Interface gráfica do banco |
| `npm run usuario:criar` | Cria ou promove um usuário |

## 4. Identificação do usuário (no lugar do login)

O portal ficará dentro do sistema da Unifor, que já faz o login. **A API não tem cadastro, login
nem senha.** Ainda não se sabe como a Unifor vai informar quem é o usuário, então toda essa lógica
fica em **um único arquivo**: `src/middlewares/identificacao.js`.

**Por enquanto (só desenvolvimento e testes)**, o usuário é identificado pelo cabeçalho HTTP:

```
X-Matricula: DEMOALU01
```

- Sem o cabeçalho, só as rotas públicas funcionam.
- Matrícula inexistente ou usuário inativo → **401**.
- O **perfil sempre vem do banco**, nunca da requisição.
- Qualquer pessoa pode mandar esse cabeçalho, então ele **não protege nada**. Por isso a API
  **se recusa a iniciar** com `NODE_ENV=production` e `IDENTIFICACAO_MODO=cabecalho`.

**Quando a integração existir**, só a função `identificarUsuario` muda (ler o token ou cookie da
Unifor e achar o usuário pela matrícula). As rotas e regras continuam iguais, e o frontend deixa
de enviar o `X-Matricula`.

## 5. Testes automatizados

Na raiz:

```bash
npm test
```

O comando:

1. usa `DATABASE_URL_TEST` (o nome do banco precisa terminar em `_test`);
2. **apaga e recria** esse banco com as migrações (`prisma migrate reset`);
3. roda os testes com o executor nativo do Node (`node:test`).

São **90 testes em 6 arquivos**:

| Arquivo | O que cobre |
|---|---|
| `calculoProgresso.test.js` | Fórmulas do progresso (unitário, sem banco) |
| `identificacao.test.js` | Cabeçalho X-Matricula, 401/403, modo produção, rotas de login removidas |
| `catalogo.test.js` | GET de categorias, tipos e cursos |
| `atividades.test.js` | Criar, listar com filtros, detalhar, editar e cancelar; permissões e validações |
| `progresso.test.js` | Horas concluídas, pendentes, restantes e por categoria; quem vê o quê |
| `banco.test.js` | UNIQUE, chaves estrangeiras e restrições CHECK do próprio MySQL |

O frontend ainda não tem testes automatizados.

## 6. Banco de dados

O modelo está em `prisma/schema.prisma`, comentado campo a campo. São 10 tabelas:

| Tabela | Para quê |
|---|---|
| `cursos` | Curso e carga horária mínima |
| `curso_categoria_metas` | Meta visual de horas por categoria em cada curso (ex.: Ensino 60 h) |
| `usuarios` | Todos os perfis numa tabela, **sem senha**. `curso_id` = curso do aluno ou curso que o coordenador coordena |
| `categorias` | Ensino, Pesquisa, Extensão |
| `tipos_atividade` | Evento, Minicurso, Workshop, Curso, Estágio, Monitoria, Projeto, Voluntariado, Publicação, Visita técnica, Outro |
| `atividades` | Catálogo de atividades (com `imagem_url` para o card) |
| `atividade_cursos` | Cursos para os quais a atividade é recomendada |
| `submissoes` | Pedidos de validação de horas (`atividade_id` vazio = atividade externa) |
| `comprovantes` | Arquivos de certificado enviados |
| `avaliacoes` | Histórico das decisões do coordenador |

O próprio MySQL garante as regras críticas (restrições CHECK na migração):
- submissão APROVADA precisa de horas aprovadas;
- horas aprovadas ≤ horas solicitadas;
- submissão REJEITADA precisa de justificativa;
- horas e cargas horárias > 0;
- data de término ≥ data de início.

Registros usados no histórico não podem ser apagados (chaves estrangeiras com RESTRICT).

**Para mudar o banco:** edite `schema.prisma` e rode `npm run db:migrate:dev -- --name descricao`.
O Prisma gera a nova migração, e as restrições CHECK existentes continuam no banco.

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
| `busca` | `workshop` | Título, descrição, categoria ou tipo (sem diferenciar maiúsculas e acentos) |
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
`status: "CANCELADA"` e sai do catálogo padrão, mas continua consultável e ligada às submissões.
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
- por categoria: as mesmas somas, separadas em Ensino, Pesquisa e Extensão.

A **meta por categoria é só visual**: ela não limita as horas que contam nem impede a conclusão.
Curso sem meta cadastrada → `meta: null`.

Nada disso é gravado no banco: tudo é recalculado a cada consulta. Se a carga mínima do curso
mudar, o progresso muda na hora, sem alterar as horas aprovadas.

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

## 8. Organização do backend

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

## 9. Integração com o frontend

### 9.1 Qual tela usa qual rota

| Tela (rota do React) | Página | Endpoints da API |
|---|---|---|
| Dashboard — `/atividades-complementares/dashboard` | `Dashboard.jsx` | `GET /usuarios/me`, `GET /progresso`, `GET /atividades?compativeis=true&porPagina=3` |
| Atividades Disponíveis — `/atividades-complementares/atividades` | `Activities.jsx` | `GET /atividades` (filtros), `GET /categorias`, `GET /tipos-atividade`, `GET /atividades/:id` |
| Enviar Certificado — `/atividades-complementares/certificados/enviar` | `SubmitCertificate.jsx` | `GET /categorias`, `GET /atividades?situacao=todas` · envio: **a fazer** |
| Minhas Submissões — `/atividades-complementares/submissoes` | `MySubmissions.jsx` | **a fazer** (próxima sprint do backend) |
| Painel do Coordenador — `/atividades-complementares/coordenador` | `Coordinator.jsx` | `GET /progresso/:matricula` · lista e avaliação: **a fazer** |

### 9.2 Chamando a API

Sugestão de um arquivo único para as chamadas, por exemplo `frontend/src/services/api.js`:

```js
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export async function api(caminho, opcoes = {}) {
  // Provisório (só desenvolvimento): matrícula do usuário de teste.
  // Some quando a integração com o login da Unifor existir.
  const matricula = localStorage.getItem('matriculaDev') ?? 'DEMOALU01';

  const resposta = await fetch(`${API}${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      'X-Matricula': matricula,
      ...opcoes.headers,
    },
  });
  const dados = resposta.status === 204 ? null : await resposta.json();
  if (!resposta.ok) throw dados.erro; // { codigo, mensagem, detalhes }
  return dados;
}

// Exemplos
// const progresso = await api('/progresso');
// const { atividades } = await api(`/atividades?categoriaId=3&busca=${encodeURIComponent(texto)}`);
```

Para apontar o frontend para outro endereço da API, crie `frontend/.env.local` (não vai para o Git):

```
VITE_API_URL=http://localhost:3000/api
```

### 9.3 Dicas

- **Datas:** a API devolve tudo em UTC. Para mostrar Data e Horário separados nos cards:
  `new Date(a.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' })` e
  `toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit' })`.
- **Filtros da tela de atividades:** os botões Ensino/Pesquisa/Extensão vêm de `GET /categorias`;
  Eventos/Minicursos/Workshops vêm de `GET /tipos-atividade`. Não fixe os ids no código.
- **Menu por perfil:** use `usuario.perfil` de `GET /usuarios/me` para mostrar ou esconder o
  "Painel do Coordenador". Isso é só conveniência: a API confere o perfil em toda operação.
- **Erros de formulário:** `erro.detalhes.campos` traz a mensagem de cada campo, pronta para
  mostrar embaixo do input.
- **Trocar de usuário em testes:** `localStorage.setItem('matriculaDev', 'DEMOCOO01')` no console
  do navegador e recarregue a página.

## 10. Decisões técnicas

| Decisão | Por quê |
|---|---|
| **Backend e frontend no mesmo repositório** | Projeto pequeno e mesma equipe: uma alteração que mexe nos dois lados vai num único Pull Request. Cada parte mantém o próprio `package.json`. |
| **Prisma 6** (não o 7) | O Prisma 7 exige TypeScript/ES Modules e configuração extra. O 6 funciona direto com o `require` (CommonJS) do backend. Dá para migrar depois. |
| **Migração inicial com restrições CHECK** | O Prisma não representa CHECK no schema. A migração cria o que o `schema.prisma` descreve e acrescenta as restrições, que o Prisma mantém nas migrações seguintes. |
| **Sem login próprio; identificação em um só arquivo** | O sistema usa o login da Unifor. Até a integração, o cabeçalho `X-Matricula` permite testar, e ele é proibido em produção. |
| **Perfil COORDENADOR ligado a um curso** | A tela diz "estudantes do seu curso": o coordenador só vê o progresso dos alunos do curso dele. |
| **Categoria ≠ tipo** | Categoria (Ensino, Pesquisa, Extensão) define as horas por categoria; tipo (Evento, Workshop...) serve para filtrar. |
| **Metas por categoria só visuais** | Decisão do grupo. Ficam numa tabela própria por curso, para a coordenação ajustar. |
| **DELETE = cancelar** | Mantém o histórico e as submissões ligadas à atividade. |
| **Organizador só altera as próprias atividades** | Administrador altera qualquer uma. Coordenador não cria atividades; para liberar, inclua `COORDENADOR` em `PODEM_GERENCIAR_ATIVIDADES`, em `src/config/perfis.js`. |
| **Decimal convertido para número** | O Prisma devolve `Decimal` como texto no JSON (`"4.00"`). A API converte para número (`4`) e soma em centésimos para não acumular erro de arredondamento. |
| **Datas sem fuso = Fortaleza** | Evita que "14:00" digitado no formulário vire 11:00. Configurável em `FUSO_HORARIO`. |

## 11. Limitações e pendências

- **Login da Unifor:** a integração ainda não existe. O sistema não deve ir para produção até
  `src/middlewares/identificacao.js` ler a identidade real.
- **Usuários:** também virão da base da Unifor. Por enquanto são criados com `npm run usuario:criar`.
- **Envio de certificados, Minhas Submissões e Painel do Coordenador:** as tabelas existem, mas as
  rotas da API são da próxima sprint.
- **Status "Em análise"**, que aparece no Painel do Coordenador, ainda não existe. Hoje os status
  são PENDENTE, APROVADA e REJEITADA.
- **Imagem da atividade:** é só um endereço (`imagemUrl`). Ainda não há upload de imagem.
- **Gestão de categorias, tipos, cursos e metas** pela API ainda não foi feita (só leitura).
  Por enquanto, use `npm run db:studio`.
