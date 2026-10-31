import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Activities from './pages/Activities.jsx'
import SubmitCertificate from './pages/SubmitCertificate.jsx'
import MySubmissions from './pages/MySubmissions.jsx'
import Coordinator from './pages/Coordinator.jsx'
import NotFound from './pages/NotFound.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import InstitutionalHeader from './components/layout/InstitutionalHeader.jsx'
import { obterUsuarioLogado, sair } from './services/auth.js'

const DASHBOARD = '/atividades-complementares/dashboard'

function App() {
  // Começa com o usuário salvo no navegador (se já tiver feito login antes)
  const [usuario, setUsuario] = useState(obterUsuarioLogado)

  function handleSair() {
    sair()
    setUsuario(null)
  }

  // Sem login: só as telas de entrar e criar conta
  if (!usuario) {
    return (
      <div className="container py-5">
        <Routes>
          <Route path="/login" element={<Login onLogin={setUsuario} />} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    )
  }

  const ehCoordenador = usuario.perfil === 'COORDENADOR'

  return (
    <>
      <InstitutionalHeader usuario={usuario} onSair={handleSair} />
      <div className="container py-4">
        <h1 className="text-primary">Atividades Complementares</h1>
        {/* Mostra só a página que combina com a URL atual */}
        <Routes>
          <Route path="/" element={<Navigate to={DASHBOARD} replace />} />
          {/* Já logado: login e cadastro levam ao Dashboard */}
          <Route path="/login" element={<Navigate to={DASHBOARD} replace />} />
          <Route path="/cadastro" element={<Navigate to={DASHBOARD} replace />} />
          <Route path={DASHBOARD} element={<Dashboard />} />
          <Route path="/atividades-complementares/atividades" element={<Activities />} />
          <Route path="/atividades-complementares/certificados/enviar" element={<SubmitCertificate />} />
          <Route path="/atividades-complementares/submissoes" element={<MySubmissions />} />
          {/* Só o coordenador acessa o painel (a API também vai validar) */}
          <Route
            path="/atividades-complementares/coordenador"
            element={ehCoordenador ? <Coordinator /> : <Navigate to={DASHBOARD} replace />}
          />
          {/* Qualquer endereço desconhecido */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </>
  )
}

export default App
