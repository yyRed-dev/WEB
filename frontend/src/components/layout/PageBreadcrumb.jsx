import { Link, useLocation } from 'react-router-dom'

// Nome de cada página, pelo endereço
const nomes = {
  '/atividades-complementares/dashboard': 'Dashboard',
  '/atividades-complementares/atividades': 'Atividades Disponíveis',
  '/atividades-complementares/certificados/enviar': 'Enviar Certificado',
  '/atividades-complementares/submissoes': 'Minhas Submissões',
  '/atividades-complementares/coordenador': 'Painel do Coordenador',
  '/atividades-complementares/coordenador/atividades': 'Gerenciar Atividades',
}

// "Atividades Complementares / [Página]"
function PageBreadcrumb() {
  const { pathname } = useLocation()
  const pagina = nomes[pathname] || 'Página não encontrada'

  return (
    <nav aria-label="breadcrumb">
      <ol className="breadcrumb mb-4">
        <li className="breadcrumb-item">
          {/* "/" leva à tela inicial do perfil (Dashboard ou Painel) */}
          <Link to="/">
            <i className="bi bi-house"></i> Atividades Complementares
          </Link>
        </li>
        <li className="breadcrumb-item active" aria-current="page">{pagina}</li>
      </ol>
    </nav>
  )
}

export default PageBreadcrumb
