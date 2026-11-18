import { useState } from 'react'
import { Link } from 'react-router-dom'

// Passo a passo de cada perfil. "rota" = tela do sistema que o passo explica
// (o botão "Abrir" só aparece para quem está logado com aquele perfil).
const passos = {
  ALUNO: [
    {
      icone: 'bi-box-arrow-in-right',
      titulo: 'Entre no portal',
      onde: 'Tela de login',
      texto: 'Use a sua matrícula da Unifor e a sua senha. Na primeira vez, clique em "Criar conta".',
      itens: [
        'No cadastro, informe nome, matrícula, e-mail e curso.',
        'A senha precisa ter pelo menos 8 caracteres, com letras e números.',
        'Depois de 5 senhas erradas, o login fica bloqueado por alguns minutos.',
      ],
    },
    {
      icone: 'bi-speedometer2',
      titulo: 'Acompanhe o seu progresso',
      onde: 'Dashboard',
      rota: '/atividades-complementares/dashboard',
      texto: 'É a primeira tela depois do login. Mostra quantas horas o seu curso exige, quantas você já concluiu e quantas faltam.',
      itens: [
        'As barras mostram o progresso geral e o de cada categoria (Ensino, Pesquisa e Extensão).',
        'Só contam as horas de certificados aprovados pela coordenação.',
        'A meta de cada categoria é uma referência; para concluir, vale o total de horas do curso.',
      ],
    },
    {
      icone: 'bi-grid',
      titulo: 'Encontre atividades',
      onde: 'Atividades Disponíveis',
      rota: '/atividades-complementares/atividades',
      texto: 'Vitrine com as atividades cadastradas pela coordenação.',
      itens: [
        'Cada card mostra categoria, data, horário, local, carga horária e modalidade.',
        'Use o filtro de categoria para ver só o que interessa.',
      ],
    },
    {
      icone: 'bi-upload',
      titulo: 'Envie um certificado',
      onde: 'Enviar Certificado',
      rota: '/atividades-complementares/certificados/enviar',
      texto: 'Depois de participar de uma atividade, envie o certificado para a coordenação analisar.',
      itens: [
        'Obrigatórios: título, categoria, carga horária e o arquivo do certificado.',
        'O arquivo deve ser PDF, JPG ou PNG, com até 10 MB.',
        'Se a atividade estiver na vitrine, escolha-a em "Atividade cadastrada".',
        'As datas de início e fim não podem estar no futuro.',
      ],
    },
    {
      icone: 'bi-list-check',
      titulo: 'Acompanhe as suas submissões',
      onde: 'Minhas Submissões',
      rota: '/atividades-complementares/submissoes',
      texto: 'Lista todos os certificados que você enviou e a situação de cada um.',
      itens: [
        'Filtre por situação: Pendente, Aprovada ou Rejeitada.',
        'Se um certificado for rejeitado, o motivo aparece na tabela.',
        'Quando é aprovado, as horas entram no seu progresso.',
      ],
    },
  ],
  COORDENADOR: [
    {
      icone: 'bi-box-arrow-in-right',
      titulo: 'Entre no portal',
      onde: 'Tela de login',
      texto: 'Use a matrícula e a senha da sua conta de coordenador. Depois do login, você vai direto para o Painel do Coordenador.',
      itens: [
        'Contas de coordenador são criadas pela equipe responsável pelo sistema; o "Criar conta" é só para alunos.',
        'Você vê apenas os alunos do curso ao qual a sua conta está ligada.',
      ],
    },
    {
      icone: 'bi-clipboard-check',
      titulo: 'Analise os certificados',
      onde: 'Painel do Coordenador',
      rota: '/atividades-complementares/coordenador',
      texto: 'Mostra os certificados enviados pelos alunos do seu curso.',
      itens: [
        'Filtre por categoria e por situação.',
        'Clique em "Ver certificado" para abrir o arquivo numa nova aba.',
        'Aprovar: confirme e as horas entram no progresso do aluno.',
        'Rejeitar: escreva o motivo (pelo menos 5 caracteres); o aluno verá esse texto.',
        'Só certificados pendentes podem ser aprovados ou rejeitados.',
        'O aviso "Possível duplicidade" indica um envio parecido com outro; confira antes de decidir.',
      ],
    },
    {
      icone: 'bi-calendar-plus',
      titulo: 'Cadastre atividades',
      onde: 'Gerenciar Atividades',
      rota: '/atividades-complementares/coordenador/atividades',
      texto: 'As atividades cadastradas aqui aparecem na vitrine para os alunos.',
      itens: [
        'Clique em "Nova atividade" e preencha título, descrição, categoria, tipo, modalidade, data, horário, local e carga horária.',
        'Use "Editar" para corrigir os dados de uma atividade.',
        '"Remover" cancela a atividade, que deixa de aparecer na vitrine.',
        'Você só vê e altera as atividades que você mesmo cadastrou.',
      ],
    },
    {
      icone: 'bi-grid',
      titulo: 'Confira a vitrine',
      onde: 'Atividades Disponíveis',
      rota: '/atividades-complementares/atividades',
      texto: 'Mostra as atividades do jeito que os alunos veem, incluindo as de outros coordenadores.',
      itens: ['Use o filtro de categoria para conferir o que está disponível em cada uma.'],
    },
  ],
}

