// Regras de negócio do catálogo de atividades (CRUD + filtros).
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const v = require('../utils/validacao');
const { paraNumero } = require('../utils/numeros');
const { PERFIS } = require('../config/perfis');

const MODALIDADES = ['PRESENCIAL', 'ONLINE', 'HIBRIDA'];
const SITUACOES = ['FUTURAS', 'PASSADAS', 'TODAS'];
const POR_PAGINA_PADRAO = 20;
const POR_PAGINA_MAX = 100;

// O que buscar junto com cada atividade.
const INCLUIR = {
  categoria: { select: { id: true, nome: true } },
  tipo: { select: { id: true, nome: true } },
  organizador: { select: { id: true, nome: true } },
  cursos: { select: { curso: { select: { id: true, nome: true } } } },
};

// ---------------------------------------------------------------------
// Formato de resposta
// ---------------------------------------------------------------------

/** FUTURA, EM_ANDAMENTO, ENCERRADA ou CANCELADA (calculado na hora). */
function situacaoDa(atividade, agora) {
  if (atividade.status === 'CANCELADA') return 'CANCELADA';
  const fim = atividade.dataFim || atividade.dataInicio;
  if (agora < atividade.dataInicio) return 'FUTURA';
  if (agora <= fim) return 'EM_ANDAMENTO';
  return 'ENCERRADA';
}

function paraJson(a, { cursoDoUsuarioId = null, agora = new Date() } = {}) {
  const situacao = situacaoDa(a, agora);
  const cursosRecomendados = a.cursos.map((ac) => ac.curso).sort((x, y) => x.id - y.id);
  // Sem prazo cadastrado: considera aberta até a atividade começar.
  const inscricoesAbertas = a.status === 'ATIVA'
    && (a.prazoInscricao ? agora <= a.prazoInscricao : situacao === 'FUTURA');

  return {
    id: a.id,
    titulo: a.titulo,
    descricao: a.descricao,
    categoria: a.categoria,
    tipo: a.tipo,
    modalidade: a.modalidade,
    dataInicio: a.dataInicio,
    dataFim: a.dataFim,
    local: a.local,
    link: a.link,
    imagemUrl: a.imagemUrl,
    cargaHoraria: paraNumero(a.cargaHoraria),
    prazoInscricao: a.prazoInscricao,
    vagas: a.vagas,
    inscricaoInfo: a.inscricaoInfo,
    contato: a.contato,
    organizador: a.organizador,
    status: a.status,
    motivoCancelamento: a.motivoCancelamento,
    situacao,
    inscricoesAbertas,
    cursosRecomendados,
    // null quando não sabemos o curso de quem pergunta
    recomendadaParaVoce: cursoDoUsuarioId ? cursosRecomendados.some((c) => c.id === cursoDoUsuarioId) : null,
    criadoEm: a.criadoEm,
    atualizadoEm: a.atualizadoEm,
  };
}

// ---------------------------------------------------------------------
// Listagem com filtros
// ---------------------------------------------------------------------

/**
 * Filtros (query string), todos opcionais:
 *   busca, categoriaId, tipoId, modalidade, de, ate (AAAA-MM-DD),
 *   cargaMin, cargaMax, cursoId, compativeis, situacao (FUTURAS|PASSADAS|TODAS),
 *   incluirCanceladas, minhas, pagina, porPagina
 */
