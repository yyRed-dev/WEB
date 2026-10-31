import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Activities from './pages/Activities.jsx'
import SubmitCertificate from './pages/SubmitCertificate.jsx'
import MySubmissions from './pages/MySubmissions.jsx'
import Coordinator from './pages/Coordinator.jsx'
import ManageActivities from './pages/ManageActivities.jsx'
import NotFound from './pages/NotFound.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import InstitutionalHeader from './components/layout/InstitutionalHeader.jsx'
import PageBreadcrumb from './components/layout/PageBreadcrumb.jsx'
import { obterUsuarioLogado, sair } from './services/auth.js'

const DASHBOARD = '/atividades-complementares/dashboard'
const PAINEL = '/atividades-complementares/coordenador'

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

  const ehAluno = usuario.perfil === 'ALUNO'
  const ehCoordenador = usuario.perfil === 'COORDENADOR'
  // Tela inicial de cada perfil: aluno no Dashboard, coordenador no Painel
  const inicio = <Navigate to={ehCoordenador ? PAINEL : DASHBOARD} replace />

  return (
    <>
      <InstitutionalHeader usuario={usuario} onSair={handleSair} />
      <div className="container py-4">
        <PageBreadcrumb />
        {/* Mostra só a página que combina com a URL atual */}
        <Routes>
          {/* "/", login e cadastro (já logado) levam à tela inicial do perfil */}
          <Route path="/" element={inicio} />
          <Route path="/login" element={inicio} />
          <Route path="/cadastro" element={inicio} />
          <Route path="/atividades-complementares/atividades" element={<Activities />} />
          {/* Telas só de aluno e só de coordenador; sem permissão, volta ao início (a API também vai validar) */}
          <Route path={DASHBOARD} element={ehAluno ? <Dashboard /> : inicio} />
          <Route path="/atividades-complementares/certificados/enviar" element={ehAluno ? <SubmitCertificate /> : inicio} />
          <Route path="/atividades-complementares/submissoes" element={ehAluno ? <MySubmissions /> : inicio} />
          <Route path={PAINEL} element={ehCoordenador ? <Coordinator /> : inicio} />
          <Route path="/atividades-complementares/coordenador/atividades" element={ehCoordenador ? <ManageActivities /> : inicio} />
          {/* Qualquer endereço desconhecido */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </>
  )
}

export default App
