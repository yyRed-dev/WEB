import { NavLink } from 'react-router-dom'

// NavLink adiciona a classe "active" no link da página atual
function InstitutionalHeader() {
  return (
    <nav className="navbar navbar-dark bg-primary">
      <div className="container">
        <div className="d-flex flex-wrap gap-3">
          <NavLink className="nav-link text-white" to="/atividades-complementares/dashboard">Dashboard</NavLink>
          <NavLink className="nav-link text-white" to="/atividades-complementares/atividades">Atividades</NavLink>
          <NavLink className="nav-link text-white" to="/atividades-complementares/certificados/enviar">Enviar Certificado</NavLink>
          <NavLink className="nav-link text-white" to="/atividades-complementares/submissoes">Minhas Submissões</NavLink>
          <NavLink className="nav-link text-white" to="/atividades-complementares/coordenador">Coordenador</NavLink>
        </div>
      </div>
    </nav>
  )
}

export default InstitutionalHeader