async function listar(query, usuario) {
  const f = v.validar({
    busca: v.texto(query.busca, { obrigatorio: false, max: 100, nomeCampo: 'Busca' }),
    categoriaId: v.idPositivo(query.categoriaId, 'Categoria', { obrigatorio: false }),
    tipoId: v.idPositivo(query.tipoId, 'Tipo', { obrigatorio: false }),
    modalidade: v.opcao(query.modalidade, MODALIDADES, 'Modalidade', { obrigatorio: false }),
    situacao: v.opcao(query.situacao ?? 'FUTURAS', SITUACOES, 'Situação'),
    de: v.dataDia(query.de, 'Data inicial'),
    ate: v.dataDia(query.ate, 'Data final', { fimDoDia: true }),
    cargaMin: v.horas(query.cargaMin, 'Carga mínima', { obrigatorio: false }),
    cargaMax: v.horas(query.cargaMax, 'Carga máxima', { obrigatorio: false }),
    cursoId: v.idPositivo(query.cursoId, 'Curso', { obrigatorio: false }),
    compativeis: v.booleano(query.compativeis, 'compativeis'),
    incluirCanceladas: v.booleano(query.incluirCanceladas, 'incluirCanceladas'),
    minhas: v.booleano(query.minhas, 'minhas'),
    pagina: v.inteiro(query.pagina, 'Página', { obrigatorio: false, min: 1, max: 100000 }),
    porPagina: v.inteiro(query.porPagina, 'Itens por página', { obrigatorio: false, min: 1, max: POR_PAGINA_MAX }),
  });

  if (f.de && f.ate && f.de > f.ate) throw v.erroDeCampo('ate', 'A data final não pode ser anterior à inicial.');
  if (f.cargaMin && f.cargaMax && f.cargaMin > f.cargaMax) {
    throw v.erroDeCampo('cargaMax', 'A carga máxima não pode ser menor que a mínima.');
  }

  // "Compatíveis com o meu curso": usa o curso de quem está identificado.
  let cursoFiltro = f.cursoId;
  if (!cursoFiltro && f.compativeis) {
    if (!usuario?.curso) {
      throw new AppError(400, 'CURSO_NECESSARIO', 'Para ver atividades compatíveis, identifique-se com um usuário vinculado a um curso ou informe cursoId.');
    }
    cursoFiltro = usuario.curso.id;
  }
  if (f.minhas && !usuario) {
    throw new AppError(401, 'IDENTIFICACAO_NECESSARIA', 'Identifique-se para ver as suas atividades.');
  }

  const agora = new Date();
  const condicoes = [];
  if (!f.incluirCanceladas) condicoes.push({ status: 'ATIVA' });
  if (f.situacao === 'FUTURAS') {
    // Ainda vai acontecer ou está acontecendo agora.
    condicoes.push({ OR: [{ dataFim: { gte: agora } }, { dataFim: null, dataInicio: { gte: agora } }] });
  } else if (f.situacao === 'PASSADAS') {
    condicoes.push({ OR: [{ dataFim: { lt: agora } }, { dataFim: null, dataInicio: { lt: agora } }] });
  }
  if (f.busca) {
    // No MySQL, `contains` já ignora maiúsculas/minúsculas e acentos (collation utf8mb4_unicode_ci).
    condicoes.push({
      OR: [
        { titulo: { contains: f.busca } },
        { descricao: { contains: f.busca } },
        { categoria: { nome: { contains: f.busca } } },
        { tipo: { nome: { contains: f.busca } } },
      ],
    });
  }
  if (f.categoriaId) condicoes.push({ categoriaId: f.categoriaId });
  if (f.tipoId) condicoes.push({ tipoId: f.tipoId });
  if (f.modalidade) condicoes.push({ modalidade: f.modalidade });
  if (f.de) condicoes.push({ dataInicio: { gte: f.de } });
  if (f.ate) condicoes.push({ dataInicio: { lte: f.ate } });
  if (f.cargaMin) condicoes.push({ cargaHoraria: { gte: f.cargaMin } });
  if (f.cargaMax) condicoes.push({ cargaHoraria: { lte: f.cargaMax } });
  if (cursoFiltro) condicoes.push({ cursos: { some: { cursoId: cursoFiltro } } });
  if (f.minhas) condicoes.push({ organizadorId: usuario.id });

  const where = { AND: condicoes };
  const ordem = f.situacao === 'PASSADAS' ? 'desc' : 'asc';
  const pagina = f.pagina || 1;
  const porPagina = f.porPagina || POR_PAGINA_PADRAO;

  // As duas consultas na mesma transação: o total bate com a página.
  const [total, linhas] = await prisma.$transaction([
    prisma.atividade.count({ where }),
    prisma.atividade.findMany({
      where,
      include: INCLUIR,
      orderBy: [{ dataInicio: ordem }, { id: ordem }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
  ]);

  const cursoDoUsuarioId = usuario?.curso?.id ?? null;
  return {
    atividades: linhas.map((a) => paraJson(a, { cursoDoUsuarioId, agora })),
    paginacao: { pagina, porPagina, total, totalPaginas: Math.ceil(total / porPagina) },
  };
}

// ---------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------

function idDaRota(idBruto) {
  return v.validar({ id: v.idPositivo(idBruto, 'Id da atividade') }).id;
}

async function buscarOuFalhar(id) {
  const atividade = await prisma.atividade.findUnique({ where: { id }, include: INCLUIR });
  if (!atividade) throw new AppError(404, 'ATIVIDADE_NAO_ENCONTRADA', 'Atividade não encontrada.');
  return atividade;
}

async function detalhar(idBruto, usuario) {
  const atividade = await buscarOuFalhar(idDaRota(idBruto));
  return paraJson(atividade, { cursoDoUsuarioId: usuario?.curso?.id ?? null });
}

// ---------------------------------------------------------------------
// Validação de criação/edição
// ---------------------------------------------------------------------

const tem = (obj, campo) => Object.prototype.hasOwnProperty.call(obj, campo);

/**
 * Valida o corpo. Em edição (`atual` preenchido) só valida os campos enviados;
 * as regras que cruzam campos usam o valor novo ou, se não veio, o atual.
 * Campos não listados aqui (organizadorId, status, id...) são ignorados.
 */
function validarCorpo(corpo, atual = null) {
  v.exigirObjeto(corpo);
  const parcial = atual !== null;
  const usar = (campo) => !parcial || tem(corpo, campo);
  const opcional = { obrigatorio: false };

  const dados = v.validar({
    titulo: usar('titulo') ? v.texto(corpo.titulo, { min: 3, max: 200, nomeCampo: 'Título' }) : undefined,
    descricao: usar('descricao') ? v.textoLongo(corpo.descricao, { min: 10, max: 5000, nomeCampo: 'Descrição' }) : undefined,
    categoriaId: usar('categoriaId') ? v.idPositivo(corpo.categoriaId, 'Categoria') : undefined,
    tipoId: usar('tipoId') ? v.idPositivo(corpo.tipoId, 'Tipo de atividade') : undefined,
    modalidade: usar('modalidade') ? v.opcao(corpo.modalidade, MODALIDADES, 'Modalidade') : undefined,
    dataInicio: usar('dataInicio') ? v.dataHora(corpo.dataInicio, 'Data de início') : undefined,
    dataFim: usar('dataFim') ? v.dataHora(corpo.dataFim, 'Data de término', opcional) : undefined,
    local: usar('local') ? v.texto(corpo.local, { ...opcional, max: 255, nomeCampo: 'Local' }) : undefined,
    link: usar('link') ? v.url(corpo.link, 'Link') : undefined,
    imagemUrl: usar('imagemUrl') ? v.url(corpo.imagemUrl, 'Imagem') : undefined,
    cargaHoraria: usar('cargaHoraria') ? v.horas(corpo.cargaHoraria, 'Carga horária') : undefined,
    prazoInscricao: usar('prazoInscricao') ? v.dataHora(corpo.prazoInscricao, 'Prazo de inscrição', opcional) : undefined,
    vagas: usar('vagas') ? v.inteiro(corpo.vagas, 'Vagas', { ...opcional, min: 1, max: 100000 }) : undefined,
    inscricaoInfo: usar('inscricaoInfo') ? v.textoLongo(corpo.inscricaoInfo, { ...opcional, max: 1000, nomeCampo: 'Como se inscrever' }) : undefined,
    contato: usar('contato') ? v.texto(corpo.contato, { ...opcional, max: 255, nomeCampo: 'Contato' }) : undefined,
    cursoIds: usar('cursoIds') ? v.listaIds(corpo.cursoIds, 'Cursos recomendados') : undefined,
  });

  if (parcial && Object.keys(dados).length === 0) {
    throw new AppError(400, 'NADA_PARA_ATUALIZAR', 'Envie pelo menos um campo para atualizar.');
  }

  // Regras que envolvem mais de um campo (valor novo ou, se não veio, o atual).
  const valor = (campo) => (tem(dados, campo) ? dados[campo] : atual?.[campo] ?? null);
  const inicio = valor('dataInicio');
  const fim = valor('dataFim');
  const prazo = valor('prazoInscricao');
  const modalidade = valor('modalidade');

  if (fim && fim < inicio) throw v.erroDeCampo('dataFim', 'A data de término não pode ser anterior ao início.');
  if (prazo && prazo > (fim || inicio)) {
    throw v.erroDeCampo('prazoInscricao', 'O prazo de inscrição não pode terminar depois da atividade.');
  }
  if ((modalidade === 'PRESENCIAL' || modalidade === 'HIBRIDA') && !valor('local')) {
    throw v.erroDeCampo('local', 'Informe o local para atividades presenciais ou híbridas.');
  }
  if (modalidade === 'ONLINE' && !valor('link') && !valor('local')) {
    throw v.erroDeCampo('link', 'Informe o link ou o local (ex.: Microsoft Teams) da atividade online.');
  }

  return dados;
}

/** Categoria, tipo e cursos precisam existir e estar ativos. */
async function verificarReferencias({ categoriaId, tipoId, cursoIds }) {
  if (categoriaId !== undefined) {
    const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } });
    if (!categoria || !categoria.ativa) throw v.erroDeCampo('categoriaId', 'Categoria não encontrada ou inativa.');
  }
  if (tipoId !== undefined) {
    const tipo = await prisma.tipoAtividade.findUnique({ where: { id: tipoId } });
    if (!tipo || !tipo.ativo) throw v.erroDeCampo('tipoId', 'Tipo de atividade não encontrado ou inativo.');
  }
  if (cursoIds && cursoIds.length > 0) {
    const encontrados = await prisma.curso.count({ where: { id: { in: cursoIds }, ativo: true } });
    if (encontrados !== cursoIds.length) {
      throw v.erroDeCampo('cursoIds', 'Um ou mais cursos não existem ou estão inativos.');
    }
  }
}

