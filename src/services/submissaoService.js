// Submissões (pedidos de validação de horas): envio com certificado,
// listas do aluno e do coordenador, aprovação, rejeição e download do arquivo.
//
// Regras principais:
//   * Toda submissão nova começa PENDENTE (o status do formulário é ignorado).
//   * Só conta para o progresso depois de APROVADA (ver calculoProgresso.js).
//   * O coordenador só vê e avalia submissões de alunos do curso que coordena.
//   * Só submissões PENDENTES podem ser avaliadas; cada decisão vira uma linha
//     em `avaliacoes` (histórico que nunca é editado).
//   * Duplicidade: bloqueia o que é certamente repetido (mesma atividade do
//     catálogo; mesmo arquivo já enviado pelo aluno) e só SINALIZA o que é
//     suspeito (alertaDuplicidade), para o coordenador decidir.
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const v = require('../utils/validacao');
const { paraNumero } = require('../utils/numeros');
const { PERFIS } = require('../config/perfis');
const arquivos = require('./arquivoService');
const { progressoDoAluno } = require('./progressoService');

const STATUS = ['PENDENTE', 'APROVADA', 'REJEITADA'];
const POR_PAGINA_PADRAO = 20;
const POR_PAGINA_MAX = 100;

const INCLUIR = {
  aluno: { select: { id: true, nome: true, matricula: true, cursoId: true } },
  atividade: { select: { id: true, titulo: true } },
  categoria: { select: { id: true, nome: true } },
  avaliador: { select: { id: true, nome: true } },
  comprovantes: { orderBy: { enviadoEm: 'desc' }, take: 1 },
};

// ---------------------------------------------------------------------
// Formato de resposta
// ---------------------------------------------------------------------

const dia = (data) => (data ? data.toISOString().slice(0, 10) : null);

/**
 * @param {object} s     submissão com INCLUIR
 * @param {object} req   requisição (para montar o link do certificado)
 * @param {boolean} paraCoordenador  inclui dados do aluno e o alerta de duplicidade
 */
function paraJson(s, req, { paraCoordenador = false } = {}) {
  const comprovante = s.comprovantes[0] || null;
  const json = {
    id: s.id,
    titulo: s.titulo,
    atividade: s.atividade, // atividade do catálogo ou null (atividade externa)
    categoria: s.categoria,
    instituicao: s.instituicao,
    horasSolicitadas: paraNumero(s.horasSolicitadas),
    horasAprovadas: paraNumero(s.horasAprovadas),
    dataInicio: dia(s.dataInicio),
    dataFim: dia(s.dataFim),
    observacoes: s.descricao,
    status: s.status,
    motivoRejeicao: s.status === 'REJEITADA' ? s.justificativa : null,
    justificativa: s.justificativa,
    permiteCorrecao: s.permiteCorrecao,
    enviadaEm: s.enviadaEm,
    avaliadaEm: s.avaliadaEm,
    avaliador: s.avaliador,
    certificado: comprovante && {
      id: comprovante.id,
      nomeOriginal: comprovante.nomeOriginal,
      tipo: comprovante.tipoMime,
      tamanhoBytes: comprovante.tamanhoBytes,
      url: arquivos.urlAssinada(req, comprovante.id),
    },
  };
  if (paraCoordenador) {
    json.aluno = { id: s.aluno.id, nome: s.aluno.nome, matricula: s.aluno.matricula };
    json.alertaDuplicidade = s.alertaDuplicidade;
  }
  return json;
}

// ---------------------------------------------------------------------
// Envio (POST /submissoes, multipart/form-data)
// ---------------------------------------------------------------------

function exigirCurso(usuario) {
  if (!usuario.curso) {
    const quem = usuario.perfil === PERFIS.ALUNO ? 'Sua conta' : 'O coordenador';
    throw new AppError(409, 'SEM_CURSO', `${quem} não está vinculado(a) a um curso.`);
  }
}

const normalizar = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

