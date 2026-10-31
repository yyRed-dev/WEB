import { useEffect, useState } from 'react'
import { apiGet } from '../services/api.js'

// Dados de exemplo, usados se a API não responder
const atividadesExemplo = [
  { id: 1, titulo: 'Semana de Tecnologia', categoria: 'Extensão', data: '10/11/2026', horario: '08:00', local: 'Auditório A', horas: 20, modalidade: 'Presencial' },
  { id: 2, titulo: 'Monitoria de Algoritmos', categoria: 'Ensino', data: '15/11/2026', horario: '14:00', local: 'Bloco J, sala 12', horas: 30, modalidade: 'Presencial' },
  { id: 3, titulo: 'Iniciação Científica em IA', categoria: 'Pesquisa', data: '20/11/2026', horario: '10:00', local: 'Laboratório de IA', horas: 40, modalidade: 'Híbrida' },
  { id: 4, titulo: 'Curso de Git e GitHub', categoria: 'Ensino', data: '22/11/2026', horario: '19:00', local: 'Online', horas: 8, modalidade: 'Online' },
  { id: 5, titulo: 'Projeto Social na Comunidade', categoria: 'Extensão', data: '28/11/2026', horario: '09:00', local: 'Comunidade do Dendê', horas: 16, modalidade: 'Presencial' },
  { id: 6, titulo: 'Grupo de Estudos em Dados', categoria: 'Pesquisa', data: '01/12/2026', horario: '18:30', local: 'Online', horas: 12, modalidade: 'Online' },
]
const categoriasExemplo = ['Ensino', 'Pesquisa', 'Extensão']

const nomesModalidade = { PRESENCIAL: 'Presencial', ONLINE: 'Online', HIBRIDA: 'Híbrida' }

// Converte uma atividade da API para o formato usado na tela
function daApi(a) {
  const inicio = new Date(a.dataInicio)
  return {
    id: a.id,
    titulo: a.titulo,
    categoria: a.categoria.nome,
    data: inicio.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' }),
    horario: inicio.toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit' }),
    local: a.local, // pode vir vazio: não inventamos um local
    horas: a.cargaHoraria,
    modalidade: nomesModalidade[a.modalidade] || a.modalidade,
  }
}

function Activities() {
  const [atividades, setAtividades] = useState(atividadesExemplo)
  const [categorias, setCategorias] = useState(categoriasExemplo)
  const [categoria, setCategoria] = useState('Todas')
  const [carregando, setCarregando] = useState(true)
  const [usandoExemplo, setUsandoExemplo] = useState(false)

  // Busca atividades e categorias juntas, quando a tela abre
  useEffect(() => {
    Promise.all([apiGet('/atividades?porPagina=100'), apiGet('/categorias')])
      .then(([respAtividades, respCategorias]) => {
        setAtividades(respAtividades.atividades.map(daApi))
        setCategorias(respCategorias.categorias.map((c) => c.nome))
      })
      .catch(() => setUsandoExemplo(true))
      .finally(() => setCarregando(false))
  }, [])

  // "Todas" mostra a lista inteira; senão, só a categoria escolhida
  const filtradas = categoria === 'Todas'
    ? atividades
    : atividades.filter((a) => a.categoria === categoria)

  if (carregando) return <p className="text-muted">Carregando...</p>

  return (
    <>
      <h2 className="mb-4">Atividades Disponíveis</h2>

      {usandoExemplo && (
        <div className="alert alert-warning py-2 small">Não foi possível conectar à API. Mostrando dados de exemplo.</div>
      )}

      <div className="row g-2 mb-4">
        {/* Busca só aceita digitação (o guia não exige resultado) */}
        <div className="col-md-8">
          <input className="form-control" placeholder="Buscar atividade..." />
        </div>
        <div className="col-md-4">
          <select className="form-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option>Todas</option>
            {categorias.map((nome) => (
              <option key={nome}>{nome}</option>
            ))}
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
              <p className="mb-1"><i className="bi bi-calendar"></i> {a.data} às {a.horario}</p>
              {a.local && <p className="mb-1"><i className="bi bi-geo-alt"></i> {a.local}</p>}
              <p className="mb-1"><i className="bi bi-clock"></i> {a.horas}h</p>
              <p className="mb-3"><i className="bi bi-laptop"></i> {a.modalidade}</p>
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