/** Organizador só mexe nas próprias atividades; administrador em todas. */
function verificarPermissao(atividade, usuario) {
  if (usuario.perfil === PERFIS.ADMINISTRADOR) return;
  if (usuario.perfil === PERFIS.ORGANIZADOR && atividade.organizadorId === usuario.id) return;
  throw new AppError(403, 'ACESSO_NEGADO', 'Você só pode alterar atividades que você organiza.');
}

// ---------------------------------------------------------------------
// Criar, editar, cancelar
// ---------------------------------------------------------------------

async function criar(corpo, usuario) {
  const dados = validarCorpo(corpo);
  await verificarReferencias(dados);
  const { cursoIds, ...campos } = dados;

  const atividade = await prisma.atividade.create({
    data: {
      ...campos,
      organizadorId: usuario.id, // sempre quem está criando; não vem do corpo
      cursos: { create: cursoIds.map((cursoId) => ({ cursoId })) },
    },
    include: INCLUIR,
  });
  return paraJson(atividade, { cursoDoUsuarioId: usuario.curso?.id ?? null });
}

async function atualizar(idBruto, corpo, usuario) {
  const atual = await buscarOuFalhar(idDaRota(idBruto));
  verificarPermissao(atual, usuario);
  if (atual.status === 'CANCELADA') {
    throw new AppError(409, 'ATIVIDADE_CANCELADA', 'Atividades canceladas não podem ser editadas.');
  }

  const dados = validarCorpo(corpo, atual);
  await verificarReferencias(dados);
  const { cursoIds, ...campos } = dados;

  const data = { ...campos };
  if (cursoIds !== undefined) {
    // Substitui a lista inteira de cursos recomendados.
    data.cursos = { deleteMany: {}, create: cursoIds.map((cursoId) => ({ cursoId })) };
  }

  const atividade = await prisma.atividade.update({ where: { id: atual.id }, data, include: INCLUIR });
  return paraJson(atividade, { cursoDoUsuarioId: usuario.curso?.id ?? null });
}

/**
 * "Excluir" = CANCELAR. A atividade continua no banco (e no histórico das
 * submissões ligadas a ela), mas sai do catálogo padrão.
 */
async function cancelar(idBruto, corpo, usuario) {
  const id = idDaRota(idBruto);
  const { motivo } = v.validar({
    motivo: v.texto(corpo?.motivo, { obrigatorio: false, max: 500, nomeCampo: 'Motivo' }),
  });
  const atual = await buscarOuFalhar(id);
  verificarPermissao(atual, usuario);

  // Só cancela se ainda estiver ATIVA (evita corrida entre dois cancelamentos).
  const { count } = await prisma.atividade.updateMany({
    where: { id, status: 'ATIVA' },
    data: { status: 'CANCELADA', motivoCancelamento: motivo },
  });
  if (count === 0) throw new AppError(409, 'ATIVIDADE_JA_CANCELADA', 'Esta atividade já está cancelada.');

  return paraJson(await buscarOuFalhar(id), { cursoDoUsuarioId: usuario.curso?.id ?? null });
}

module.exports = { listar, detalhar, criar, atualizar, cancelar, situacaoDa };
