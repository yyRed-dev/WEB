import { obterUsuarioLogado, sair } from './auth.js'

// Endereço da API (pode ser trocado com VITE_API_URL no arquivo .env)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// Faz a requisição já com o X-Matricula do usuário logado
async function requisitar(caminho, opcoes = {}) {
  const usuario = obterUsuarioLogado()
  const headers = { ...opcoes.headers }
  if (usuario) headers['X-Matricula'] = usuario.matricula

  let resposta
  try {
    resposta = await fetch(API_URL + caminho, { ...opcoes, headers })
  } catch {
    // A API nem respondeu (desligada ou sem rede): as telas usam dados de exemplo
    const erro = new Error('Não foi possível conectar à API.')
    erro.semConexao = true
    throw erro
  }
  const dados = await resposta.json().catch(() => null)

  // 401 com alguém logado = conta inexistente ou desativada: volta ao login
  if (resposta.status === 401 && usuario && !caminho.startsWith('/auth')) {
    sair()
    window.location.assign('/login')
  }

  // Erros da API vêm como { erro: { codigo, mensagem } }
  if (!resposta.ok) {
    throw new Error(dados?.erro?.mensagem || `Erro ${resposta.status} na API.`)
  }
  return dados
}

export function apiGet(caminho) {
  return requisitar(caminho)
}

// Envia JSON com o método indicado (POST, PATCH, DELETE...)
function enviarJson(metodo, caminho, corpo) {
  return requisitar(caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo ?? {}),
  })
}

// Aceita objeto (vira JSON) ou FormData (para envio de arquivo)
export function apiPost(caminho, corpo) {
  if (corpo instanceof FormData) {
    return requisitar(caminho, { method: 'POST', body: corpo })
  }
  return enviarJson('POST', caminho, corpo)
}

export function apiPatch(caminho, corpo) {
  return enviarJson('PATCH', caminho, corpo)
}

export function apiDelete(caminho, corpo) {
  return enviarJson('DELETE', caminho, corpo)
}
