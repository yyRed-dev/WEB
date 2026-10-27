function InstitutionalHeader() {
  return (
    <nav className="navbar navbar-dark bg-primary">
      <div className="container">
        <div className="d-flex gap-3">
          <span className="nav-link text-white">Minhas Disciplinas</span>
          <span className="nav-link text-white">
            Atividades Complementares <i className="bi bi-chevron-down"></i>
          </span>
        </div>
      </div>
    </nav>
  )
}

export default InstitutionalHeader