#!/usr/bin/env node
// =====================================================================
// DADOS FICTÍCIOS — SOMENTE PARA DESENVOLVIMENTO E DEMONSTRAÇÃO
// =====================================================================
// Cria cursos, usuários, atividades e submissões de EXEMPLO, marcados com
// [DEMO]. Os números reproduzem o dashboard das telas (125 h de 200 h).
// Recusa rodar com NODE_ENV=production. Pode rodar mais de uma vez.
//   npm run db:demo
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { semearBase } = require('./seed');

const USUARIOS = [
  { matricula: 'DEMOADM01', nome: '[DEMO] Administradora', perfil: 'ADMINISTRADOR', curso: null },
  { matricula: 'DEMOCOO01', nome: '[DEMO] Coordenação de Computação', perfil: 'COORDENADOR', curso: '[DEMO] Ciência da Computação' },
  { matricula: 'DEMOORG01', nome: '[DEMO] Organizadora de Eventos', perfil: 'ORGANIZADOR', curso: null },
  { matricula: 'DEMOALU01', nome: '[DEMO] Aluno Exemplo', perfil: 'ALUNO', curso: '[DEMO] Ciência da Computação' },
  { matricula: 'DEMOALU02', nome: '[DEMO] Aluna de Sistemas', perfil: 'ALUNO', curso: '[DEMO] Sistemas de Informação' },
];

/** Data daqui a `dias` dias, no horário de Fortaleza (UTC-3). */
function emDias(dias, hora = 14, minuto = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  d.setUTCHours(hora + 3, minuto, 0, 0);
  return d;
}