// Situações de um certificado (mesmas cores das tabelas do sistema)
const situacoes = [
  { nome: 'Pendente', cor: 'bg-warning text-dark', texto: 'Enviado e aguardando a análise da coordenação.' },
  { nome: 'Aprovada', cor: 'bg-success', texto: 'Aceito pela coordenação. As horas já contam no progresso.' },
  { nome: 'Rejeitada', cor: 'bg-danger', texto: 'Recusado. O motivo aparece em Minhas Submissões.' },
]

const duvidas = {
  ALUNO: [
    {
      pergunta: 'Enviei um certificado, mas as minhas horas não mudaram. Por quê?',
      resposta: 'As horas só entram no progresso depois que a coordenação aprova o certificado. Enquanto isso, ele fica como Pendente em Minhas Submissões.',
    },
    {
      pergunta: 'Meu certificado foi rejeitado. O que eu faço?',
      resposta: 'Leia o motivo em Minhas Submissões, corrija o problema e envie um novo certificado. Cada atividade cadastrada aceita só um envio por aluno: se o envio rejeitado estava ligado a uma atividade da vitrine, deixe "Atividade cadastrada" como "Nenhuma" no novo envio.',
    },
    {
      pergunta: 'Posso enviar o mesmo certificado duas vezes?',
      resposta: 'Não. O portal recusa um arquivo que você já enviou (a não ser que o envio anterior tenha sido rejeitado) e um segundo envio para a mesma atividade cadastrada.',
    },
    {
      pergunta: 'Esqueci a minha senha.',
      resposta: 'O portal ainda não tem recuperação de senha. Fale com a coordenação do seu curso.',
    },
    {
      pergunta: 'Apareceu o aviso "Não foi possível conectar à API". E agora?',
      resposta: 'O servidor do portal está fora do ar. As telas mostram dados de exemplo e nada é salvo de verdade. Tente de novo mais tarde.',
    },
  ],
  COORDENADOR: [
    {
      pergunta: 'Por que não vejo os certificados de alguns alunos?',
      resposta: 'O painel mostra apenas os alunos do curso ligado à sua conta. Alunos de outros cursos são analisados pela coordenação deles.',
    },
    {
      pergunta: 'Aprovei ou rejeitei por engano. Dá para desfazer?',
      resposta: 'Não pela tela: só certificados pendentes podem ser avaliados. Por isso o sistema pede confirmação antes de aprovar ou rejeitar.',
    },
    {
      pergunta: 'Não consigo editar uma atividade da vitrine.',
      resposta: 'Cada coordenador só altera as atividades que ele mesmo cadastrou. As suas aparecem em Gerenciar Atividades.',
    },
    {
      pergunta: 'Apareceu o aviso "Não foi possível conectar à API". E agora?',
      resposta: 'O servidor do portal está fora do ar. As telas mostram dados de exemplo e as alterações não são salvas. Tente de novo mais tarde.',
    },
  ],
}

const nomesPerfil = { ALUNO: 'Sou aluno', COORDENADOR: 'Sou coordenador' }

