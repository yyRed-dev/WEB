import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../services/api.js'
import { obterUsuarioLogado } from '../services/auth.js'

// Dados de exemplo (Figma), usados se a API não responder
const dadosExemplo = {
  curso: 'Ciência da Computação',
  concluidas: 125,
  minima: 200,
  categorias: [
    { nome: 'Ensino', concluidas: 40, meta: 60 },
    { nome: 'Pesquisa', concluidas: 35, meta: 50 },
    { nome: 'Extensão', concluidas: 50, meta: 90 },
  ],
}

function Dashboard() {
  const [dados, setDados] = useState(dadosExemplo)
  const [carregando, setCarregando] = useState(true)
  const [usandoExemplo, setUsandoExemplo] = useState(false)

  // Busca o progresso na API uma vez, quando a tela abre
  useEffect(() => {
    apiGet('/progresso')
      .then((resposta) => {
        setDados({
          curso: resposta.curso.nome,
          concluidas: resposta.horas.concluidas,
          minima: resposta.horas.minima,
          categorias: resposta.porCategoria.map((c) => ({
            nome: c.categoria.nome,
            concluidas: c.horasConcluidas,
            meta: c.meta,
          })),
        })
      })
      .catch(() => setUsandoExemplo(true))
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) return <p className="text-muted">Carregando...</p>

  const { curso, concluidas, minima, categorias } = dados
  const restantes = Math.max(0, minima - concluidas)
  const percentual = minima > 0 ? (concluidas / minima) * 100 : 0
  const primeiroNome = obterUsuarioLogado()?.nome.split(' ')[0]

  // Os três cards de resumo
  const resumo = [
    { titulo: 'Horas exigidas', valor: minima, icone: 'bi-flag' },
    { titulo: 'Horas concluídas', valor: concluidas, icone: 'bi-check-circle' },
    { titulo: 'Horas restantes', valor: restantes, icone: 'bi-hourglass-split' },
  ]

  return (
    <>
      {/* Identificação do aluno + atalhos */}
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h2 className="mb-1">Olá, {primeiroNome}! 👋</h2>
          <p className="text-muted mb-0">{curso}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/atividades-complementares/certificados/enviar" className="btn btn-primary">Enviar Certificado</Link>
          <Link to="/atividades-complementares/submissoes" className="btn btn-outline-primary">Minhas Submissões</Link>
        </div>
      </div>

      {usandoExemplo && (
        <div className="alert alert-warning py-2 small">Não foi possível conectar à API. Mostrando dados de exemplo.</div>
      )}

      <div className="row g-3 mb-4">
        {resumo.map((item) => (
          <div className="col-md-4" key={item.titulo}>
            <div className="card p-3">
              <span className="text-muted small"><i className={`bi ${item.icone}`}></i> {item.titulo}</span>
              <span className="fs-3 fw-semibold">{item.valor}h</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4 mb-4">
        <h5>Progresso geral</h5>
        <p className="mb-2">
          <strong>{concluidas}h</strong> de {minima}h ({percentual.toFixed(1).replace('.', ',')}%) — faltam {restantes}h
        </p>
        <div className="progress">
          <div className="progress-bar" style={{ width: `${Math.min(percentual, 100)}%` }}></div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {categorias.map((cat) => (
          <div className="col-md-4" key={cat.nome}>
            <div className="card p-3">
              <h6>{cat.nome}</h6>
              {/* Algumas categorias podem não ter meta definida */}
              <p className="mb-2">{cat.concluidas}h{cat.meta ? ` de ${cat.meta}h` : ''}</p>
              <div className="progress">
                <div className="progress-bar" style={{ width: `${cat.meta ? Math.min((cat.concluidas / cat.meta) * 100, 100) : 0}%` }}></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Link to="/atividades-complementares/atividades" className="btn btn-link px-0">
        Ver todas as atividades <i className="bi bi-arrow-right"></i>
      </Link>
    </>
  )
}

export default Dashboard
