import { useState } from 'react'
import { Link } from 'react-router-dom'

// Estado inicial do formulário (usado também para limpar)
const formVazio = {
  titulo: '',
  atividade: '',
  instituicao: '',
  categoria: '',
  cargaHoraria: '',
  dataInicio: '',
  dataFim: '',
  observacoes: '',
}

// Regras do anexo: PDF, JPG ou PNG de até 10 MB
const tiposAceitos = ['application/pdf', 'image/jpeg', 'image/png']
const tamanhoMaximo = 10 * 1024 * 1024 // 10 MB

function SubmitCertificate() {
  const [form, setForm] = useState(formVazio) // valores dos campos de texto
  const [arquivo, setArquivo] = useState(null) // anexo escolhido
  const [erros, setErros] = useState({}) // mensagens de validação por campo
  const [enviando, setEnviando] = useState(false) // true enquanto o envio está em andamento
  const [sucesso, setSucesso] = useState(false) // true depois de enviar com sucesso

  // Atualiza qualquer campo usando o "name" do input
  function alterar(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  // Retorna um objeto com as mensagens de erro (vazio = tudo certo)
  function validar() {
    const novosErros = {}
    if (!form.titulo.trim()) novosErros.titulo = 'Informe o título.'
    if (!form.categoria) novosErros.categoria = 'Escolha a categoria.'
    if (!form.cargaHoraria || Number(form.cargaHoraria) <= 0) novosErros.cargaHoraria = 'Informe a carga horária.'
    if (!arquivo) {
      novosErros.arquivo = 'Anexe o certificado.'
    } else if (!tiposAceitos.includes(arquivo.type)) {
      novosErros.arquivo = 'Formato inválido. Use PDF, JPG ou PNG.'
    } else if (arquivo.size > tamanhoMaximo) {
      novosErros.arquivo = 'O arquivo deve ter no máximo 10 MB.'
    }
    return novosErros
  }

  function enviar(e) {
    e.preventDefault() // evita o recarregamento padrão do <form>
    if (enviando) return // bloqueia envio duplo

    const novosErros = validar()
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return // há erros: não envia

    setEnviando(true)
    // Envio simulado até a rota da API existir.
    // Com a API, se der erro, basta não limpar o formulário para manter os dados.
    setTimeout(() => {
      setEnviando(false)
      setSucesso(true)
      setForm(formVazio)
      setArquivo(null)
    }, 1000)
  }

  // Limpa o formulário, confirmando antes se houver algo preenchido
  function cancelar() {
    const temDados = Object.values(form).some((v) => v !== '') || arquivo
    if (temDados && !window.confirm('Descartar os dados preenchidos?')) return
    setForm(formVazio)
    setArquivo(null)
    setErros({})
  }

  // Depois do envio, mostra a mensagem de sucesso no lugar do formulário
  if (sucesso) {
    return (
      <div className="alert alert-success">
        <h5>Certificado enviado com sucesso. Aguardando análise.</h5>
        <Link to="/atividades-complementares/submissoes" className="btn btn-primary mt-2 me-2">Ver Minhas Submissões</Link>
        <button type="button" className="btn btn-outline-primary mt-2" onClick={() => setSucesso(false)}>Enviar outro</button>
      </div>
    )
  }

  return (
    <>
      <h2 className="mb-4">Enviar Certificado</h2>

      {/* noValidate: usa só a nossa validação, não a do navegador */}
      <form className="card p-4" onSubmit={enviar} noValidate>
        <div className="row g-3">
          {/* is-invalid deixa o campo vermelho; invalid-feedback mostra a mensagem */}
          <div className="col-md-8">
            <label className="form-label">Título *</label>
            <input name="titulo" className={`form-control ${erros.titulo ? 'is-invalid' : ''}`} value={form.titulo} onChange={alterar} />
            <div className="invalid-feedback">{erros.titulo}</div>
          </div>

          {/* Opcional: liga o certificado a uma atividade da vitrine */}
          <div className="col-md-4">
            <label className="form-label">Atividade cadastrada</label>
            <select name="atividade" className="form-select" value={form.atividade} onChange={alterar}>
              <option value="">Nenhuma</option>
              <option>Semana de Tecnologia</option>
              <option>Monitoria de Algoritmos</option>
              <option>Curso de Git e GitHub</option>
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Instituição promotora</label>
            <input name="instituicao" className="form-control" value={form.instituicao} onChange={alterar} />
          </div>

          <div className="col-md-3">
            <label className="form-label">Categoria *</label>
            <select name="categoria" className={`form-select ${erros.categoria ? 'is-invalid' : ''}`} value={form.categoria} onChange={alterar}>
              <option value="">Selecione</option>
              <option>Ensino</option>
              <option>Pesquisa</option>
              <option>Extensão</option>
            </select>
            <div className="invalid-feedback">{erros.categoria}</div>
          </div>

          <div className="col-md-3">
            <label className="form-label">Carga horária (h) *</label>
            <input name="cargaHoraria" type="number" min="1" className={`form-control ${erros.cargaHoraria ? 'is-invalid' : ''}`} value={form.cargaHoraria} onChange={alterar} />
            <div className="invalid-feedback">{erros.cargaHoraria}</div>
          </div>

          {/* Período de realização */}
          <div className="col-md-3">
            <label className="form-label">Início</label>
            <input name="dataInicio" type="date" className="form-control" value={form.dataInicio} onChange={alterar} />
          </div>

          <div className="col-md-3">
            <label className="form-label">Fim</label>
            <input name="dataFim" type="date" className="form-control" value={form.dataFim} onChange={alterar} />
          </div>

          {/* O arquivo fica num estado separado, pois não é texto */}
          <div className="col-md-6">
            <label className="form-label">Certificado (PDF, JPG ou PNG, até 10 MB) *</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className={`form-control ${erros.arquivo ? 'is-invalid' : ''}`} onChange={(e) => setArquivo(e.target.files[0] || null)} />
            <div className="invalid-feedback">{erros.arquivo}</div>
          </div>

          {/* maxLength impede passar de 500; o contador mostra quantos já foram usados */}
          <div className="col-12">
            <label className="form-label">Observações</label>
            <textarea name="observacoes" className="form-control" rows="3" maxLength={500} value={form.observacoes} onChange={alterar}></textarea>
            <small className="text-muted">{form.observacoes.length}/500</small>
          </div>
        </div>

        {/* Botões desabilitados enquanto envia */}
        <div className="d-flex gap-2 mt-4">
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar'}
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={cancelar} disabled={enviando}>Cancelar</button>
        </div>
      </form>
    </>
  )
}

export default SubmitCertificate
