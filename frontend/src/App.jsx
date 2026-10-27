import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Activities from './pages/Activities.jsx'
import SubmitCertificate from './pages/SubmitCertificate.jsx'
import MySubmissions from './pages/MySubmissions.jsx'
import Coordinator from './pages/Coordinator.jsx'
import NotFound from './pages/NotFound.jsx'
import InstitutionalHeader from './components/layout/InstitutionalHeader.jsx'

function App() {
  return (
    <>
      <InstitutionalHeader />
      <div className="container py-4">
        <h1 className="text-primary">Atividades Complementares</h1>
        <Routes>
          <Route path="/" element={<Navigate to="/atividades-complementares/dashboard" replace />} />
          <Route path="/atividades-complementares/dashboard" element={<Dashboard />} />
          <Route path="/atividades-complementares/atividades" element={<Activities />} />
          <Route path="/atividades-complementares/certificados/enviar" element={<SubmitCertificate />} />
          <Route path="/atividades-complementares/submissoes" element={<MySubmissions />} />
          <Route path="/atividades-complementares/coordenador" element={<Coordinator />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </>
  )
}

export default App
