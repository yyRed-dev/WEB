import { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '../services/api.js'
import { semPrefixoDemo } from '../services/auth.js'

// Dados de exemplo, usados se a API não responder
const dadosExemplo = [
  { id: 1, nome: 'Ana Souza', matricula: '2310001', atividade: 'Semana de Tecnologia', categoria: 'Extensão', horas: 20, status: 'Pendente', certificadoUrl: null, alerta: false },
  { id: 2, nome: 'Bruno Lima', matricula: '2310002', atividade: 'Monitoria de Algoritmos', categoria: 'Ensino', horas: 30, status: 'Pendente', certificadoUrl: null, alerta: false },
  { id: 3, nome: 'Carla Mendes', matricula: '2310003', atividade: 'Iniciação Científica em IA', categoria: 'Pesquisa', horas: 40, status: 'Aprovada', certificadoUrl: null, alerta: false },
  { id: 4, nome: 'Diego Rocha', matricula: '2310004', atividade: 'Curso de Git e GitHub', categoria: 'Ensino', horas: 8, status: 'Rejeitada', certificadoUrl: null, alerta: false },
  { id: 5, nome: 'Elisa Castro', matricula: '2310005', atividade: 'Projeto Social na Comunidade', categoria: 'Extensão', horas: 16, status: 'Pendente', certificadoUrl: null, alerta: false },
]
const categoriasExemplo = ['Ensino', 'Pesquisa', 'Extensão']

const nomesStatus = { PENDENTE: 'Pendente', APROVADA: 'Aprovada', REJEITADA: 'Rejeitada' }

const coresStatus = {
  Aprovada: 'bg-success',
  Pendente: 'bg-warning text-dark',
  Rejeitada: 'bg-danger',
}

// Converte uma submissão da API para o formato da tabela
function daApi(s) {
  return {
    id: s.id,
    nome: semPrefixoDemo(s.aluno?.nome),
    matricula: s.aluno?.matricula,
    atividade: s.titulo,
    categoria: s.categoria.nome,
    horas: s.horasSolicitadas,
    status: nomesStatus[s.status] || s.status,
    certificadoUrl: s.certificado?.url || null, // link assinado: abre direto numa nova aba
    alerta: Boolean(s.alertaDuplicidade), // a API avisa quando parece duplicada
  }
}

function Coordinator() {
  // A lista fica em estado porque muda ao aprovar/rejeitar
  const [submissoes, setSubmissoes] = useState(dadosExemplo)
  const [categorias, setCategorias] = useState(categoriasExemplo)
  const [categoria, setCategoria] = useState('Todas')
  const [status, setStatus] = useState('Todos')
  const [carregando, setCarregando] = useState(true)
  const [usandoExemplo, setUsandoExemplo] = useState(false)
  const [processando, setProcessando] = useState(null) // id da linha sendo avaliada
  const [erro, setErro] = useState('')

  // Busca as submissões dos alunos do curso do coordenador
  useEffect(() => {
    Promise.all([apiGet('/submissoes?porPagina=100'), apiGet('/categorias')])
      .then(([respSubmissoes, respCategorias]) => {
        setSubmissoes(respSubmissoes.submissoes.map(daApi))
        setCategorias(respCategorias.categorias.map((c) => c.nome))
      })
      .catch(() => setUsandoExemplo(true))
      .finally(() => setCarregando(false))
  }, [])

  // A linha precisa passar nos dois filtros ao mesmo tempo
  const filtradas = submissoes.filter((s) =>
    (categoria === 'Todas' || s.categoria === categoria) &&
    (status === 'Todos' || s.status === status)
  )

  // Avalia na API (ou só na tela, sem API) e troca a linha pela versão atualizada
  async function avaliar(s, acao, corpo) {
    setErro('')
    setProcessando(s.id) // impede clicar de novo enquanto avalia
    try {
      let atualizada
      if (usandoExemplo) {
        atualizada = { ...s, status: acao === 'aprovar' ? 'Aprovada' : 'Rejeitada' }
      } else {
        const resposta = await apiPatch(`/submissoes/${s.id}/${acao}`, corpo)
        atualizada = daApi(resposta.submissao)
      }
      setSubmissoes((lista) => lista.map((item) => (item.id === s.id ? atualizada : item)))
    } catch (err) {
      setErro(err.message)
    } finally {
      setProcessando(null)
    }
  }

  function aprovar(s) {
    if (window.confirm(`Aprovar a submissão de ${s.nome}?`)) {
      avaliar(s, 'aprovar', {})
    }
  }

  function rejeitar(s) {
    const motivo = window.prompt('Informe o motivo da rejeição:')
    if (motivo === null) return // cancelou
    if (motivo.trim().length < 5) {
      window.alert('O motivo deve ter pelo menos 5 caracteres.')
      return
    }
    if (window.confirm(`Rejeitar a submissão de ${s.nome}?`)) {
      avaliar(s, 'rejeitar', { motivo: motivo.trim() })
    }
  }

  if (carregando) return <p className="text-muted">Carregando...</p>

  return (
    <>
      <h2 className="mb-4">Painel do Coordenador</h2>

      {usandoExemplo && (
        <div className="alert alert-warning py-2 small">Não foi possível conectar à API. Mostrando dados de exemplo.</div>
      )}
      {erro && <div className="alert alert-danger py-2">{erro}</div>}

      <div className="row g-2 mb-4">
        <div className="col-md-4">
          <select className="form-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option>Todas</option>
            {categorias.map((nome) => <option key={nome}>{nome}</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Todos</option>
            <option>Pendente</option>
            <option>Aprovada</option>
            <option>Rejeitada</option>
          </select>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <p className="text-muted">Nenhuma submissão encontrada com esses filtros.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover bg-white align-middle">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Matrícula</th>
                <th>Atividade</th>
                <th>Categoria</th>
                <th>Horas</th>
                <th>Certificado</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((s) => (
                <tr key={s.id}>
                  <td>{s.nome}</td>
                  <td>{s.matricula}</td>
                  <td>
                    {s.atividade}
                    {s.alerta && (
                      <span className="badge bg-warning-subtle text-warning-emphasis ms-2" title="Pode ser um envio duplicado">
                        <i className="bi bi-exclamation-triangle"></i> Possível duplicidade
                      </span>
                    )}
                  </td>
                  <td>{s.categoria}</td>
                  <td>{s.horas}h</td>
                  <td>
                    {s.certificadoUrl ? (
                      <a href={s.certificadoUrl} target="_blank" rel="noopener noreferrer">Ver certificado</a>
                    ) : (
                      <span className="text-muted">Ver certificado</span>
                    )}
                  </td>
                  <td><span className={`badge ${coresStatus[s.status]}`}>{s.status}</span></td>
                  <td>
                    {/* Só submissões pendentes podem ser analisadas */}
                    {s.status === 'Pendente' && (
                      <div className="d-flex gap-2">
                        <button type="button" className="btn btn-sm btn-success" disabled={processando === s.id} onClick={() => aprovar(s)}>Aprovar</button>
                        <button type="button" className="btn btn-sm btn-danger" disabled={processando === s.id} onClick={() => rejeitar(s)}>Rejeitar</button>
                      </div>
                    )}
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

export default Coordinator
