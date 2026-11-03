// Login e cadastro pela API (POST /auth/login e POST /auth/cadastro).
// Se a API estiver fora do ar, entra no modo de demonstração com os usuários de teste.
import { apiPost } from './api.js'

const CHAVE_SESSAO = 'usuarioLogado'

// Usuários de teste do back (npm run db:demo), usados só se a API não responder
const usuariosDemo = [
  { matricula: 'DEMOALU01', nome: 'Lucas Almeida', perfil: 'ALUNO' },
  { matricula: 'DEMOALU02', nome: 'Aluno Demo 2', perfil: 'ALUNO' },
  { matricula: 'DEMOCOO01', nome: 'Coordenação de Computação', perfil: 'COORDENADOR' },
]

// Os dados de teste do back vêm com "[DEMO]" no nome
export function semPrefixoDemo(texto) {
  return (texto || '').replace(/^\[DEMO\]\s*/, '')
}

function salvarSessao(usuario) {
  const sessao = { matricula: usuario.matricula, nome: semPrefixoDemo(usuario.nome), perfil: usuario.perfil }
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao))
  return sessao
}

export async function login(matricula, senha) {
  try {
    const { usuario } = await apiPost('/auth/login', { matricula: matricula.trim(), senha })
    return salvarSessao(usuario)
  } catch (err) {
    if (!err.semConexao) throw err // senha errada, conta bloqueada etc.

    // Modo de demonstração: aceita qualquer senha para um usuário de teste
    const usuario = usuariosDemo.find((u) => u.matricula === matricula.trim().toUpperCase())
    if (!usuario) throw new Error('API fora do ar. Use DEMOALU01 ou DEMOCOO01 para a demonstração.', { cause: err })
    return salvarSessao(usuario)
  }
}

export async function cadastrar({ nome, matricula, email, senha, cursoId }) {
  await apiPost('/auth/cadastro', {
    nome: nome.trim(),
    matricula: matricula.trim(),
    email: email.trim(),
    senha,
    cursoId: Number(cursoId),
  })
}

export function obterUsuarioLogado() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_SESSAO))
  } catch {
    return null
  }
}

// Não existe logout na API (não há sessão): basta apagar o usuário guardado
export function sair() {
  localStorage.removeItem(CHAVE_SESSAO)
}