async function criar(corpo, arquivo, aluno, req) {
  exigirCurso(aluno);
  const campos = corpo && typeof corpo === 'object' ? corpo : {};

  // As chaves dos erros usam os MESMOS nomes dos campos do formulário.
  const form = v.validar({
    titulo: v.texto(campos.titulo, { min: 3, max: 200, nomeCampo: 'Título' }),
    categoriaId: v.idPositivo(campos.categoriaId, 'Categoria'),
    cargaHoraria: v.horas(campos.cargaHoraria, 'Carga horária'),
    atividadeId: v.idPositivo(campos.atividadeId, 'Atividade', { obrigatorio: false }),
    instituicao: v.texto(campos.instituicao, { obrigatorio: false, max: 200, nomeCampo: 'Instituição' }),
    dataInicio: v.dataDia(campos.dataInicio, 'Data de início'),
    dataFim: v.dataDia(campos.dataFim, 'Data de fim'),
    observacoes: v.textoLongo(campos.observacoes, { obrigatorio: false, max: 500, nomeCampo: 'Observações' }),
  });
  const { cargaHoraria, observacoes, ...resto } = form;
  const dados = { ...resto, horasSolicitadas: cargaHoraria, descricao: observacoes }; // nomes das colunas

  // Datas: período coerente e já acontecido
  const hoje = new Date();
  if (dados.dataFim && !dados.dataInicio) throw v.erroDeCampo('dataInicio', 'Informe também a data de início.');
  if (dados.dataFim && dados.dataFim < dados.dataInicio) throw v.erroDeCampo('dataFim', 'A data de fim não pode ser anterior ao início.');
  if (dados.dataInicio && dados.dataInicio > hoje) throw v.erroDeCampo('dataInicio', 'A data de início não pode estar no futuro.');
  if (dados.dataFim && dados.dataFim > hoje) throw v.erroDeCampo('dataFim', 'A data de fim não pode estar no futuro.');

  // Arquivo: obrigatório, PDF/PNG/JPEG de verdade
  if (!arquivo) throw v.erroDeCampo('arquivo', 'Anexe o certificado (PDF, JPG ou PNG).');
  if (arquivo.size === 0) throw v.erroDeCampo('arquivo', 'O arquivo enviado está vazio.');
  const tipo = arquivos.detectarTipo(arquivo.buffer);
  if (!tipo) throw v.erroDeCampo('arquivo', 'Formato não aceito. Envie um PDF, JPG ou PNG.');
  if (!arquivos.extensaoConfere(arquivo.originalname, tipo)) {
    throw v.erroDeCampo('arquivo', 'A extensão do arquivo não corresponde ao conteúdo. Envie um PDF, JPG ou PNG.');
  }

  // Referências
  const categoria = await prisma.categoria.findUnique({ where: { id: dados.categoriaId } });
  if (!categoria || !categoria.ativa) throw v.erroDeCampo('categoriaId', 'Categoria não encontrada ou inativa.');
  if (dados.atividadeId) {
    const atividade = await prisma.atividade.findUnique({ where: { id: dados.atividadeId } });
    if (!atividade) throw v.erroDeCampo('atividadeId', 'Atividade não encontrada.');
    const repetida = await prisma.submissao.findFirst({ where: { alunoId: aluno.id, atividadeId: dados.atividadeId } });
    if (repetida) throw new AppError(409, 'SUBMISSAO_DUPLICADA', 'Você já enviou um certificado para esta atividade.');
  }

  // Duplicidade pelo conteúdo do arquivo
  const hash = arquivos.sha256(arquivo.buffer);
  const mesmoArquivo = await prisma.comprovante.findMany({
    where: { sha256: hash },
    select: { submissao: { select: { id: true, alunoId: true, status: true } } },
  });
  const meuAtivo = mesmoArquivo.find((c) => c.submissao.alunoId === aluno.id && c.submissao.status !== 'REJEITADA');
  if (meuAtivo) {
    throw new AppError(409, 'ARQUIVO_JA_ENVIADO', `Este arquivo já foi enviado na submissão #${meuAtivo.submissao.id}.`);
  }

  // Suspeitas: não bloqueiam, só avisam o coordenador
  const alertas = [];
  const deOutro = mesmoArquivo.find((c) => c.submissao.alunoId !== aluno.id);
  if (deOutro) alertas.push(`Mesmo arquivo enviado por outro aluno (submissão #${deOutro.submissao.id}).`);
  const meuRejeitado = mesmoArquivo.find((c) => c.submissao.alunoId === aluno.id);
  if (meuRejeitado) alertas.push(`Mesmo arquivo de uma submissão rejeitada (#${meuRejeitado.submissao.id}).`);
  const parecidas = await prisma.submissao.findMany({
    where: { alunoId: aluno.id, status: { not: 'REJEITADA' }, horasSolicitadas: dados.horasSolicitadas },
    select: { id: true, titulo: true },
  });
  const mesmoTitulo = parecidas.find((p) => normalizar(p.titulo) === normalizar(dados.titulo));
  if (mesmoTitulo) alertas.push(`Título e carga horária iguais aos da submissão #${mesmoTitulo.id}.`);

  // Grava o arquivo e, depois, o registro. Se o banco falhar, apaga o arquivo.
  const nomeArmazenado = await arquivos.salvar(arquivo.buffer, tipo);
  try {
    const submissao = await prisma.submissao.create({
      data: {
        ...dados,
        alunoId: aluno.id,
        status: 'PENDENTE', // regra: todo envio novo começa pendente
        alertaDuplicidade: alertas.length ? alertas.join(' ').slice(0, 255) : null,
        comprovantes: {
          create: [{
            nomeOriginal: (arquivo.originalname || `certificado${tipo.extensoes[0]}`).slice(0, 255),
            nomeArmazenado,
            tipoMime: tipo.mime,
            tamanhoBytes: arquivo.size,
            sha256: hash,
            enviadoPorId: aluno.id,
          }],
        },
      },
      include: INCLUIR,
    });
    return paraJson(submissao, req);
  } catch (erro) {
    await arquivos.remover(nomeArmazenado);
    if (erro?.code === 'P2002') {
      throw new AppError(409, 'SUBMISSAO_DUPLICADA', 'Você já enviou um certificado para esta atividade.');
    }
    throw erro;
  }
}

