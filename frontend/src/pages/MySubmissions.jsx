import { useState } from 'react'

// Dados de exemplo até a rota de submissões existir na API
const submissoes = [
  { id: 1, atividade: 'Semana de Tecnologia', horas: 20, data: '05/10/2026', status: 'Aprovada', motivo: '' },
  { id: 2, atividade: 'Curso de Git e GitHub', horas: 8, data: '12/10/2026', status: 'Pendente', motivo: '' },
  { id: 3, atividade: 'Palestra de Carreira', horas: 4, data: '18/10/2026', status: 'Rejeitada', motivo: 'Certificado ilegível' },
  { id: 4, atividade: 'Monitoria de Algoritmos', horas: 30, data: '20/10/2026', status: 'Pendente', motivo: '' },
]

// Cor do badge para cada status
const coresStatus = {
  Aprovada: 'bg-success',
  Pendente: 'bg-warning text-dark',
  Rejeitada: 'bg-danger',
}

function MySubmissions() {
  const [status, setStatus] = useState('Todos')

  const filtradas = status === 'Todos'
    ? submissoes
    : submissoes.filter((s) => s.status === status)

  return (
    <>
      <h2 className="mb-4">Minhas Submissões</h2>

      <div className="col-md-4 mb-4">
        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>Todos</option>
          <option>Pendente</option>
          <option>Aprovada</option>
          <option>Rejeitada</option>
        </select>
      </div>

      {filtradas.length === 0 ? (
        <p className="text-muted">Nenhuma submissão encontrada para este status.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover bg-white">
            <thead>
              <tr>
                <th>Atividade</th>
                <th>Horas</th>
                <th>Data de envio</th>
                <th>Status</th>
                <th>Motivo da rejeição</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((s) => (
                <tr key={s.id}>
                  <td>{s.atividade}</td>
                  <td>{s.horas}h</td>
                  <td>{s.data}</td>
                  <td><span className={`badge ${coresStatus[s.status]}`}>{s.status}</span></td>
                  <td>{s.motivo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default MySubmissions