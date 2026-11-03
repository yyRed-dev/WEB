import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../services/api.js'
import { cadastrar, semPrefixoDemo } from '../services/auth.js'

const formVazio = { nome: '', matricula: '', email: '', cursoId: '', senha: '', confirmar: '' }

function Register() {
  const [form, setForm] = useState(formVazio)
  const [cursos, setCursos] = useState([])
  const [semApi, setSemApi] = useState(false)
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  // O aluno precisa de um curso para o progresso funcionar
  useEffect(() => {
    apiGet('/cursos')
      .then((resposta) => setCursos(resposta.cursos))
      .catch(() => setSemApi(true))
  }, [])

  // Atualiza qualquer campo usando o "name" do input
  function alterar(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function validar() {
    const novosErros = {}
    if (!form.nome.trim()) novosErros.nome = 'Informe o nome.'
    if (!form.matricula.trim()) novosErros.matricula = 'Informe a matrícula.'
    if (!/\S+@\S+\.\S+/.test(form.email)) novosErros.email = 'Informe um e-mail válido.'
    if (!form.cursoId) novosErros.cursoId = 'Escolha o curso.'
    // Mesma regra da API: 8+ caracteres, com letra e número
    if (form.senha.length < 8 || !/[a-zA-Z]/.test(form.senha) || !/\d/.test(form.senha)) {
      novosErros.senha = 'A senha deve ter pelo menos 8 caracteres, com letras e números.'
    }
    if (form.confirmar !== form.senha) novosErros.confirmar = 'As senhas não conferem.'
    return novosErros
  }

  async function enviar(e) {
    e.preventDefault()
    if (enviando) return // bloqueia clique duplo

    const novosErros = validar()
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return

    setErroGeral('')
    setEnviando(true)
    try {
      await cadastrar(form)
      setSucesso(true)
    } catch (err) {
      setErroGeral(err.message) // mantém os dados digitados
    } finally {
      setEnviando(false)
    }
  }

  // Monta um campo com label e mensagem de erro (evita repetir o mesmo JSX 5 vezes)
  function campo(name, label, type = 'text') {
    return (
      <div className="mb-3">
        <label className="form-label">{label}</label>
        <input name={name} type={type} className={`form-control ${erros[name] ? 'is-invalid' : ''}`} value={form[name]} onChange={alterar} />
        <div className="invalid-feedback">{erros[name]}</div>
      </div>
    )
  }

  return (
    <div className="col-md-6 col-lg-4 mx-auto">
      <h1 className="text-primary text-center mb-4">Atividades Complementares</h1>

      {sucesso ? (
        <div className="alert alert-success">
          <h2 className="h5">Conta criada com sucesso.</h2>
          <Link to="/login" className="btn btn-primary mt-2">Ir para o login</Link>
        </div>
      ) : (
        <form className="card p-4" onSubmit={enviar} noValidate>
          <h2 className="h4 mb-3">Criar conta</h2>

          {semApi && (
            <div className="alert alert-warning py-2 small">Não foi possível conectar à API. O cadastro precisa dela funcionando.</div>
          )}
          {erroGeral && <div className="alert alert-danger py-2">{erroGeral}</div>}

          {campo('nome', 'Nome completo')}
          {campo('matricula', 'Matrícula (a mesma da Unifor)')}
          {campo('email', 'E-mail', 'email')}

          <div className="mb-3">
            <label className="form-label">Curso</label>
            <select name="cursoId" className={`form-select ${erros.cursoId ? 'is-invalid' : ''}`} value={form.cursoId} onChange={alterar}>
              <option value="">Selecione</option>
              {cursos.map((c) => <option key={c.id} value={c.id}>{semPrefixoDemo(c.nome)}</option>)}
            </select>
            <div className="invalid-feedback">{erros.cursoId}</div>
          </div>

          {campo('senha', 'Senha (8+ caracteres, letras e números)', 'password')}
          {campo('confirmar', 'Confirmar senha', 'password')}

          <button type="submit" className="btn btn-primary w-100 mt-2" disabled={enviando}>
            {enviando ? 'Criando...' : 'Criar conta'}
          </button>

          <p className="text-center mt-3 mb-0">
            Já tem conta? <Link to="/login">Entrar</Link>
          </p>
        </form>
      )}
    </div>
  )
}

export default Register
