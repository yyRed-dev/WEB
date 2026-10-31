import { useState } from 'react'

// Dados de exemplo até as rotas do coordenador existirem na API
const dadosIniciais = [
  { id: 1, nome: 'Ana Souza', matricula: '2310001', atividade: 'Semana de Tecnologia', categoria: 'Extensão', horas: 20, status: 'Pendente' },
  { id: 2, nome: 'Bruno Lima', matricula: '2310002', atividade: 'Monitoria de Algoritmos', categoria: 'Ensino', horas: 30, status: 'Pendente' },
  { id: 3, nome: 'Carla Mendes', matricula: '2310003', atividade: 'Iniciação Científica em IA', categoria: 'Pesquisa', horas: 40, status: 'Aprovada' },
  { id: 4, nome: 'Diego Rocha', matricula: '2310004', atividade: 'Curso de Git e GitHub', categoria: 'Ensino', horas: 8, status: 'Rejeitada' },
  { id: 5, nome: 'Elisa Castro', matricula: '2310005', atividade: 'Projeto Social na Comunidade', categoria: 'Extensão', horas: 16, status: 'Pendente' },
]

const coresStatus = {
  Aprovada: 'bg-success',
  Pendente: 'bg-warning text-dark',
  Rejeitada: 'bg-danger',
}

function Coordinator() {
  // A lista fica em estado porque muda ao aprovar/rejeitar
  const [submissoes, setSubmissoes] = useState(dadosIniciais)
  const [categoria, setCategoria] = useState('Todas')
  const [status, setStatus] = useState('Todos')

  // A linha precisa passar nos dois filtros ao mesmo tempo
  const filtradas = submissoes.filter((s) =>
    (categoria === 'Todas' || s.categoria === categoria) &&
    (status === 'Todos' || s.status === status)
  )

  // Cria uma lista nova com o status trocado (o estado não é alterado diretamente)
  function mudarStatus(id, novoStatus) {
    setSubmissoes(submissoes.map((s) => (s.id === id ? { ...s, status: novoStatus } : s)))
  }

  function aprovar(s) {
    if (window.confirm(`Aprovar a submissão de ${s.nome}?`)) {
      mudarStatus(s.id, 'Aprovada')
    }
  }

  function rejeitar(s) {
    const motivo = window.prompt('Informe o motivo da rejeição:')
    if (!motivo) return // cancelou ou deixou vazio
    if (window.confirm(`Rejeitar a submissão de ${s.nome}?`)) {
      mudarStatus(s.id, 'Rejeitada')
    }
  }

  return (
    <>
      <h2 className="mb-4">Painel do Coordenador</h2>

      <div className="row g-2 mb-4">
        <div className="col-md-4">
          <select className="form-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option>Todas</option>
            <option>Ensino</option>
            <option>Pesquisa</option>
            <option>Extensão</option>
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
                  <td>{s.atividade}</td>
                  <td>{s.categoria}</td>
                  <td>{s.horas}h</td>
                  <td><button type="button" className="btn btn-sm btn-link p-0">Ver certificado</button></td>
                  <td><span className={`badge ${coresStatus[s.status]}`}>{s.status}</span></td>
                  <td>
                    {/* Só submissões pendentes podem ser analisadas */}
                    {s.status === 'Pendente' && (
                      <div className="d-flex gap-2">
                        <button type="button" className="btn btn-sm btn-success" onClick={() => aprovar(s)}>Aprovar</button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => rejeitar(s)}>Rejeitar</button>
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