// ---------------------------------------------------------------------
// Listas
// ---------------------------------------------------------------------

function filtrosDeLista(query) {
  return v.validar({
    status: v.opcao(query.status, STATUS, 'Status', { obrigatorio: false }),
    categoriaId: v.idPositivo(query.categoriaId, 'Categoria', { obrigatorio: false }),
    busca: v.texto(query.busca, { obrigatorio: false, max: 100, nomeCampo: 'Busca' }),
    pagina: v.inteiro(query.pagina, 'Página', { obrigatorio: false, min: 1, max: 100000 }),
    porPagina: v.inteiro(query.porPagina, 'Itens por página', { obrigatorio: false, min: 1, max: POR_PAGINA_MAX }),
  });
}

/** Contagem por status, para as abas "Todos / Aprovadas / Pendentes / Rejeitadas". */
async function contarPorStatus(where) {
  const grupos = await prisma.submissao.groupBy({ by: ['status'], where, _count: { _all: true }, orderBy: { status: 'asc' } });
  const n = (status) => grupos.find((g) => g.status === status)?._count._all ?? 0;
  const contagem = { pendentes: n('PENDENTE'), aprovadas: n('APROVADA'), rejeitadas: n('REJEITADA') };
  return { todas: contagem.pendentes + contagem.aprovadas + contagem.rejeitadas, ...contagem };
}

async function paginar(whereBase, filtros, extras, req, opcoesJson) {
  const condicoes = [whereBase];
  if (filtros.status) condicoes.push({ status: filtros.status });
  if (filtros.categoriaId) condicoes.push({ categoriaId: filtros.categoriaId });
  if (filtros.busca) condicoes.push({ OR: extras(filtros.busca) });
  const where = { AND: condicoes };
  const pagina = filtros.pagina || 1;
  const porPagina = filtros.porPagina || POR_PAGINA_PADRAO;

  const [total, linhas, contagem] = await Promise.all([
    prisma.submissao.count({ where }),
    prisma.submissao.findMany({
      where,
      include: INCLUIR,
      orderBy: [{ enviadaEm: 'desc' }, { id: 'desc' }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    contarPorStatus(whereBase),
  ]);
  return {
    submissoes: linhas.map((s) => paraJson(s, req, opcoesJson)),
    contagem,
    paginacao: { pagina, porPagina, total, totalPaginas: Math.ceil(total / porPagina) },
  };
}

/** GET /submissoes/minhas — só as do aluno identificado. */
async function listarDoAluno(query, aluno, req) {
  const filtros = filtrosDeLista(query);
  return paginar({ alunoId: aluno.id }, filtros, (busca) => [
    { titulo: { contains: busca } },
    { instituicao: { contains: busca } },
    { atividade: { titulo: { contains: busca } } },
  ], req, {});
}

/** GET /submissoes — painel do coordenador: alunos do curso que ele coordena. */
async function listarParaCoordenador(query, coordenador, req) {
  exigirCurso(coordenador);
  const filtros = filtrosDeLista(query);
  return paginar({ aluno: { cursoId: coordenador.curso.id } }, filtros, (busca) => [
    { titulo: { contains: busca } },
    { atividade: { titulo: { contains: busca } } },
    { aluno: { nome: { contains: busca } } },
    { aluno: { matricula: { contains: busca } } },
  ], req, { paraCoordenador: true });
}

// ---------------------------------------------------------------------
// Detalhe, aprovação e rejeição
// ---------------------------------------------------------------------

const idDaRota = (bruto) => v.validar({ id: v.idPositivo(bruto, 'Id da submissão') }).id;

/** Busca e confere quem pode ver: o aluno dono ou um coordenador do curso dele. */
async function buscarComAcesso(id, usuario) {
  const s = await prisma.submissao.findUnique({ where: { id }, include: INCLUIR });
  if (!s) throw new AppError(404, 'SUBMISSAO_NAO_ENCONTRADA', 'Submissão não encontrada.');
  const ehDono = usuario.perfil === PERFIS.ALUNO && s.alunoId === usuario.id;
  const ehCoordenadorDoCurso = usuario.perfil === PERFIS.COORDENADOR && usuario.curso && usuario.curso.id === s.aluno.cursoId;
  if (!ehDono && !ehCoordenadorDoCurso) {
    // Mesmo erro de "não existe": não revela submissões de outros.
    throw new AppError(404, 'SUBMISSAO_NAO_ENCONTRADA', 'Submissão não encontrada.');
  }
  return s;
}

async function detalhar(idBruto, usuario, req) {
  const s = await buscarComAcesso(idDaRota(idBruto), usuario);
  const historico = await prisma.avaliacao.findMany({
    where: { submissaoId: s.id },
    orderBy: [{ avaliadaEm: 'asc' }, { id: 'asc' }],
    include: { avaliador: { select: { id: true, nome: true } } },
  });
  return {
    ...paraJson(s, req, { paraCoordenador: usuario.perfil === PERFIS.COORDENADOR }),
    historico: historico.map((a) => ({
      resultado: a.resultado,
      horasAprovadas: paraNumero(a.horasAprovadas),
      justificativa: a.justificativa,
      permiteCorrecao: a.permiteCorrecao,
      avaliadaEm: a.avaliadaEm,
      avaliador: a.avaliador,
    })),
  };
}

/**
 * Grava a decisão: muda a submissão SÓ se ainda estiver PENDENTE (evita dois
 * coordenadores avaliarem ao mesmo tempo) e registra o histórico, numa transação.
 */
async function registrarDecisao(s, coordenador, decisao) {
  const agora = new Date();
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.submissao.updateMany({
      where: { id: s.id, status: 'PENDENTE' },
      data: {
        status: decisao.resultado,
        horasAprovadas: decisao.horasAprovadas,
        justificativa: decisao.justificativa,
        permiteCorrecao: decisao.permiteCorrecao,
        avaliadorId: coordenador.id,
        avaliadaEm: agora,
      },
    });
    if (count === 0) throw new AppError(409, 'SUBMISSAO_JA_AVALIADA', 'Esta submissão já foi avaliada.');
    await tx.avaliacao.create({
      data: {
        submissaoId: s.id,
        avaliadorId: coordenador.id,
        resultado: decisao.resultado,
        horasAprovadas: decisao.horasAprovadas,
        justificativa: decisao.justificativa,
        permiteCorrecao: decisao.permiteCorrecao,
        avaliadaEm: agora,
      },
    });
  });
}

async function prepararAvaliacao(idBruto, coordenador) {
  exigirCurso(coordenador);
  const s = await buscarComAcesso(idDaRota(idBruto), coordenador);
  if (s.status !== 'PENDENTE') throw new AppError(409, 'SUBMISSAO_JA_AVALIADA', 'Esta submissão já foi avaliada.');
  return s;
}

/** Resumo do progresso do aluno logo após a decisão (já com a nova situação). */
async function resumoProgresso(alunoId) {
  try {
    const p = await progressoDoAluno(alunoId);
    return { horas: p.horas, percentualConcluido: p.percentualConcluido, cargaHorariaCumprida: p.cargaHorariaCumprida };
  } catch {
    return null; // ex.: aluno sem curso
  }
}

/** PATCH /submissoes/:id/aprovar — corpo opcional: { horasAprovadas, observacao } */
async function aprovar(idBruto, corpo, coordenador, req) {
  const s = await prepararAvaliacao(idBruto, coordenador);
  const campos = corpo && typeof corpo === 'object' ? corpo : {};
  const dados = v.validar({
    horasAprovadas: v.horas(campos.horasAprovadas, 'Horas aprovadas', { obrigatorio: false }),
    observacao: v.textoLongo(campos.observacao, { obrigatorio: false, max: 1000, nomeCampo: 'Observação' }),
  });
  const solicitadas = paraNumero(s.horasSolicitadas);
  const horasAprovadas = dados.horasAprovadas ?? solicitadas; // padrão: aprova o que foi pedido
  if (horasAprovadas > solicitadas) {
    throw v.erroDeCampo('horasAprovadas', `As horas aprovadas não podem passar das solicitadas (${solicitadas} h).`);
  }

  await registrarDecisao(s, coordenador, {
    resultado: 'APROVADA', horasAprovadas, justificativa: dados.observacao, permiteCorrecao: false,
  });
  const atualizada = await prisma.submissao.findUnique({ where: { id: s.id }, include: INCLUIR });
  return { submissao: paraJson(atualizada, req, { paraCoordenador: true }), progressoAluno: await resumoProgresso(s.alunoId) };
}

/** PATCH /submissoes/:id/rejeitar — corpo: { motivo, permiteCorrecao? } */
async function rejeitar(idBruto, corpo, coordenador, req) {
  const s = await prepararAvaliacao(idBruto, coordenador);
  v.exigirObjeto(corpo);
  const dados = v.validar({
    motivo: v.textoLongo(corpo.motivo, { min: 5, max: 1000, nomeCampo: 'Motivo da rejeição' }),
    permiteCorrecao: v.booleano(corpo.permiteCorrecao, 'permiteCorrecao'),
  });

  await registrarDecisao(s, coordenador, {
    resultado: 'REJEITADA', horasAprovadas: null, justificativa: dados.motivo, permiteCorrecao: dados.permiteCorrecao,
  });
  const atualizada = await prisma.submissao.findUnique({ where: { id: s.id }, include: INCLUIR });
  return { submissao: paraJson(atualizada, req, { paraCoordenador: true }), progressoAluno: await resumoProgresso(s.alunoId) };
}

// ---------------------------------------------------------------------
// Download do certificado
// ---------------------------------------------------------------------

/**
 * Libera o arquivo se o link assinado for válido OU se quem pede é o aluno
 * dono / coordenador do curso. Devolve { caminho, tipo, nomeOriginal }.
 */
async function arquivoDoComprovante(idBruto, query, usuario) {
  const id = v.validar({ id: v.idPositivo(idBruto, 'Id do certificado') }).id;
  const c = await prisma.comprovante.findUnique({
    where: { id },
    include: { submissao: { select: { alunoId: true, aluno: { select: { cursoId: true } } } } },
  });
  if (!c) throw new AppError(404, 'CERTIFICADO_NAO_ENCONTRADO', 'Certificado não encontrado.');

  const linkValido = arquivos.assinaturaValida(c.id, query.expira, query.assinatura);
  const ehDono = usuario?.perfil === PERFIS.ALUNO && usuario.id === c.submissao.alunoId;
  const ehCoordenador = usuario?.perfil === PERFIS.COORDENADOR && usuario.curso?.id === c.submissao.aluno.cursoId;
  if (!linkValido && !ehDono && !ehCoordenador) {
    if (!usuario) throw new AppError(401, 'LINK_INVALIDO', 'Link inválido ou expirado. Abra o certificado novamente pela lista.');
    throw new AppError(404, 'CERTIFICADO_NAO_ENCONTRADO', 'Certificado não encontrado.');
  }
  return { caminho: arquivos.caminhoDe(c.nomeArmazenado), tipo: c.tipoMime, nomeOriginal: c.nomeOriginal };
}

module.exports = { criar, listarDoAluno, listarParaCoordenador, detalhar, aprovar, rejeitar, arquivoDoComprovante };