async function principal(prisma) {
  await semearBase(prisma);

  const id = async (modelo, nome) => (await prisma[modelo].findUnique({ where: { nome } })).id;
  const [ensino, pesquisa, extensao] = await Promise.all(['Ensino', 'Pesquisa', 'Extensão'].map((n) => id('categoria', n)));

  // Cursos (com metas visuais por categoria no curso de Computação)
  const cc = await prisma.curso.upsert({
    where: { nome: '[DEMO] Ciência da Computação' },
    update: {},
    create: { nome: '[DEMO] Ciência da Computação', cargaHorariaMinima: 200 },
  });
  await prisma.curso.upsert({
    where: { nome: '[DEMO] Sistemas de Informação' },
    update: {},
    create: { nome: '[DEMO] Sistemas de Informação', cargaHorariaMinima: 150 },
  });
  for (const [categoriaId, horasMeta] of [[ensino, 60], [pesquisa, 50], [extensao, 90]]) {
    await prisma.metaCategoriaCurso.upsert({
      where: { cursoId_categoriaId: { cursoId: cc.id, categoriaId } },
      update: {},
      create: { cursoId: cc.id, categoriaId, horasMeta },
    });
  }

  // Usuários (sem senha: o login será o da Unifor)
  for (const u of USUARIOS) {
    const cursoId = u.curso ? await id('curso', u.curso) : null;
    await prisma.usuario.upsert({
      where: { matricula: u.matricula },
      update: {},
      create: { matricula: u.matricula, nome: u.nome, perfil: u.perfil, cursoId },
    });
  }
  const organizador = await prisma.usuario.findUnique({ where: { matricula: 'DEMOORG01' } });
  const aluno = await prisma.usuario.findUnique({ where: { matricula: 'DEMOALU01' } });

  // Atividades do catálogo (só na primeira execução)
  if ((await prisma.atividade.count({ where: { organizadorId: organizador.id } })) === 0) {
    const tipo = (nome) => id('tipoAtividade', nome);
    const atividades = [
      {
        titulo: '[DEMO] Workshop de Desenvolvimento Web',
        descricao: 'Fundamentos do desenvolvimento web com foco em boas práticas e projetos práticos.',
        categoriaId: extensao, tipoId: await tipo('Workshop'), modalidade: 'PRESENCIAL',
        dataInicio: emDias(7, 14), dataFim: emDias(7, 18), local: 'Auditório Central', cargaHoraria: 4,
        vagas: 80, prazoInscricao: emDias(5, 23, 59), inscricaoInfo: 'Inscrições pelo formulário do evento.',
        cursos: [cc.id],
      },
      {
        titulo: '[DEMO] Semana Acadêmica de Computação',
        descricao: 'Palestras, painéis e oficinas com profissionais e pesquisadores da área de Computação.',
        categoriaId: ensino, tipoId: await tipo('Evento'), modalidade: 'PRESENCIAL',
        dataInicio: emDias(12, 19), dataFim: emDias(14, 22), local: 'Centro de Convenções', cargaHoraria: 10,
        cursos: [cc.id],
      },
      {
        titulo: '[DEMO] Minicurso de Pesquisa Científica',
        descricao: 'Introdução às metodologias de pesquisa, elaboração de projetos e escrita de artigos científicos.',
        categoriaId: pesquisa, tipoId: await tipo('Minicurso'), modalidade: 'ONLINE',
        dataInicio: emDias(20, 14), dataFim: emDias(20, 20), local: 'Online (via Microsoft Teams)', cargaHoraria: 6,
        cursos: [],
      },
      {
        titulo: '[DEMO] Ação Voluntária na Comunidade',
        descricao: 'Atividade de extensão com ações educativas em escolas públicas da região.',
        categoriaId: extensao, tipoId: await tipo('Voluntariado'), modalidade: 'PRESENCIAL',
        dataInicio: emDias(25, 8), dataFim: emDias(25, 12), local: 'Escola parceira (endereço enviado após inscrição)', cargaHoraria: 4,
        contato: 'extensao@exemplo.edu', cursos: [],
      },
    ];
    for (const { cursos, ...a } of atividades) {
      await prisma.atividade.create({
        data: { ...a, organizadorId: organizador.id, cursos: { create: cursos.map((cursoId) => ({ cursoId })) } },
      });
    }
  }

  // Submissões do aluno de exemplo: 40 h Ensino + 35 h Pesquisa + 50 h Extensão = 125 h aprovadas
  if ((await prisma.submissao.count({ where: { alunoId: aluno.id } })) === 0) {
    const coordenador = await prisma.usuario.findUnique({ where: { matricula: 'DEMOCOO01' } });
    const aprovada = (titulo, categoriaId, horas, inicio) => ({
      alunoId: aluno.id, categoriaId, titulo, dataInicio: new Date(inicio), horasSolicitadas: horas,
      horasAprovadas: horas, status: 'APROVADA', avaliadorId: coordenador.id, avaliadaEm: new Date(),
    });
    const submissoes = [
      aprovada('[DEMO] Monitoria de Algoritmos', ensino, 30, '2026-03-02'),
      aprovada('[DEMO] Curso de Git e GitHub', ensino, 10, '2026-04-10'),
      aprovada('[DEMO] Iniciação Científica (1º semestre)', pesquisa, 35, '2026-02-01'),
      aprovada('[DEMO] Projeto de Extensão em Escolas', extensao, 50, '2026-03-15'),
      { alunoId: aluno.id, categoriaId: extensao, titulo: '[DEMO] Visita técnica', dataInicio: new Date('2026-09-25'), horasSolicitadas: 8 },
      {
        alunoId: aluno.id, categoriaId: ensino, titulo: '[DEMO] Curso externo de Inteligência Artificial',
        instituicao: 'Plataforma online', dataInicio: new Date('2026-08-01'), horasSolicitadas: 20, status: 'REJEITADA',
        permiteCorrecao: true, justificativa: 'O certificado enviado não mostra a carga horária. Envie a versão completa.',
        avaliadorId: coordenador.id, avaliadaEm: new Date(),
      },
    ];
    for (const s of submissoes) await prisma.submissao.create({ data: s });
  }
}

if (require.main === module) {
  if (process.env.NODE_ENV === 'production') {
    console.error('Recusado: dados de demonstração não podem ser criados com NODE_ENV=production.');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  principal(prisma)
    .then(() => {
      console.log('Dados FICTÍCIOS de demonstração prontos. Identifique-se com o cabeçalho X-Matricula:');
      for (const u of USUARIOS) console.log(`  ${u.perfil.padEnd(14)} ${u.matricula}`);
    })
    .catch((erro) => {
      console.error('Falha ao criar os dados de demonstração:', erro.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { principal, USUARIOS };
