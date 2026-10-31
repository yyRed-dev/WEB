// Dados de exemplo (Figma); depois virão de GET /progresso
const categorias = [
  { nome: 'Ensino', concluidas: 40, meta: 60 },
  { nome: 'Pesquisa', concluidas: 35, meta: 50 },
  { nome: 'Extensão', concluidas: 50, meta: 90 },
]

const concluidas = 125
const minima = 200

function Dashboard() {
  const percentual = (concluidas / minima) * 100

  return (
    <>
      <h2 className="mb-4">Dashboard</h2>

      <div className="card p-4 mb-4">
        <h5>Progresso geral</h5>
        <p className="mb-2">
          <strong>{concluidas}h</strong> de {minima}h ({percentual.toFixed(1).replace('.', ',')}%) — faltam {minima - concluidas}h
        </p>
        <div className="progress">
          <div className="progress-bar" style={{ width: `${percentual}%` }}></div>
        </div>
      </div>

      <div className="row g-3">
        {categorias.map((cat) => (
          <div className="col-md-4" key={cat.nome}>
            <div className="card p-3">
              <h6>{cat.nome}</h6>
              <p className="mb-2">{cat.concluidas}h de {cat.meta}h</p>
              <div className="progress">
                <div className="progress-bar" style={{ width: `${(cat.concluidas / cat.meta) * 100}%` }}></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default Dashboard