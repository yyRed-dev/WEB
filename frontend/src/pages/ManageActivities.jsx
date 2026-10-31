import { useEffect, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api.js'

// Dados de exemplo, usados se a API não responder
const categoriasExemplo = [
  { id: 1, nome: 'Ensino' },
  { id: 2, nome: 'Pesquisa' },
  { id: 3, nome: 'Extensão' },
]
const tiposExemplo = ['Evento', 'Minicurso', 'Workshop', 'Curso', 'Monitoria', 'Projeto', 'Outro']
  .map((nome, i) => ({ id: i + 1, nome }))
const atividadesExemplo = [
  { id: 1, titulo: 'Semana de Tecnologia', descricao: 'Palestras e oficinas sobre tecnologia.', categoriaId: 3, categoria: 'Extensão', tipoId: 1, modalidade: 'PRESENCIAL', data: '2026-11-10', horario: '08:00', local: 'Auditório A', cargaHoraria: 20 },
  { id: 2, titulo: 'Monitoria de Algoritmos', descricao: 'Apoio aos alunos de Algoritmos I.', categoriaId: 1, categoria: 'Ensino', tipoId: 5, modalidade: 'PRESENCIAL', data: '2026-11-15', horario: '14:00', local: 'Bloco J, sala 12', cargaHoraria: 30 },
  { id: 3, titulo: 'Grupo de Estudos em Dados', descricao: 'Encontros semanais sobre ciência de dados.', categoriaId: 2, categoria: 'Pesquisa', tipoId: 6, modalidade: 'ONLINE', data: '2026-12-01', horario: '18:30', local: 'Microsoft Teams', cargaHoraria: 12 },
]

const modalidades = [
  { valor: 'PRESENCIAL', nome: 'Presencial' },
  { valor: 'ONLINE', nome: 'Online' },
  { valor: 'HIBRIDA', nome: 'Híbrida' },
]

const formVazio = {
  titulo: '', descricao: '', categoriaId: '', tipoId: '', modalidade: 'PRESENCIAL',
  data: '', horario: '', local: '', cargaHoraria: '',
}

// Converte uma atividade da API para o formato da tela (data e hora no fuso de Fortaleza)
function daApi(a) {
  const [data, hora] = new Date(a.dataInicio).toLocaleString('sv-SE', { timeZone: 'America/Fortaleza' }).split(' ')
  return {
    id: a.id,
    titulo: a.titulo,
    descricao: a.descricao,
    categoriaId: a.categoria.id,
    categoria: a.categoria.nome,
    tipoId: a.tipo.id,
    modalidade: a.modalidade,
    data,
    horario: hora.slice(0, 5),
    local: a.local || '',
    cargaHoraria: a.cargaHoraria,
  }
}

// 2026-11-10 -> 10/11/2026
function formatarData(data) {
  return data.split('-').reverse().join('/')
}

function ManageActivities() {
  const [atividades, setAtividades] = useState(atividadesExemplo)
  const [categorias, setCategorias] = useState(categoriasExemplo)
  const [tipos, setTipos] = useState(tiposExemplo)
  const [carregando, setCarregando] = useState(true)
  const [usandoExemplo, setUsandoExemplo] = useState(false)

  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null) // null = nova atividade
  const [form, setForm] = useState(formVazio)
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Busca atividades, categorias e tipos quando a tela abre
  useEffect(() => {
    Promise.all([apiGet('/atividades?porPagina=100'), apiGet('/categorias'), apiGet('/tipos-atividade')])
      .then(([respAtividades, respCategorias, respTipos]) => {
        setAtividades(respAtividades.atividades.map(daApi))
        setCategorias(respCategorias.categorias)
        setTipos(respTipos.tipos)
      })
      .catch(() => setUsandoExemplo(true))
      .finally(() => setCarregando(false))
  }, [])

  function alterar(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function abrirNova() {
    setForm(formVazio)
    setEditandoId(null)
    setErros({})
    setErroGeral('')
    setMensagem('')
    setMostrarForm(true)
  }

  function abrirEdicao(atividade) {
    setForm({ ...atividade, categoriaId: String(atividade.categoriaId), tipoId: String(atividade.tipoId), cargaHoraria: String(atividade.cargaHoraria) })
    setEditandoId(atividade.id)
    setErros({})
    setErroGeral('')
    setMensagem('')
    setMostrarForm(true)
  }

  function fecharForm() {
    setMostrarForm(false)
    setEditandoId(null)
  }

  // Mesmas regras que o back valida
  function validar() {
    const novosErros = {}
    const carga = Number(form.cargaHoraria)
    if (form.titulo.trim().length < 3) novosErros.titulo = 'O título deve ter pelo menos 3 caracteres.'
    if (form.descricao.trim().length < 10) novosErros.descricao = 'A descrição deve ter pelo menos 10 caracteres.'
    if (!form.categoriaId) novosErros.categoriaId = 'Escolha a categoria.'
    if (!form.tipoId) novosErros.tipoId = 'Escolha o tipo.'
    if (!form.data) novosErros.data = 'Informe a data.'
    if (!form.horario) novosErros.horario = 'Informe o horário.'
    if (!form.local.trim()) novosErros.local = 'Informe o local (ou a plataforma, se for online).'
    if (!carga || carga <= 0 || carga > 999.99) novosErros.cargaHoraria = 'Informe uma carga horária entre 0 e 999,99.'
    return novosErros
  }

  async function salvar(e) {
    e.preventDefault()
    if (salvando) return // bloqueia envio duplo

    const novosErros = validar()
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return

    // Formato que a API espera
    const corpo = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim(),
      categoriaId: Number(form.categoriaId),
      tipoId: Number(form.tipoId),
      modalidade: form.modalidade,
      dataInicio: `${form.data}T${form.horario}`,
      local: form.local.trim(),
      cargaHoraria: Number(form.cargaHoraria),
    }

    setSalvando(true)
    setErroGeral('')
    try {
      let salva
      if (usandoExemplo) {
        // Sem API: salva só na tela
        const categoria = categorias.find((c) => c.id === corpo.categoriaId)?.nome
        salva = { ...form, ...corpo, id: editandoId ?? Date.now(), categoria }
      } else if (editandoId) {
        salva = daApi((await apiPatch(`/atividades/${editandoId}`, corpo)).atividade)
      } else {
        salva = daApi((await apiPost('/atividades', corpo)).atividade)
      }

      // Atualiza a lista: troca a editada ou acrescenta a nova
      setAtividades(editandoId
        ? atividades.map((a) => (a.id === editandoId ? salva : a))
        : [...atividades, salva])
      setMensagem(editandoId ? 'Atividade atualizada.' : 'Atividade cadastrada.')
      fecharForm()
    } catch (err) {
      setErroGeral(err.message) // mantém os dados digitados
    } finally {
      setSalvando(false)
    }
  }

  async function remover(atividade) {
    if (!window.confirm(`Remover a atividade "${atividade.titulo}"?`)) return
    try {
      // Na API, remover = cancelar (a atividade sai do catálogo)
      if (!usandoExemplo) await apiDelete(`/atividades/${atividade.id}`)
      setAtividades(atividades.filter((a) => a.id !== atividade.id))
      setMensagem('Atividade removida.')
    } catch (err) {
      setMensagem('')
      setErroGeral(err.message)
    }
  }

  // Campo de texto com label e mensagem de erro
  function campo(name, label, type = 'text', col = 'col-md-6') {
    return (
      <div className={col}>
        <label className="form-label">{label}</label>
        <input name={name} type={type} className={`form-control ${erros[name] ? 'is-invalid' : ''}`} value={form[name]} onChange={alterar} />
        <div className="invalid-feedback">{erros[name]}</div>
      </div>
    )
  }

  if (carregando) return <p className="text-muted">Carregando...</p>

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <h2 className="mb-0">Gerenciar Atividades</h2>
        {!mostrarForm && (
          <button type="button" className="btn btn-primary" onClick={abrirNova}>
            <i className="bi bi-plus-lg"></i> Nova atividade
          </button>
        )}
      </div>

      {usandoExemplo && (
        <div className="alert alert-warning py-2 small">Não foi possível conectar à API. As alterações valem só nesta tela.</div>
      )}
      {mensagem && <div className="alert alert-success py-2">{mensagem}</div>}
      {erroGeral && !mostrarForm && <div className="alert alert-danger py-2">{erroGeral}</div>}

      {/* Formulário de cadastro/edição */}
      {mostrarForm && (
        <form className="card p-4 mb-4" onSubmit={salvar} noValidate>
          <h5 className="mb-3">{editandoId ? 'Editar atividade' : 'Nova atividade'}</h5>
          {erroGeral && <div className="alert alert-danger py-2">{erroGeral}</div>}

          <div className="row g-3">
            {campo('titulo', 'Título *', 'text', 'col-12')}

            <div className="col-12">
              <label className="form-label">Descrição *</label>
              <textarea name="descricao" rows="3" className={`form-control ${erros.descricao ? 'is-invalid' : ''}`} value={form.descricao} onChange={alterar}></textarea>
              <div className="invalid-feedback">{erros.descricao}</div>
            </div>

            <div className="col-md-4">
              <label className="form-label">Categoria *</label>
              <select name="categoriaId" className={`form-select ${erros.categoriaId ? 'is-invalid' : ''}`} value={form.categoriaId} onChange={alterar}>
                <option value="">Selecione</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <div className="invalid-feedback">{erros.categoriaId}</div>
            </div>

            <div className="col-md-4">
              <label className="form-label">Tipo *</label>
              <select name="tipoId" className={`form-select ${erros.tipoId ? 'is-invalid' : ''}`} value={form.tipoId} onChange={alterar}>
                <option value="">Selecione</option>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <div className="invalid-feedback">{erros.tipoId}</div>
            </div>

            <div className="col-md-4">
              <label className="form-label">Modalidade *</label>
              <select name="modalidade" className="form-select" value={form.modalidade} onChange={alterar}>
                {modalidades.map((m) => <option key={m.valor} value={m.valor}>{m.nome}</option>)}
              </select>
            </div>

            {campo('data', 'Data *', 'date', 'col-md-3')}
            {campo('horario', 'Horário *', 'time', 'col-md-3')}
            {campo('local', 'Local *', 'text', 'col-md-4')}
            {campo('cargaHoraria', 'Carga horária (h) *', 'number', 'col-md-2')}
          </div>

          <div className="d-flex gap-2 mt-4">
            <button type="submit" className="btn btn-primary" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={fecharForm} disabled={salvando}>Cancelar</button>
          </div>
        </form>
      )}

      {atividades.length === 0 ? (
        <p className="text-muted">Nenhuma atividade cadastrada.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover bg-white align-middle">
            <thead>
              <tr>
                <th>Título</th>
                <th>Categoria</th>
                <th>Data</th>
                <th>Local</th>
                <th>Carga</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {atividades.map((a) => (
                <tr key={a.id}>
                  <td>{a.titulo}</td>
                  <td>{a.categoria}</td>
                  <td>{formatarData(a.data)} às {a.horario}</td>
                  <td>{a.local}</td>
                  <td>{a.cargaHoraria}h</td>
                  <td>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => abrirEdicao(a)}>Editar</button>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remover(a)}>Remover</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default ManageActivities
