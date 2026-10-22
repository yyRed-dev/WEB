// Perfis de usuário (iguais ao enum Perfil do prisma/schema.prisma).
//   COORDENADOR = quem usa o "Painel do Coordenador" e avalia submissões
//                 dos alunos do curso que coordena (antes chamado AVALIADOR).
const PERFIS = Object.freeze({
  ALUNO: 'ALUNO',
  ORGANIZADOR: 'ORGANIZADOR',
  COORDENADOR: 'COORDENADOR',
  ADMINISTRADOR: 'ADMINISTRADOR',
});

const LISTA_PERFIS = Object.values(PERFIS);

/** Quem pode criar atividades no catálogo. */
const PODEM_GERENCIAR_ATIVIDADES = [PERFIS.ORGANIZADOR, PERFIS.ADMINISTRADOR];

module.exports = { PERFIS, LISTA_PERFIS, PODEM_GERENCIAR_ATIVIDADES };
