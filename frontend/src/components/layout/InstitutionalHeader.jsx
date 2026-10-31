import ComplementaryActivitiesDropdown from './ComplementaryActivitiesDropdown.jsx'

function InstitutionalHeader({ usuario, onSair }) {
  return (
    <nav className="navbar navbar-dark bg-primary">
      <div className="container">
        <ComplementaryActivitiesDropdown perfil={usuario.perfil} />

        <div className="d-flex align-items-center gap-3 text-white">
          <span><i className="bi bi-person-circle"></i> {usuario.nome}</span>
          <button type="button" className="btn btn-sm btn-light" onClick={onSair}>Sair</button>
        </div>
      </div>
    </nav>
  )
}

export default InstitutionalHeader
