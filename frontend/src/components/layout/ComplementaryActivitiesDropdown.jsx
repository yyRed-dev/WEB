import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'

// Cada item diz quais perfis podem vê-lo (conforme a tabela de rotas do guia)
const todosItens = [
  { to: '/atividades-complementares/dashboard', texto: 'Dashboard', perfis: ['ALUNO'] },
  { to: '/atividades-complementares/atividades', texto: 'Atividades Disponíveis', perfis: ['ALUNO', 'COORDENADOR'] },
  { to: '/atividades-complementares/certificados/enviar', texto: 'Enviar Certificado', perfis: ['ALUNO'] },
  { to: '/atividades-complementares/submissoes', texto: 'Minhas Submissões', perfis: ['ALUNO'] },
  { to: '/atividades-complementares/coordenador', texto: 'Painel do Coordenador', perfis: ['COORDENADOR'] },
  { to: '/atividades-complementares/coordenador/atividades', texto: 'Gerenciar Atividades', perfis: ['COORDENADOR'] },
]

// Menu "Atividades Complementares": o conteúdo muda conforme o perfil
function ComplementaryActivitiesDropdown({ perfil }) {
  const [aberto, setAberto] = useState(false)
  const caixaRef = useRef(null) // área do menu, para saber se o clique foi fora
  const botaoRef = useRef(null)

  const itens = todosItens.filter((item) => item.perfis.includes(perfil))

  // Enquanto aberto, fecha ao clicar fora ou ao apertar Esc
  useEffect(() => {
    if (!aberto) return

    function cliqueFora(e) {
      if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberto(false)
    }
    function teclaEsc(e) {
      if (e.key === 'Escape') {
        setAberto(false)
        botaoRef.current?.focus() // devolve o foco ao botão
      }
    }

    document.addEventListener('mousedown', cliqueFora)
    document.addEventListener('keydown', teclaEsc)
    // Remove os ouvintes quando o menu fecha
    return () => {
      document.removeEventListener('mousedown', cliqueFora)
      document.removeEventListener('keydown', teclaEsc)
    }
  }, [aberto])

  return (
    <div className="dropdown" ref={caixaRef}>
      <button
        ref={botaoRef}
        type="button"
        className="btn nav-link text-white fw-semibold"
        aria-expanded={aberto}
        onClick={() => setAberto(!aberto)}
      >
        Atividades Complementares <i className={`bi ${aberto ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
      </button>

      <ul className={`dropdown-menu ${aberto ? 'show' : ''}`}>
        {itens.map((item) => (
          <li key={item.to}>
            {/* Fecha o menu ao escolher uma opção */}
            <NavLink className="dropdown-item" to={item.to} onClick={() => setAberto(false)}>
              {item.texto}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ComplementaryActivitiesDropdown
