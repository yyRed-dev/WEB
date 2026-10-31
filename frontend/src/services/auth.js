// Login e cadastro SIMULADOS no front.
// Quando o back tiver as rotas, trocar o corpo de login() e cadastrar()
// por chamadas fetch à API. As telas não precisam mudar.

const CHAVE_SESSAO = 'usuarioLogado'
const CHAVE_CADASTROS = 'usuariosCadastrados'

// Mesmas matrículas demo usadas pelo back (X-Matricula)
const usuariosDemo = [
  { matricula: 'DEMOALU01', nome: 'Aluno Demo', perfil: 'ALUNO' },
  { matricula: 'DEMOALU02', nome: 'Aluno Demo 2', perfil: 'ALUNO' },
  { matricula: 'DEMOCOO01', nome: 'Coordenador Demo', perfil: 'COORDENADOR' },
]

function lerCadastros() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CADASTROS)) || []
  } catch {
    return []
  }
}

// Simula o tempo de resposta da API
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function login(matricula, senha) {
  await esperar(500)
  const mat = matricula.trim().toUpperCase()
  const usuario = [...usuariosDemo, ...lerCadastros()].find((u) => u.matricula === mat)
  // Simulação: aceita qualquer senha para uma matrícula conhecida
  if (!usuario || !senha) throw new Error('Matrícula ou senha inválidas.')

  const sessao = { matricula: usuario.matricula, nome: usuario.nome, perfil: usuario.perfil }
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao))
  return sessao
}

export async function cadastrar({ nome, matricula, email }) {
  await esperar(500)
  const mat = matricula.trim().toUpperCase()
  const cadastros = lerCadastros()
  if ([...usuariosDemo, ...cadastros].some((u) => u.matricula === mat)) {
    throw new Error('Já existe uma conta com essa matrícula.')
  }
  // A senha não é guardada: na simulação ela não é conferida
  cadastros.push({ matricula: mat, nome: nome.trim(), email: email.trim(), perfil: 'ALUNO' })
  localStorage.setItem(CHAVE_CADASTROS, JSON.stringify(cadastros))
}

export function obterUsuarioLogado() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_SESSAO))
  } catch {
    return null
  }
}

export function sair() {
  localStorage.removeItem(CHAVE_SESSAO)
}
