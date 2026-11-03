import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost } from '../services/api.js'

// Estado inicial do formulário (usado também para limpar)
const formVazio = {
  titulo: '',
  atividadeId: '',
  instituicao: '',
  categoriaId: '',
  cargaHoraria: '',
  dataInicio: '',
  dataFim: '',
  observacoes: '',
}

// Regras do anexo: PDF, JPG ou PNG de até 10 MB
const tiposAceitos = ['application/pdf', 'image/jpeg', 'image/png']
const tamanhoMaximo = 10 * 1024 * 1024 // 10 MB

// Listas de exemplo, usadas se a API não responder
const categoriasExemplo = [
  { id: 1, nome: 'Ensino' },
  { id: 2, nome: 'Pesquisa' },
  { id: 3, nome: 'Extensão' },
]
const atividadesExemplo = [
  { id: 1, titulo: 'Semana de Tecnologia' },
  { id: 2, titulo: 'Monitoria de Algoritmos' },
  { id: 3, titulo: 'Curso de Git e GitHub' },
]

// Data de hoje no formato AAAA-MM-DD (para comparar com os campos de data)
const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })

function SubmitCertificate() {
  const [form, setForm] = useState(formVazio) // valores dos campos de texto
  const [arquivo, setArquivo] = useState(null) // anexo escolhido
  const [erros, setErros] = useState({}) // mensagens de validação por campo
  const [erroGeral, setErroGeral] = useState('') // erro devolvido pela API
  const [enviando, setEnviando] = useState(false) // true enquanto o envio está em andamento
  const [sucesso, setSucesso] = useState(false) // true depois de enviar com sucesso
  const [categorias, setCategorias] = useState(categoriasExemplo)
  const [atividades, setAtividades] = useState(atividadesExemplo)
  const [semApi, setSemApi] = useState(false) // true = envio simulado

  // Categorias e atividades do catálogo (os selects usam os ids da API)
  useEffect(() => {
    Promise.all([apiGet('/categorias'), apiGet('/atividades?situacao=todas&porPagina=100')])
      .then(([respCategorias, respAtividades]) => {
        setCategorias(respCategorias.categorias)
        setAtividades(respAtividades.atividades)
      })
      .catch(() => setSemApi(true))
  }, [])

  // Atualiza qualquer campo usando o "name" do input
  function alterar(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  // Retorna um objeto com as mensagens de erro (vazio = tudo certo)
  function validar() {
    const novosErros = {}
    if (!form.titulo.trim()) novosErros.titulo = 'Informe o título.'
    if (!form.categoriaId) novosErros.categoriaId = 'Escolha a categoria.'
    if (!form.cargaHoraria || Number(form.cargaHoraria) <= 0) novosErros.cargaHoraria = 'Informe a carga horária.'
    // Mesmas regras da API para o período
    if (form.dataInicio > hoje) novosErros.dataInicio = 'A data não pode estar no futuro.'
    if (form.dataFim && !form.dataInicio) novosErros.dataInicio = 'Informe o início.'
    if (form.dataFim > hoje) novosErros.dataFim = 'A data não pode estar no futuro.'
    else if (form.dataFim && form.dataFim < form.dataInicio) novosErros.dataFim = 'O fim não pode ser antes do início.'
    if (!arquivo) {
      novosErros.arquivo = 'Anexe o certificado.'
    } else if (!tiposAceitos.includes(arquivo.type)) {
      novosErros.arquivo = 'Formato inválido. Use PDF, JPG ou PNG.'
    } else if (arquivo.size > tamanhoMaximo) {
      novosErros.arquivo = 'O arquivo deve ter no máximo 10 MB.'
    }
    return novosErros
  }

  async function enviar(e) {
    e.preventDefault() // evita o recarregamento padrão do <form>
    if (enviando) return // bloqueia envio duplo

    const novosErros = validar()
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return // há erros: não envia

    setErroGeral('')
    setEnviando(true)
    try {
      if (semApi) {
        // Sem API: envio simulado para a demonstração
        await new Promise((resolve) => setTimeout(resolve, 800))
      } else {
        // multipart/form-data: campos do formulário + arquivo (só os preenchidos)
        const dados = new FormData()
        Object.entries(form).forEach(([campo, valor]) => {
          if (valor !== '') dados.append(campo, valor)
        })
        dados.append('arquivo', arquivo)
        await apiPost('/submissoes', dados)
      }
      setSucesso(true)
      setForm(formVazio)
      setArquivo(null)
    } catch (err) {
      setErroGeral(err.message) // erro: os dados digitados continuam no formulário
    } finally {
      setEnviando(false)
    }
  }

  // Limpa o formulário, confirmando antes se houver algo preenchido
  function cancelar() {
    const temDados = Object.values(form).some((v) => v !== '') || arquivo
    if (temDados && !window.confirm('Descartar os dados preenchidos?')) return
    setForm(formVazio)
    setArquivo(null)
    setErros({})
    setErroGeral('')
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

      {semApi && (
        <div className="alert alert-warning py-2 small">Não foi possível conectar à API. O envio será apenas simulado.</div>
      )}
      {erroGeral && <div className="alert alert-danger py-2">{erroGeral}</div>}

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
            <select name="atividadeId" className="form-select" value={form.atividadeId} onChange={alterar}>
              <option value="">Nenhuma</option>
              {atividades.map((a) => <option key={a.id} value={a.id}>{a.titulo}</option>)}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Instituição promotora</label>
            <input name="instituicao" className="form-control" value={form.instituicao} onChange={alterar} />
          </div>

          <div className="col-md-3">
            <label className="form-label">Categoria *</label>
            <select name="categoriaId" className={`form-select ${erros.categoriaId ? 'is-invalid' : ''}`} value={form.categoriaId} onChange={alterar}>
              <option value="">Selecione</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <div className="invalid-feedback">{erros.categoriaId}</div>
          </div>

          <div className="col-md-3">
            <label className="form-label">Carga horária (h) *</label>
            <input name="cargaHoraria" type="number" min="1" className={`form-control ${erros.cargaHoraria ? 'is-invalid' : ''}`} value={form.cargaHoraria} onChange={alterar} />
            <div className="invalid-feedback">{erros.cargaHoraria}</div>
          </div>

          {/* Período de realização */}
          <div className="col-md-3">
            <label className="form-label">Início</label>
            <input name="dataInicio" type="date" max={hoje} className={`form-control ${erros.dataInicio ? 'is-invalid' : ''}`} value={form.dataInicio} onChange={alterar} />
            <div className="invalid-feedback">{erros.dataInicio}</div>
          </div>

          <div className="col-md-3">
            <label className="form-label">Fim</label>
            <input name="dataFim" type="date" max={hoje} className={`form-control ${erros.dataFim ? 'is-invalid' : ''}`} value={form.dataFim} onChange={alterar} />
            <div className="invalid-feedback">{erros.dataFim}</div>
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
