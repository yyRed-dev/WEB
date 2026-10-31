import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <>
      <h1>Página não encontrada</h1>
      <Link to="/atividades-complementares/dashboard" className="btn btn-primary mt-3">Voltar ao Dashboard</Link>
    </>
  )
}

export default NotFound
