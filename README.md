# WEB
Portal web para os alunos acompanharem suas **horas complementares**: consultar atividades
disponíveis, enviar certificados de atividades externas e ver o progresso em relação à carga
horária exigida pelo curso. O coordenador avalia os certificados enviados pelos alunos do seu curso
e cadastra as atividades do catálogo.

O sistema será entregue **dentro do ambiente da Unifor**, e a matrícula do portal é a mesma da
Unifor. Enquanto a integração com o login da Unifor não existe, o portal tem um **login de teste**
próprio (matrícula e senha), e o usuário é identificado pelo cabeçalho `X-Matricula`.

Este repositório guarda as duas partes do projeto:

| Parte | Pasta | Tecnologias |
|---|---|---|
| **Backend** (API REST) | raiz do repositório | Node.js, Express 5, Prisma 6, MySQL 8, Multer (upload) |
| **Frontend** | [`frontend/`](frontend/) | React 19, Vite 8, Bootstrap 5, React Router 7 |

## Perfis de usuário

O sistema tem **apenas dois perfis**:

| Perfil | O que faz |
|---|---|
| **ALUNO** | Consulta atividades, envia certificados, acompanha as próprias submissões e o progresso de horas |
| **COORDENADOR** | Avalia (aprova/rejeita) os certificados dos alunos do **curso que coordena**; cadastra atividades do catálogo e edita/cancela **só as que ele cadastrou** |

Alunos criam a própria conta na tela de cadastro. Contas de coordenador só são criadas no
servidor (`npm run usuario:criar`), nunca pelo cadastro público.

## Situação atual

