import { useState } from 'react'

// Dados de exemplo; depois virão de GET /atividades
const atividades = [
  { id: 1, titulo: 'Semana de Tecnologia', categoria: 'Extensão', data: '10/11/2026', horas: 20, modalidade: 'Presencial' },
  { id: 2, titulo: 'Monitoria de Algoritmos', categoria: 'Ensino', data: '15/11/2026', horas: 30, modalidade: 'Presencial' },
  { id: 3, titulo: 'Iniciação Científica em IA', categoria: 'Pesquisa', data: '20/11/2026', horas: 40, modalidade: 'Híbrido' },
  { id: 4, titulo: 'Curso de Git e GitHub', categoria: 'Ensino', data: '22/11/2026', horas: 8, modalidade: 'Online' },
  { id: 5, titulo: 'Projeto Social na Comunidade', categoria: 'Extensão', data: '28/11/2026', horas: 16, modalidade: 'Presencial' },
  { id: 6, titulo: 'Grupo de Estudos em Dados', categoria: 'Pesquisa', data: '01/12/2026', horas: 12, modalidade: 'Online' },
]

function Activities() {
  const [categoria, setCategoria] = useState('Todas')

  // "Todas" mostra a lista inteira; senão, só a categoria escolhida
  const filtradas = categoria === 'Todas'
    ? atividades
    : atividades.filter((a) => a.categoria === categoria)

  return (
    <>
      <h2 className="mb-4">Atividades Disponíveis</h2>

      <div className="row g-2 mb-4">
        {/* Busca só aceita digitação (o guia não exige resultado) */}
        <div className="col-md-8">
          <input className="form-control" placeholder="Buscar atividade..." />
        </div>
        <div className="col-md-4">
          <select className="form-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option>Todas</option>
            <option>Ensino</option>
            <option>Pesquisa</option>
            <option>Extensão</option>
          </select>
        </div>
      </div>

      {filtradas.length === 0 && (
        <p className="text-muted">Nenhuma atividade encontrada para esta categoria.</p>
      )}

      <div className="row g-3">
        {filtradas.map((a) => (
          <div className="col-md-4" key={a.id}>
            <div className="card p-3 h-100">
              <span className="badge bg-primary mb-2 align-self-start">{a.categoria}</span>
              <h5>{a.titulo}</h5>
              <p className="mb-1"><i className="bi bi-calendar"></i> {a.data}</p>
              <p className="mb-1"><i className="bi bi-clock"></i> {a.horas}h</p>
              <p className="mb-3"><i className="bi bi-geo-alt"></i> {a.modalidade}</p>
              {/* Sem ação ao clicar, só efeito visual (regra do guia) */}
              <button type="button" className="btn btn-outline-primary mt-auto">Ver detalhes</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default Activities