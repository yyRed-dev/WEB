import { useEffect, useState } from 'react'
import { apiGet } from '../services/api.js'

// Dados de exemplo, usados se a API não responder
const submissoesExemplo = [
  { id: 1, atividade: 'Semana de Tecnologia', horas: 20, data: '05/10/2026', status: 'Aprovada', motivo: '' },
  { id: 2, atividade: 'Curso de Git e GitHub', horas: 8, data: '12/10/2026', status: 'Pendente', motivo: '' },
  { id: 3, atividade: 'Palestra de Carreira', horas: 4, data: '18/10/2026', status: 'Rejeitada', motivo: 'Certificado ilegível' },
  { id: 4, atividade: 'Monitoria de Algoritmos', horas: 30, data: '20/10/2026', status: 'Pendente', motivo: '' },
]

// A API usa PENDENTE/APROVADA/REJEITADA; a tela mostra com a primeira letra maiúscula
const nomesStatus = { PENDENTE: 'Pendente', APROVADA: 'Aprovada', REJEITADA: 'Rejeitada' }

// Cor do badge (Bootstrap) para cada status
const coresStatus = {
  Aprovada: 'bg-success',
  Pendente: 'bg-warning text-dark',
  Rejeitada: 'bg-danger',
}

// Converte uma submissão da API para o formato da tabela
function daApi(s) {
  return {
    id: s.id,
    atividade: s.titulo,
    // Se aprovada, mostra as horas que valeram de fato
    horas: s.status === 'APROVADA' && s.horasAprovadas != null ? s.horasAprovadas : s.horasSolicitadas,
    data: new Date(s.enviadaEm).toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' }),
    status: nomesStatus[s.status] || s.status,
    motivo: s.motivoRejeicao || '',
  }
}

function MySubmissions() {
  const [submissoes, setSubmissoes] = useState(submissoesExemplo)
  const [status, setStatus] = useState('Todos')
  const [carregando, setCarregando] = useState(true)
  const [usandoExemplo, setUsandoExemplo] = useState(false)

  // Busca as submissões do aluno logado quando a tela abre
  useEffect(() => {
    apiGet('/submissoes/minhas?porPagina=100')
      .then((resposta) => setSubmissoes(resposta.submissoes.map(daApi)))
      .catch(() => setUsandoExemplo(true))
      .finally(() => setCarregando(false))
  }, [])

  const filtradas = status === 'Todos'
    ? submissoes
    : submissoes.filter((s) => s.status === status)

  if (carregando) return <p className="text-muted">Carregando...</p>

  return (
    <>
      <h2 className="mb-4">Minhas Submissões</h2>

      {usandoExemplo && (
        <div className="alert alert-warning py-2 small">Não foi possível conectar à API. Mostrando dados de exemplo.</div>
      )}

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
