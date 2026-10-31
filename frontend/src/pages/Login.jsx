import { useState } from 'react'
import { Link } from 'react-router-dom'
import { login } from '../services/auth.js'

// onLogin é chamado pelo App com o usuário que entrou
function Login({ onLogin }) {
  const [matricula, setMatricula] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    if (enviando) return // bloqueia clique duplo

    if (!matricula.trim() || !senha) {
      setErro('Preencha matrícula e senha.')
      return
    }

    setErro('')
    setEnviando(true)
    try {
      const usuario = await login(matricula, senha)
      onLogin(usuario)
    } catch (err) {
      setErro(err.message)
      setEnviando(false)
    }
  }

  return (
    <div className="col-md-6 col-lg-4 mx-auto">
      <h1 className="text-primary text-center mb-4">Atividades Complementares</h1>

      <form className="card p-4" onSubmit={entrar} noValidate>
        <h2 className="h4 mb-3">Entrar</h2>

        {erro && <div className="alert alert-danger py-2">{erro}</div>}

        <label className="form-label">Matrícula</label>
        <input className="form-control mb-3" value={matricula} onChange={(e) => setMatricula(e.target.value)} />

        <label className="form-label">Senha</label>
        <input type="password" className="form-control mb-4" value={senha} onChange={(e) => setSenha(e.target.value)} />

        <button type="submit" className="btn btn-primary w-100" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-center mt-3 mb-0">
          Não tem conta? <Link to="/cadastro">Criar conta</Link>
        </p>
      </form>

      {/* Ajuda para a demonstração (remover quando o login for real) */}
      <p className="small text-muted text-center mt-3">
        Demonstração: <strong>DEMOALU01</strong> (aluno) ou <strong>DEMOCOO01</strong> (coordenador), com qualquer senha.
      </p>
    </div>
  )
}

export default Login
