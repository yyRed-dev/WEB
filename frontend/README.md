# Front-end — Portal de Atividades Complementares

Interface do portal em **React + Vite + Bootstrap 5**. Fica na pasta `frontend/` do repositório; o back-end (API) fica na raiz.

Detalhes da API, do banco e de como subir o back-end estão no [README da raiz](../README.md).

## Como rodar

Precisa do Node.js 22. Com a API rodando em `http://localhost:3000`, abra outro terminal **dentro da pasta `frontend`**:

```bash
npm install
npm run dev
```

Acesse http://localhost:5173.

Outros comandos: `npm run lint` (verifica o código) e `npm run build` (gera a versão de produção em `dist/`).

## Contas de teste

Criadas pelo `npm run db:demo` do back-end. Senha de todas: `demo1234`.

| Matrícula | Perfil |
|---|---|
| `DEMOALU01` | Aluno |
| `DEMOCOO01` | Coordenador |

Se a API estiver desligada, as telas mostram um aviso e usam dados de exemplo; o login aceita essas duas matrículas com qualquer senha, só para demonstração.

## Telas

| Endereço | Tela | Perfil |
|---|---|---|
| `/login` | Entrar | Todos |
| `/cadastro` | Criar conta | Aluno |
| `/atividades-complementares/dashboard` | Dashboard de progresso | Aluno |
| `/atividades-complementares/atividades` | Atividades Disponíveis | Aluno e coordenador |
| `/atividades-complementares/certificados/enviar` | Enviar Certificado | Aluno |
| `/atividades-complementares/submissoes` | Minhas Submissões | Aluno |
| `/atividades-complementares/coordenador` | Painel do Coordenador | Coordenador |
| `/atividades-complementares/coordenador/atividades` | Gerenciar Atividades | Coordenador |

Sem login, qualquer endereço leva para `/login`. Telas de outro perfil voltam para a tela inicial (Dashboard para o aluno, Painel para o coordenador).

## Estrutura

```
src/
  main.jsx                 BrowserRouter, Bootstrap e tema
  App.jsx                  rotas e acesso por perfil
  services/api.js          chamadas à API (envia o X-Matricula do usuário logado)
  services/auth.js         login, cadastro e sessão
  components/layout/       cabeçalho, menu "Atividades Complementares" e breadcrumb
  pages/                   uma página por tela
  styles/theme.css         cores e fonte do projeto
```

## Configuração

O endereço da API é `http://localhost:3000/api`. Para usar outro, crie `frontend/.env`:

```
VITE_API_URL=http://outro-endereco:3000/api
```
