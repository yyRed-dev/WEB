import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <>
      <h1>Página não encontrada</h1>
      <Link to="/" className="btn btn-primary mt-3">Voltar ao início</Link>
    </>
  )
}

export default NotFound