// usuario = quem está logado (ou null, se a página foi aberta pela tela de login)
function Tutorial({ usuario }) {
  // Começa no perfil de quem está logado; sem login, começa em "aluno"
  const [perfil, setPerfil] = useState(usuario?.perfil === 'COORDENADOR' ? 'COORDENADOR' : 'ALUNO')
  const [duvidaAberta, setDuvidaAberta] = useState(null) // índice da pergunta aberta

  function trocarPerfil(novo) {
    setPerfil(novo)
    setDuvidaAberta(null)
  }

  // Botão "Abrir" só para quem está logado com o perfil do passo
  const podeAbrir = usuario?.perfil === perfil

  return (
    <div className="tutorial">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h2 className="mb-1">Como usar o portal</h2>
          <p className="text-muted mb-0">Guia rápido das telas de Atividades Complementares.</p>
        </div>
        {!usuario && (
          <Link to="/login" className="btn btn-outline-primary">
            <i className="bi bi-arrow-left"></i> Voltar ao login
          </Link>
        )}
      </div>

      {/* Escolha do perfil: cada um tem o seu passo a passo */}
      <div className="btn-group mb-4" role="group" aria-label="Escolha o seu perfil">
        {Object.entries(nomesPerfil).map(([valor, nome]) => (
          <button
            key={valor}
            type="button"
            className={`btn ${perfil === valor ? 'btn-primary' : 'btn-outline-primary'}`}
            aria-pressed={perfil === valor}
            onClick={() => trocarPerfil(valor)}
          >
            {nome}
          </button>
        ))}
      </div>

      <div className="card p-3 mb-4 tutorial-menu-dica">
        <p className="mb-0">
          <i className="bi bi-info-circle text-primary"></i> {usuario ? 'Todas' : 'Depois de entrar, todas'} as telas ficam no menu{' '}
          <strong>Atividades Complementares</strong>, no topo da página. Este tutorial também está lá, em{' '}
          <strong>Como usar o portal</strong>.
        </p>
      </div>

      {/* Passo a passo */}
      <h3 className="h5 mb-3">Passo a passo</h3>
      <ol className="list-unstyled tutorial-passos mb-5">
        {passos[perfil].map((passo, i) => (
          <li className="card p-4 mb-3" key={passo.titulo}>
            <div className="d-flex gap-3">
              <span className="tutorial-numero" aria-hidden="true">{i + 1}</span>
              <div className="flex-grow-1">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
                  <div>
                    <h4 className="h6 mb-1">
                      <i className={`bi ${passo.icone} text-primary me-1`}></i> {passo.titulo}
                    </h4>
                    <p className="small text-muted mb-2">Onde: {passo.onde}</p>
                  </div>
                  {passo.rota && podeAbrir && (
                    <Link to={passo.rota} className="btn btn-sm btn-outline-primary">
                      Abrir <i className="bi bi-arrow-right"></i>
                    </Link>
                  )}
                </div>
                <p className="mb-2">{passo.texto}</p>
                <ul className="mb-0">
                  {passo.itens.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Situações de um certificado */}
      <h3 className="h5 mb-3">Situação dos certificados</h3>
      <div className="row g-3 mb-5">
        {situacoes.map((s) => (
          <div className="col-md-4" key={s.nome}>
            <div className="card p-3 h-100">
              <span className={`badge ${s.cor} align-self-start mb-2`}>{s.nome}</span>
              <p className="mb-0 small">{s.texto}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Dúvidas frequentes: abre uma pergunta por vez */}
      <h3 className="h5 mb-3">Dúvidas frequentes</h3>
      <div className="accordion mb-4">
        {duvidas[perfil].map((d, i) => {
          const aberta = duvidaAberta === i
          return (
            <div className="accordion-item" key={d.pergunta}>
              <h4 className="accordion-header">
                <button
                  type="button"
                  className={`accordion-button ${aberta ? '' : 'collapsed'}`}
                  aria-expanded={aberta}
                  onClick={() => setDuvidaAberta(aberta ? null : i)}
                >
                  {d.pergunta}
                </button>
              </h4>
              {aberta && <div className="accordion-body">{d.resposta}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Tutorial