| Parte | Pronto | Próximos passos |
|---|---|---|
| Backend | Login de teste, cadastro de aluno, envio de certificado com upload, Minhas Submissões, Painel do Coordenador (aprovar/rejeitar), CRUD de atividades pelo coordenador, progresso de horas por categoria, 138 testes automatizados | Correção/reenvio de submissão rejeitada, integração com o login da Unifor |
| Frontend | Todas as telas, login e cadastro simulados, menu por perfil; Dashboard, Atividades e Gerenciar Atividades já usam a API | Trocar login/cadastro simulados pela API e ligar Enviar Certificado, Minhas Submissões e Painel ([seção 9](#9-integração-com-o-frontend)) |

---

## Sumário

1. [Estrutura do repositório](#1-estrutura-do-repositório)
2. [Requisitos](#2-requisitos)
3. [Como rodar o projeto](#3-como-rodar-o-projeto)
4. [Login e identificação do usuário](#4-login-e-identificação-do-usuário)
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
│   └── src/
│       ├── pages/         Login, Register, Dashboard, Activities, SubmitCertificate,
│       │                  MySubmissions, Coordinator, ManageActivities, NotFound
│       ├── components/    layout/ (cabeçalho, menu por perfil, breadcrumb)
│       ├── services/      api.js (chamadas à API), auth.js (login/cadastro)
│       └── styles/        theme.css
│
├── prisma/                ← BACKEND: modelo de dados, migrações e dados iniciais
├── scripts/               ← BACKEND: criar usuários, rodar testes
├── src/                   ← BACKEND: código da API
├── tests/                 ← BACKEND: testes automatizados
├── uploads/               ← BACKEND: certificados enviados (criada sozinha; fora do Git)
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
npm run db:migrate   # aplica as migrações (10 tabelas)
                     # (se o Prisma disser que o banco não existe:
                     #  CREATE DATABASE portal_atividades CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;)
npm run db:seed      # categorias (Ensino, Pesquisa, Extensão) e tipos de atividade
npm run db:demo      # OPCIONAL: contas de teste, atividades e submissões FICTÍCIAS
```

> **Quem já tinha o banco da versão anterior:** basta rodar `npm run db:migrate`. A nova migração
> transforma contas ORGANIZADOR/ADMINISTRADOR em COORDENADOR e mantém os dados. Para ter as contas
> de teste com senha, rode `npm run db:demo` de novo. Para começar do zero:
> `npx prisma migrate reset` (apaga tudo) e depois `npm run db:demo`.

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

### 3.3 Contas de teste (`npm run db:demo`)

Todas com a senha **`demo1234`**. São fictícias e se recusam a ser criadas com `NODE_ENV=production`.

| Perfil | Matrícula | Curso | O que tem |
|---|---|---|---|
| ALUNO | `DEMOALU01` | [DEMO] Ciência da Computação | 125 h aprovadas de 200 h (Ensino 40/60, Pesquisa 35/50, Extensão 50/90), 1 pendente, 1 rejeitada |
| ALUNO | `DEMOALU02` | [DEMO] Ciência da Computação | 2 submissões pendentes |
| ALUNO | `DEMOALU03` | [DEMO] Sistemas de Informação | 1 submissão pendente |
| COORDENADOR | `DEMOCOO01` | [DEMO] Ciência da Computação | Vê as submissões de DEMOALU01 e DEMOALU02; cadastrou as atividades de exemplo (só ele pode editá-las) |
| COORDENADOR | `DEMOCOO02` | [DEMO] Sistemas de Informação | Vê as submissões de DEMOALU03 |

Os certificados das submissões de exemplo são PDFs fictícios gerados pelo próprio script.

### 3.4 Criar contas pela linha de comando

```bash
npm run usuario:criar -- --matricula COO0001 --nome "Coordenação CC" --perfil COORDENADOR --curso-id 1
npm run usuario:criar -- --matricula 2023104567 --nome "Lucas Souza" --perfil ALUNO --curso-id 1
```

A senha é pedida no terminal, sem aparecer na tela. Se a matrícula já existir, o comando atualiza o
perfil, o curso e a senha. O `--curso-id` é obrigatório: para o aluno é o curso dele; para o
coordenador é o curso que ele coordena (sem curso, ele não vê nenhuma submissão).

### 3.5 Comandos do backend

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe a API e reinicia ao salvar |
| `npm start` | Sobe a API |
| `npm test` | Recria o banco de testes e roda os testes |
| `npm run db:migrate` | Aplica as migrações pendentes |
| `npm run db:migrate:dev -- --name descricao` | Gera uma nova migração depois de editar o `schema.prisma` |
| `npm run db:seed` | Categorias e tipos de atividade |
| `npm run db:demo` | Contas de teste e dados fictícios |
| `npm run db:studio` | Interface gráfica do banco |
| `npm run usuario:criar` | Cria ou atualiza uma conta (aluno ou coordenador) |

## 4. Login e identificação do usuário

**Decisão do grupo: sem token, só `X-Matricula`.** A matrícula do portal é a mesma da Unifor.

**Como funciona:**

1. A tela de login chama `POST /api/auth/login` com matrícula e senha. A API confere a senha e
   devolve os dados do usuário: nome, matrícula, perfil e curso.
2. O front guarda esses dados e, em todas as requisições seguintes, envia o cabeçalho:
   ```
   X-Matricula: DEMOALU01
   ```
3. A API busca o usuário por essa matrícula a cada requisição. O **perfil sempre vem do banco**,
   nunca da requisição: se a conta for desativada ou mudar de perfil, isso vale na hora.
4. Para sair, o front só apaga os dados guardados. Não existe rota de logout, porque não há sessão.

O login de teste segue as boas práticas que cabem nele:

- senha guardada só como **hash bcrypt**, nunca em texto;
- mesma resposta para matrícula inexistente e senha errada, para ninguém descobrir quem tem conta;
- **bloqueio por 15 minutos** depois de 5 senhas erradas (resposta 429).

> ⚠️ **Limitação desta decisão:** a API confia em quem mandar o cabeçalho `X-Matricula`. Quem
> souber a matrícula de outra pessoa consegue se passar por ela chamando a API direto (Postman,
> curl), sem a senha. Para o protótipo e a apresentação isso é aceitável. Em produção, esse
> cabeçalho deve ser preenchido pelo **portal da Unifor**, depois do login dela, e nunca direto
> pelo navegador. A API avisa isso no terminal ao iniciar com `NODE_ENV=production`.

Toda a identificação fica em **um único arquivo**: `src/middlewares/identificacao.js`. Quando a
integração com a Unifor for definida, só ele muda. As rotas e as regras continuam iguais.

**Modos (`IDENTIFICACAO_MODO` no `.env`):** `cabecalho` (padrão, lê `X-Matricula`) ou `nenhum`
(ninguém é identificado; só as rotas públicas funcionam).

## 5. Testes automatizados

Na raiz:

```bash
npm test
```

O comando:

1. usa `DATABASE_URL_TEST` (o nome do banco precisa terminar em `_test`);
2. **apaga e recria** esse banco com as migrações (`prisma migrate reset`);
3. roda os testes com o executor nativo do Node (`node:test`), com uploads numa pasta temporária.

São **138 testes em 9 arquivos**:

| Arquivo | Testes | O que cobre |
|---|---|---|
| `auth.test.js` | 16 | Login de teste, cadastro de aluno, bcrypt, bloqueio por tentativas |
| `identificacao.test.js` | 13 | Cabeçalho X-Matricula, 401/403, configuração |
| `catalogo.test.js` | 6 | GET de categorias, tipos e cursos |
| `atividades.test.js` | 38 | CRUD pelo coordenador, filtros, validações, só quem cadastrou edita e cancela |
| `submissoes.test.js` | 20 | Envio com arquivo, tipo real do arquivo, tamanho, duplicidade, Minhas Submissões, link do certificado |
| `painel.test.js` | 10 | Painel por curso, filtros, aprovar, rejeitar, avaliação simultânea, progresso atualizado |
| `progresso.test.js` | 11 | Horas concluídas, pendentes, restantes e por categoria; quem vê o quê |
| `calculoProgresso.test.js` | 12 | Fórmulas do progresso (unitário, sem banco) |
| `banco.test.js` | 12 | Perfis válidos, UNIQUE, chaves estrangeiras e restrições CHECK do MySQL |

O frontend ainda não tem testes automatizados.

## 6. Banco de dados

O modelo está em `prisma/schema.prisma`, comentado campo a campo. São 10 tabelas:

| Tabela | Para quê |
|---|---|
| `usuarios` | Alunos e coordenadores numa tabela. `senha_hash` = hash do login de teste. `curso_id` = curso do aluno ou curso que o coordenador coordena |
| `cursos` | Curso e carga horária mínima |
| `curso_categoria_metas` | Meta visual de horas por categoria em cada curso (ex.: Ensino 60 h) |
| `categorias` | Ensino, Pesquisa, Extensão |
| `tipos_atividade` | Evento, Minicurso, Workshop, Curso, Estágio, Monitoria, Projeto, Voluntariado, Publicação, Visita técnica, Outro |
| `atividades` | Catálogo de atividades. `organizador` = coordenador que cadastrou |
| `atividade_cursos` | Cursos para os quais a atividade é recomendada |
| `submissoes` | Pedidos de validação de horas (`atividade_id` vazio = atividade externa, como estágio) |
| `comprovantes` | Dados do arquivo do certificado (o arquivo fica em `uploads/`, com nome aleatório) |
| `avaliacoes` | Histórico das decisões do coordenador (nunca é editado) |

O próprio MySQL garante as regras críticas (restrições CHECK na migração):
- submissão APROVADA precisa de horas aprovadas;
- horas aprovadas ≤ horas solicitadas;
- submissão REJEITADA precisa de justificativa;
- horas e cargas horárias > 0;
- data de término ≥ data de início;
- certificado só PDF, PNG ou JPEG.

Registros usados no histórico não podem ser apagados (chaves estrangeiras com RESTRICT).

**Migrações:** `20261022000000_inicial` cria as tabelas. `20261031000000_login_e_submissoes`
reduz os perfis a ALUNO/COORDENADOR, cria `senha_hash`, torna a data de início da
submissão opcional e acrescenta `alerta_duplicidade`.

**Para mudar o banco:** edite `schema.prisma` e rode `npm run db:migrate:dev -- --name descricao`.
O Prisma gera a nova migração, e as restrições CHECK existentes continuam no banco.

## 7. API

Base: `http://localhost:3000/api`. JSON nas requisições e respostas (exceto o envio de certificado,
que é `multipart/form-data`). Datas em ISO 8601 (UTC). "Logado" = requisição com o cabeçalho
`X-Matricula` de uma conta ativa.

| Método | Rota | Quem pode | O que faz |
|---|---|---|---|
| GET | `/saude` | público | API e banco no ar |
| POST | `/auth/login` | público | Login de teste: confere a senha e devolve o usuário |
| POST | `/auth/cadastro` | público | Cria conta de **aluno** |
| GET | `/usuarios/me` | logado | Dados do usuário e do curso |
| GET | `/categorias` | público | Categorias ativas (`?incluirInativas=true` só COORDENADOR) |
| GET | `/tipos-atividade` | público | Tipos ativos (`?incluirInativos=true` só COORDENADOR) |
| GET | `/cursos` | público | Cursos ativos, carga mínima e metas por categoria |
| GET | `/atividades` | público | Catálogo com filtros e paginação |
| GET | `/atividades/:id` | público | Detalhe de uma atividade |
| POST | `/atividades` | COORDENADOR | Cria (fica registrado quem cadastrou) |
| PATCH | `/atividades/:id` | COORDENADOR que cadastrou | Edita só os campos enviados |
| DELETE | `/atividades/:id` | COORDENADOR que cadastrou | **Cancela** (não apaga) |
| POST | `/submissoes` | ALUNO | Envia certificado (formulário + arquivo) |
| GET | `/submissoes/minhas` | ALUNO | Minhas Submissões |
| GET | `/submissoes` | COORDENADOR | Painel: submissões dos alunos do seu curso |
| GET | `/submissoes/:id` | o ALUNO dono ou COORDENADOR do curso | Detalhe com histórico de avaliações |
| PATCH | `/submissoes/:id/aprovar` | COORDENADOR do curso | Aprova |
| PATCH | `/submissoes/:id/rejeitar` | COORDENADOR do curso | Rejeita com motivo |
| GET | `/comprovantes/:id/arquivo` | link assinado, ou dono/coordenador | Abre o certificado (PDF/imagem) |
| GET | `/progresso` | ALUNO | Progresso do próprio aluno |
| GET | `/progresso/:matricula` | o próprio ALUNO; COORDENADOR do curso do aluno | Progresso de um aluno |

### 7.1 Login e cadastro

**`POST /auth/login`**

```json
{ "matricula": "DEMOALU01", "senha": "demo1234" }
```

Resposta **200**:

```json
{
  "usuario": {
    "id": 1, "matricula": "DEMOALU01", "nome": "[DEMO] Lucas Almeida", "email": "demo.aluno1@exemplo.edu",
    "perfil": "ALUNO", "ativo": true,
    "curso": { "id": 1, "nome": "[DEMO] Ciência da Computação", "cargaHorariaMinima": 200 }
  }
}
```

Erros: **400** faltou matrícula ou senha · **401** `CREDENCIAIS_INVALIDAS` (mesma resposta para
matrícula inexistente, senha errada ou conta desativada) · **429** `MUITAS_TENTATIVAS` (o cabeçalho
`Retry-After` diz quantos segundos esperar).

**`POST /auth/cadastro`**: sempre cria um **ALUNO**.

```json
{ "nome": "Maria da Silva", "matricula": "2026A001", "email": "maria@exemplo.edu", "senha": "senhaSegura1", "cursoId": 1 }
```

- Todos os campos são obrigatórios. O `cursoId` vem de `GET /cursos`.
- Senha: 8+ caracteres, com pelo menos uma letra e um número.
- Mandar `perfil` diferente de ALUNO → **403**.
- Respostas: **201** `{ usuario }` · **400** dados inválidos · **409** matrícula ou e-mail já usados.

Depois do login, o front envia `X-Matricula: <usuario.matricula>` nas requisições.

### 7.2 GET /atividades — filtros

Todos opcionais, na query string:

| Parâmetro | Exemplo | Efeito |
|---|---|---|
| `busca` | `workshop` | Título, descrição, categoria ou tipo (sem diferenciar maiúsculas e acentos) |
| `categoriaId`, `tipoId` | `2` | Botões Ensino/Pesquisa/Extensão e Eventos/Minicursos/Workshops |
| `modalidade` | `ONLINE` | `PRESENCIAL`, `ONLINE` ou `HIBRIDA` |
| `de`, `ate` | `2026-11-01` | Período da data de início (AAAA-MM-DD, horário de Fortaleza) |
| `cargaMin`, `cargaMax` | `4` | Faixa de carga horária |
| `cursoId` | `1` | Só as recomendadas para esse curso |
| `compativeis` | `true` | Só as recomendadas para o curso de quem está logado |
| `situacao` | `passadas` | `futuras` (padrão: ainda vão acontecer ou em andamento), `passadas` ou `todas` |
| `incluirCanceladas` | `true` | Inclui canceladas (padrão: não) |
| `minhas` | `true` | Só as cadastradas pelo coordenador logado |
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
    "dataInicio": "2026-11-07T17:00:00.000Z",
    "dataFim": "2026-11-07T21:00:00.000Z",
    "local": "Auditório Central",
    "link": null,
    "imagemUrl": null,
    "cargaHoraria": 4,
    "prazoInscricao": "2026-11-06T02:59:00.000Z",
    "vagas": 80,
    "inscricaoInfo": "Inscrições pelo formulário do evento.",
    "contato": null,
    "organizador": { "id": 4, "nome": "Coordenação de Computação" },
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
- `recomendadaParaVoce`: `true`/`false` quando quem consulta tem curso; `null` sem login.
  Serve para **destacar**: as demais atividades continuam aparecendo.

### 7.3 Criar, editar e cancelar atividades (coordenador)

**`POST /atividades`** e **`PATCH /atividades/:id`**:

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
| Ignorados | `organizadorId`, `status`, `id` (fica registrado o coordenador que cadastrou) |

- No **PATCH** só os campos enviados mudam. Mande `null` para limpar um campo opcional.
- `cursoIds` substitui a lista inteira.
- Atividade cancelada não pode ser editada (**409**).

**`DELETE /atividades/:id`**: corpo opcional `{ "motivo": "Palestrante indisponível" }`.
A atividade fica `CANCELADA` e sai do catálogo padrão, mas continua consultável e ligada às
submissões. Cancelar de novo dá **409**.

**Quem pode editar e cancelar** (decisão do grupo): **só o coordenador que cadastrou** a atividade
(campo `organizador`). Outro coordenador, mesmo do mesmo curso, recebe **403**. Por isso a tela
Gerenciar Atividades lista com `?minhas=true`. A regra fica em
`COORDENADOR_EDITA_ATIVIDADES_DE_OUTROS` (`false`), em `src/config/perfis.js`.

### 7.4 POST /submissoes — enviar certificado (aluno)

Formato **`multipart/form-data`** (um `FormData` no front), com os mesmos nomes do formulário:

| Campo | Obrigatório | Regra |
|---|---|---|
| `titulo` | sim | 3 a 200 caracteres |
| `categoriaId` | sim | id de `GET /categorias` |
| `cargaHoraria` | sim | > 0, até 999,99 |
| `arquivo` | sim | **PDF, PNG ou JPEG, até 10 MB** (`ARQUIVO_TAMANHO_MAXIMO_MB`) |
| `atividadeId` | não | Liga a uma atividade do catálogo (id de `GET /atividades?situacao=todas`) |
| `instituicao` | não | até 200 caracteres |
| `dataInicio`, `dataFim` | não | `AAAA-MM-DD`; não podem estar no futuro; fim exige início e não pode ser antes dele |
| `observacoes` | não | até 500 caracteres |

- **Sempre começa `PENDENTE`.** Campos como `status` ou `horasAprovadas` enviados pelo formulário são ignorados.
- **O tipo do arquivo é conferido pelo conteúdo**, não só pela extensão: um `.exe` renomeado para
  `.pdf` é recusado. A extensão também precisa combinar com o conteúdo.
- O arquivo é gravado em `uploads/comprovantes/` com **nome aleatório**. O nome original fica só no banco.
- **Duplicidade:**
  - **Bloqueia (409):** a mesma atividade do catálogo duas vezes pelo mesmo aluno, ou o mesmo
    arquivo já enviado pelo mesmo aluno numa submissão que não foi rejeitada.
  - **Só avisa o coordenador:** o mesmo arquivo enviado por outro aluno, ou título e carga
    horária iguais a outra submissão do aluno. Aparece no campo `alertaDuplicidade` do painel.
- Respostas: **201** `{ submissao }` · **400** dados ou arquivo inválidos · **409** duplicado ·
  **413** arquivo grande demais.

Formato de uma submissão (o mesmo em todas as rotas de submissão):

```json
{
  "id": 7,
  "titulo": "Curso de Git e GitHub",
  "atividade": null,
  "categoria": { "id": 1, "nome": "Ensino" },
  "instituicao": "Universidade de Fortaleza",
  "horasSolicitadas": 20,
  "horasAprovadas": null,
  "dataInicio": "2026-09-01",
  "dataFim": "2026-09-05",
  "observacoes": "Curso online com prova final.",
  "status": "PENDENTE",
  "motivoRejeicao": null,
  "justificativa": null,
  "permiteCorrecao": false,
  "enviadaEm": "2026-10-31T20:00:00.000Z",
  "avaliadaEm": null,
  "avaliador": null,
  "certificado": {
    "id": 7,
    "nomeOriginal": "certificado.pdf",
    "tipo": "application/pdf",
    "tamanhoBytes": 48213,
    "url": "http://localhost:3000/api/comprovantes/7/arquivo?expira=1793482800&assinatura=..."
  }
}
```

- `atividade` traz `{ id, titulo }` quando a submissão está ligada a uma atividade do catálogo.
- `motivoRejeicao` só vem preenchido em submissões REJEITADAS.
- No painel do coordenador, cada submissão também traz `aluno: { id, nome, matricula }` e `alertaDuplicidade`.

### 7.5 Minhas Submissões e Painel do Coordenador

**`GET /submissoes/minhas`** (aluno) e **`GET /submissoes`** (coordenador) aceitam os mesmos filtros:

| Parâmetro | Exemplo | Efeito |
|---|---|---|
| `status` | `PENDENTE` | `PENDENTE`, `APROVADA` ou `REJEITADA` |
| `categoriaId` | `1` | Filtra pela categoria |
| `busca` | `git` | Aluno: título, instituição ou atividade. Coordenador: também nome e matrícula do aluno |
| `pagina`, `porPagina` | `1`, `8` | Paginação (padrão 20, máx. 100) |

```json
{
  "submissoes": [ /* formato da seção 7.4 */ ],
  "contagem": { "todas": 5, "pendentes": 2, "aprovadas": 2, "rejeitadas": 1 },
  "paginacao": { "pagina": 1, "porPagina": 20, "total": 5, "totalPaginas": 1 }
}
```

- A lista vem das mais recentes para as mais antigas.
- `contagem` dá os números das abas "Todos / Aprovadas / Pendentes / Rejeitadas" e não muda com os filtros.
- O coordenador só vê alunos do curso que coordena.

**`PATCH /submissoes/:id/aprovar`**: corpo opcional.

```json
{ "horasAprovadas": 15, "observacao": "Só 15 h comprovadas no certificado." }
```

Sem `horasAprovadas`, aprova as horas solicitadas. Nunca pode passar delas (**400**).

**`PATCH /submissoes/:id/rejeitar`**:

```json
{ "motivo": "Certificado ilegível", "permiteCorrecao": true }
```

`motivo` é obrigatório (5 a 1000 caracteres). Ele aparece para o aluno em `motivoRejeicao`.

**Regras das duas rotas:**

- Só submissões **PENDENTES** podem ser avaliadas. Se dois coordenadores avaliarem ao mesmo
  tempo, um consegue e o outro recebe **409**.
- Submissão de aluno de outro curso → **404**.
- Cada decisão é gravada em `avaliacoes`, com quem decidiu, quando e por quê.
- A resposta é `{ submissao, progressoAluno }`. O `progressoAluno` já vem com as horas
  atualizadas: o progresso é recalculado a cada consulta, então a aprovação conta na hora.

### 7.6 Abrir o certificado

O campo `certificado.url` é um **link assinado** que vale por 60 minutos
(`LINK_ARQUIVO_VALIDADE_MINUTOS`). Ele funciona direto num `<a href target="_blank">`, que não
consegue enviar o cabeçalho `X-Matricula`. Link adulterado ou vencido → **401**. Basta recarregar a
lista para ganhar um link novo.

Sem a assinatura, a rota só abre o arquivo para o aluno dono ou para o coordenador do curso,
identificados pelo `X-Matricula`.

### 7.7 GET /progresso

```json
{
  "aluno": { "id": 1, "matricula": "DEMOALU01", "nome": "[DEMO] Lucas Almeida" },
  "curso": { "id": 1, "nome": "[DEMO] Ciência da Computação" },
  "horas": { "minima": 200, "concluidas": 125, "pendentes": 8, "restantes": 75 },
  "percentualConcluido": 62.5,
  "cargaHorariaCumprida": false,
  "porCategoria": [
    { "categoria": { "id": 1, "nome": "Ensino" },   "horasConcluidas": 40, "horasPendentes": 0, "meta": 60, "percentualMeta": 66.7 },
    { "categoria": { "id": 3, "nome": "Extensão" }, "horasConcluidas": 50, "horasPendentes": 8, "meta": 90, "percentualMeta": 55.6 },
    { "categoria": { "id": 2, "nome": "Pesquisa" }, "horasConcluidas": 35, "horasPendentes": 0, "meta": 50, "percentualMeta": 70 }
  ],
  "submissoes": { "pendentes": 1, "aprovadas": 4, "rejeitadas": 1, "aguardandoCorrecao": 1 },
  "calculadoEm": "2026-10-31T20:00:00.000Z"
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

Nada disso é gravado no banco: tudo é recalculado a cada consulta. Por isso uma aprovação aparece
no progresso imediatamente, e uma mudança na carga mínima do curso também, sem alterar as horas
já aprovadas.

### 7.8 Formato de erro

```json
{ "erro": { "codigo": "DADOS_INVALIDOS", "mensagem": "Informe o local para atividades presenciais ou híbridas.",
            "detalhes": { "campos": { "local": "Informe o local para atividades presenciais ou híbridas." } } } }
```

A `mensagem` já diz o que corrigir (junta os erros de todos os campos), pronta para mostrar na
tela. `detalhes.campos` traz o erro de cada campo, para marcar o input certo.

| Status | Quando |
|---|---|
| 400 | Dados, filtros ou arquivo inválidos |
| 401 | Sem `X-Matricula`, matrícula inexistente ou inativa, senha errada, link de certificado vencido |
| 403 | Perfil sem permissão, ou atividade cadastrada por outro coordenador |
| 404 | Não encontrado (inclusive registro de outro aluno ou de outro curso) |
| 409 | Conflito: duplicado, já avaliada, já cancelada, conta sem curso |
| 413 | Arquivo grande demais |
| 429 | Muitas tentativas de login |
| 500 | Erro inesperado (mensagem genérica; o detalhe fica só no log do servidor) |

## 8. Organização do backend

```
prisma/
  schema.prisma            modelo de dados (fonte da verdade do banco)
  migrations/              SQL aplicado pelo Prisma (inclui as restrições CHECK)
  seed.js                  categorias e tipos (obrigatório)
  seed-demo.js             contas de teste e dados fictícios (opcional)
scripts/
  criar-usuario.js         cria/atualiza contas pela linha de comando
  testar.js                prepara o banco de testes e roda os testes
src/
  server.js                ponto de entrada (conecta no banco e abre a porta)
  app.js                   Express: CORS, JSON, rotas, erros
  config/                  env.js (lê o .env), prisma.js (cliente único), perfis.js (perfis e regras)
  routes/index.js          mapa URL → controller (+ identificação e permissões)
  controllers/             lê a requisição e monta a resposta
  services/                regras de negócio e consultas Prisma
    authService.js         login de teste e cadastro
    submissaoService.js    envio, listas, aprovação, rejeição
    arquivoService.js      tipo real do arquivo, disco, links assinados
    calculoProgresso.js    fórmulas do progresso (função pura, sem banco)
  middlewares/             identificacao.js (quem é o usuário), upload.js (multer), erros.js
  utils/                   AppError, validações, conversões numéricas
tests/                     testes automatizados
```

Fluxo de uma requisição: `rota → identificação → permissão → controller → service → Prisma → MySQL`.

## 9. Integração com o frontend

### 9.1 Qual tela usa qual rota

| Tela | Arquivo | Rotas da API |
|---|---|---|
| Login | `Login.jsx` → `services/auth.js` | `POST /auth/login` |
| Criar conta | `Register.jsx` → `services/auth.js` | `GET /cursos`, `POST /auth/cadastro` |
| Sair | `App.jsx` → `services/auth.js` | nenhuma (só apaga o usuário guardado) |
| Dashboard | `Dashboard.jsx` | `GET /progresso` ✓ já integrado |
| Atividades Disponíveis | `Activities.jsx` | `GET /atividades`, `GET /categorias` ✓ já integrado |
| Enviar Certificado | `SubmitCertificate.jsx` | `GET /categorias`, `GET /atividades?situacao=todas&porPagina=100`, `POST /submissoes` |
| Minhas Submissões | `MySubmissions.jsx` | `GET /submissoes/minhas` |
| Painel do Coordenador | `Coordinator.jsx` | `GET /submissoes`, `PATCH /submissoes/:id/aprovar`, `PATCH /submissoes/:id/rejeitar` |
| Gerenciar Atividades | `ManageActivities.jsx` | `GET /atividades?minhas=true`, `POST`/`PATCH`/`DELETE /atividades` ✓ já integrado |

### 9.2 O que muda no front para usar o login de verdade

O `services/api.js` **não muda**: ele já envia o `X-Matricula` do usuário logado. Só o
`services/auth.js` troca a simulação pelas chamadas à API:

```js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

async function postar(caminho, corpo) {
  const resposta = await fetch(API_URL + caminho, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const dados = await resposta.json().catch(() => null)
  if (!resposta.ok) throw new Error(dados?.erro?.mensagem || `Erro ${resposta.status} na API.`)
  return dados
}

export async function login(matricula, senha) {
  const { usuario } = await postar('/auth/login', { matricula, senha })
  const sessao = { matricula: usuario.matricula, nome: usuario.nome, perfil: usuario.perfil }
  localStorage.setItem('usuarioLogado', JSON.stringify(sessao))
  return sessao
}

export async function cadastrar({ nome, matricula, email, senha, cursoId }) {
  await postar('/auth/cadastro', { nome, matricula, email, senha, cursoId: Number(cursoId) })
}

// obterUsuarioLogado() e sair() continuam iguais
```

Outros ajustes:

1. **Cadastro precisa do curso.** O aluno precisa de um curso para o progresso funcionar. Inclua
   um `<select>` de curso no `Register.jsx`, carregado de `GET /cursos`.
2. **Senha:** a API exige **8** caracteres com letra e número; hoje a validação do front pede 6.
3. **Resposta 401** (conta desativada ou apagada): apague o `usuarioLogado` e volte para o login.
4. **Texto da tela de login:** troque "qualquer senha" por "senha `demo1234`".
5. **Gerenciar Atividades:** o `?minhas=true` que já está lá é o certo, porque cada coordenador só
   edita e remove as atividades que cadastrou.

### 9.3 Enviar Certificado

```js
const dados = new FormData()
dados.append('titulo', form.titulo)
dados.append('categoriaId', form.categoriaId)          // id, não o nome
dados.append('cargaHoraria', form.cargaHoraria)
if (form.atividadeId) dados.append('atividadeId', form.atividadeId)
if (form.instituicao) dados.append('instituicao', form.instituicao)
if (form.dataInicio) dados.append('dataInicio', form.dataInicio)   // AAAA-MM-DD do <input type="date">
if (form.dataFim) dados.append('dataFim', form.dataFim)
if (form.observacoes) dados.append('observacoes', form.observacoes)
dados.append('arquivo', arquivo)                       // o File do <input type="file">
await apiPost('/submissoes', dados)                    // o apiPost atual já aceita FormData
```

- Os selects de categoria e atividade passam a usar os **ids** de `GET /categorias` e de
  `GET /atividades?situacao=todas&porPagina=100`.
- Não defina `Content-Type` manualmente: o navegador monta o multipart sozinho.

### 9.4 Minhas Submissões e Painel

| Coluna da tela | Campo da API |
|---|---|
| Nome / Matrícula (painel) | `aluno.nome` / `aluno.matricula` |
| Atividade | `titulo` (e `atividade.titulo` quando ligada ao catálogo) |
| Categoria | `categoria.nome` |
| Horas | `horasSolicitadas` (ou `horasAprovadas`, se aprovada) |
| Data de envio | `enviadaEm` → `new Date(s.enviadaEm).toLocaleDateString('pt-BR')` |
| Status | `status`: `PENDENTE` / `APROVADA` / `REJEITADA` |
| Motivo da rejeição | `motivoRejeicao` |
| Ver certificado | `<a href={s.certificado.url} target="_blank" rel="noopener">` |

Filtros de categoria e status: `?categoriaId=` e `?status=` (ou filtre no front, como hoje).

Aprovar e rejeitar:

```js
await apiPatch(`/submissoes/${s.id}/aprovar`, {})
await apiPatch(`/submissoes/${s.id}/rejeitar`, { motivo })
```

Depois de aprovar ou rejeitar, use a `submissao` devolvida para atualizar a linha da tabela.

### 9.5 Dicas

- **Datas:** a API devolve data e hora em UTC. Para mostrar no horário local:
  `new Date(a.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' })`.
  As datas de submissão (`dataInicio`, `dataFim`) já vêm como `AAAA-MM-DD`.
- **Menu por perfil:** o `perfil` vem no login. Esconder telas é só conveniência: a API confere o
  perfil em toda operação.
- **Erros:** o `api.js` atual já mostra `erro.mensagem`, que agora diz exatamente o que corrigir.

## 10. Decisões técnicas

| Decisão | Por quê |
|---|---|
| **Só dois perfis (ALUNO e COORDENADOR)** | Definição do grupo. A migração 2 converte contas antigas de ORGANIZADOR/ADMINISTRADOR em COORDENADOR. |
| **Sem token, só `X-Matricula`** | Decisão do grupo: a matrícula é a mesma da Unifor, e o portal ficará atrás do login dela. O login de teste só confere a senha. A identificação fica num arquivo só, pronta para a integração. Limitação na seção 4. |
| **Coordenador ligado a um curso** | A tela diz "estudantes do seu curso": ele só vê e avalia alunos do curso que coordena. |
| **Coordenador só edita e cancela o que cadastrou** | Decisão do grupo: um coordenador não mexe em atividade de outro. Configurável em `src/config/perfis.js`. |
| **Upload em memória, validado antes de gravar** | O multer guarda o arquivo na memória (limite de 10 MB). Só depois de conferir o tipo real ele vai para o disco, com nome aleatório. Se o banco falhar, o arquivo é apagado. |
| **Link assinado para o certificado** | Um `<a href>` não consegue mandar o cabeçalho `X-Matricula`. O link assinado (HMAC, com validade) permite abrir o PDF numa nova aba sem expor a pasta de uploads. |
| **Duplicidade: bloquear o certo, avisar o suspeito** | Bloquear por semelhança prejudicaria alunos com atividades parecidas. O coordenador decide com o `alertaDuplicidade`. |
| **Avaliação só de PENDENTE, numa transação** | Evita que dois coordenadores avaliem a mesma submissão ao mesmo tempo e mantém o histórico coerente. |
| **Progresso sempre recalculado** | Nenhum total é gravado: não há como contar uma aprovação duas vezes nem ficar desatualizado. |
| **Prisma 6** (não o 7) | O Prisma 7 exige TypeScript/ES Modules e configuração extra. O 6 funciona direto com o `require` (CommonJS) do backend. |
| **Restrições CHECK na migração** | O Prisma não representa CHECK no schema, mas as mantém nas migrações seguintes. |
| **Categoria ≠ tipo** | Categoria (Ensino, Pesquisa, Extensão) define as horas por categoria; tipo (Evento, Workshop...) serve para filtrar. |
| **DELETE de atividade = cancelar** | Mantém o histórico e as submissões ligadas à atividade. |
| **Datas sem fuso = Fortaleza** | Evita que "14:00" digitado no formulário vire 11:00. Configurável em `FUSO_HORARIO`. |

## 11. Limitações e pendências

- **Login da Unifor e segurança do `X-Matricula`:** o login atual é de teste, e a API confia no
  cabeçalho `X-Matricula` (seção 4). Antes de ir para produção, esse cabeçalho precisa vir do
  portal da Unifor, ou a integração precisa mudar `src/middlewares/identificacao.js`.
- **Atividade de coordenador que saiu:** como só quem cadastrou pode editar, as atividades de um
  coordenador desativado só podem ser alteradas pelo banco (`npm run db:studio`).
- **Correção de submissão rejeitada:** o coordenador já pode marcar `permiteCorrecao`, mas a
  rota para o aluno reenviar ainda não existe. Hoje o aluno faz um novo envio.
- **Status "Em análise"**, que aparece no protótipo do Painel do Coordenador, não existe. Os
  status são PENDENTE, APROVADA e REJEITADA.
- **Armazenamento dos certificados:** fica no disco do servidor (`uploads/`). Com mais de um
  servidor, ou em hospedagens sem disco permanente, será preciso um armazenamento compartilhado.
  Faça backup dessa pasta junto com o banco.
- **Bloqueio de tentativas de login:** fica na memória da API; zera se ela reiniciar.
- **Gestão de categorias, tipos, cursos e metas** pela API ainda não existe (só leitura).
  Por enquanto, use `npm run db:studio`.
- **Imagem da atividade:** é só um endereço (`imagemUrl`). Ainda não há upload de imagem.
