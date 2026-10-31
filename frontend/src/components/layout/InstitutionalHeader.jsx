import { NavLink } from 'react-router-dom'

// NavLink adiciona a classe "active" no link da página atual
function InstitutionalHeader({ usuario, onSair }) {
  return (
    <nav className="navbar navbar-dark bg-primary">
      <div className="container">
        <div className="d-flex flex-wrap gap-3">
          <NavLink className="nav-link text-white" to="/atividades-complementares/dashboard">Dashboard</NavLink>
          <NavLink className="nav-link text-white" to="/atividades-complementares/atividades">Atividades</NavLink>
          <NavLink className="nav-link text-white" to="/atividades-complementares/certificados/enviar">Enviar Certificado</NavLink>
          <NavLink className="nav-link text-white" to="/atividades-complementares/submissoes">Minhas Submissões</NavLink>
          {/* Link do painel só aparece para coordenador */}
          {usuario.perfil === 'COORDENADOR' && (
            <NavLink className="nav-link text-white" to="/atividades-complementares/coordenador">Coordenador</NavLink>
          )}
        </div>

        <div className="d-flex align-items-center gap-3 text-white">
          <span><i className="bi bi-person-circle"></i> {usuario.nome}</span>
          <button type="button" className="btn btn-sm btn-light" onClick={onSair}>Sair</button>
        </div>
      </div>
    </nav>
  )
}

export default InstitutionalHeader
