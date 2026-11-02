// Perfis de usuário (iguais ao enum Perfil do prisma/schema.prisma).
// O sistema tem APENAS dois perfis:
//   ALUNO        -> envia certificados, vê as próprias submissões e o progresso
//   COORDENADOR  -> avalia as submissões dos alunos do curso que coordena
//                   e cadastra, edita e cancela atividades do catálogo
const PERFIS = Object.freeze({
  ALUNO: 'ALUNO',
  COORDENADOR: 'COORDENADOR',
});

const LISTA_PERFIS = Object.values(PERFIS);

/** Quem pode criar, editar e cancelar atividades do catálogo. */
const PODEM_GERENCIAR_ATIVIDADES = [PERFIS.COORDENADOR];

/**
 * Um coordenador pode editar/cancelar atividade cadastrada por OUTRO coordenador?
 * false (decisão do grupo): não. Cada coordenador só altera as atividades que
 * ele mesmo cadastrou (campo `organizador`).
 */
const COORDENADOR_EDITA_ATIVIDADES_DE_OUTROS = false;

module.exports = { PERFIS, LISTA_PERFIS, PODEM_GERENCIAR_ATIVIDADES, COORDENADOR_EDITA_ATIVIDADES_DE_OUTROS };
