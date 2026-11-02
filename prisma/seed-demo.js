#!/usr/bin/env node
// =====================================================================
// DADOS FICTÍCIOS — SOMENTE PARA DESENVOLVIMENTO E DEMONSTRAÇÃO
// =====================================================================
// Cria cursos, contas de teste (com senha), atividades e submissões de
// EXEMPLO, todos marcados com [DEMO]. Os certificados são PDFs fictícios
// gerados aqui. O aluno DEMOALU01 reproduz o dashboard das telas (125 h de 200 h).
// Recusa rodar com NODE_ENV=production. Pode rodar mais de uma vez.
//   npm run db:demo
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const config = require('../src/config/env');
const arquivos = require('../src/services/arquivoService');
const { semearBase } = require('./seed');

// Senha de TODAS as contas de demonstração (pública: só para testes).
const SENHA_DEMO = 'demo1234';
const CC = '[DEMO] Ciência da Computação';
const SI = '[DEMO] Sistemas de Informação';

const USUARIOS = [
  { matricula: 'DEMOALU01', nome: '[DEMO] Lucas Almeida', perfil: 'ALUNO', curso: CC, email: 'demo.aluno1@exemplo.edu' },
  { matricula: 'DEMOALU02', nome: '[DEMO] Mariana Costa', perfil: 'ALUNO', curso: CC, email: 'demo.aluno2@exemplo.edu' },
  { matricula: 'DEMOALU03', nome: '[DEMO] João Martins', perfil: 'ALUNO', curso: SI, email: 'demo.aluno3@exemplo.edu' },
  { matricula: 'DEMOCOO01', nome: '[DEMO] Coordenação de Computação', perfil: 'COORDENADOR', curso: CC, email: 'demo.coord.cc@exemplo.edu' },
  { matricula: 'DEMOCOO02', nome: '[DEMO] Coordenação de Sistemas', perfil: 'COORDENADOR', curso: SI, email: 'demo.coord.si@exemplo.edu' },
];

/** Data daqui a `dias` dias, no horário de Fortaleza (UTC-3). */
function emDias(dias, hora = 14, minuto = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  d.setUTCHours(hora + 3, minuto, 0, 0);
  return d;
}

/** PDF mínimo e válido de uma página com duas linhas de texto (certificado fictício). */
function pdfDemo(linha1, linha2) {
  const limpar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[()\\]/g, '');
  const conteudo = `BT /F1 20 Tf 60 700 Td (CERTIFICADO DE DEMONSTRACAO) Tj 0 -40 Td /F1 14 Tf (${limpar(linha1)}) Tj 0 -24 Td (${limpar(linha2)}) Tj 0 -40 Td /F1 10 Tf (Documento ficticio gerado por prisma/seed-demo.js) Tj ET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(conteudo)} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const posicoes = objetos.map((obj, i) => {
    const pos = Buffer.byteLength(pdf);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    return pos;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posicoes.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function principal(prisma) {
  await semearBase(prisma);

  const id = async (modelo, nome) => (await prisma[modelo].findUnique({ where: { nome } })).id;
  const [ensino, pesquisa, extensao] = await Promise.all(['Ensino', 'Pesquisa', 'Extensão'].map((n) => id('categoria', n)));

  // Cursos (metas visuais por categoria no curso de Computação)
  const cc = await prisma.curso.upsert({ where: { nome: CC }, update: {}, create: { nome: CC, cargaHorariaMinima: 200 } });
  await prisma.curso.upsert({ where: { nome: SI }, update: {}, create: { nome: SI, cargaHorariaMinima: 150 } });
  for (const [categoriaId, horasMeta] of [[ensino, 60], [pesquisa, 50], [extensao, 90]]) {
    await prisma.metaCategoriaCurso.upsert({
      where: { cursoId_categoriaId: { cursoId: cc.id, categoriaId } },
      update: {},
      create: { cursoId: cc.id, categoriaId, horasMeta },
    });
  }

  // Contas de teste: sempre com a SENHA_DEMO (atualiza se já existirem)
  const senhaHash = await bcrypt.hash(SENHA_DEMO, config.auth.bcryptRounds);
  const conta = {};
  for (const u of USUARIOS) {
    const cursoId = await id('curso', u.curso);
    conta[u.matricula] = await prisma.usuario.upsert({
      where: { matricula: u.matricula },
      update: { perfil: u.perfil, cursoId, senhaHash, ativo: true },
      create: { matricula: u.matricula, nome: u.nome, email: u.email, perfil: u.perfil, cursoId, senhaHash },
    });
  }
  const coordenador = conta.DEMOCOO01;

  // Atividades do catálogo (só na primeira execução)
  if ((await prisma.atividade.count({ where: { titulo: { startsWith: '[DEMO]' } } })) === 0) {
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
        data: { ...a, organizadorId: coordenador.id, cursos: { create: cursos.map((cursoId) => ({ cursoId })) } },
      });
    }
  }

  // Submissões com certificado (PDF fictício). Só cria se o aluno ainda não tiver nenhuma.
  async function submeter(matricula, s, decisao) {
    const aluno = conta[matricula];
    const pdf = pdfDemo(s.titulo, `${aluno.nome} - ${s.horasSolicitadas} horas`);
    const nomeArmazenado = await arquivos.salvar(pdf, arquivos.TIPOS.pdf);
    // Campos da decisão do coordenador (iguais na submissão e no histórico)
    const resultado = decisao && {
      horasAprovadas: decisao.horasAprovadas ?? null,
      justificativa: decisao.justificativa ?? null,
      permiteCorrecao: decisao.permiteCorrecao ?? false,
      avaliadorId: decisao.avaliadorId,
    };
    await prisma.submissao.create({
      data: {
        alunoId: aluno.id,
        ...s,
        dataInicio: s.dataInicio ? new Date(s.dataInicio) : null,
        ...(decisao ? { status: decisao.resultado, ...resultado, avaliadaEm: new Date() } : { status: 'PENDENTE' }),
        comprovantes: {
          create: [{
            nomeOriginal: `${s.titulo.replace('[DEMO] ', '')}.pdf`, nomeArmazenado, tipoMime: 'application/pdf',
            tamanhoBytes: pdf.length, sha256: arquivos.sha256(pdf), enviadoPorId: aluno.id,
          }],
        },
        ...(decisao ? { avaliacoes: { create: [{ resultado: decisao.resultado, ...resultado }] } } : {}),
      },
    });
  }
  const aprovada = (horas) => ({ resultado: 'APROVADA', horasAprovadas: horas, avaliadorId: coordenador.id });

  if ((await prisma.submissao.count({ where: { alunoId: conta.DEMOALU01.id } })) === 0) {
    // 40 h Ensino + 35 h Pesquisa + 50 h Extensão = 125 h aprovadas
    await submeter('DEMOALU01', { titulo: '[DEMO] Monitoria de Algoritmos', categoriaId: ensino, horasSolicitadas: 30, dataInicio: '2026-03-02' }, aprovada(30));
    await submeter('DEMOALU01', { titulo: '[DEMO] Curso de Git e GitHub', categoriaId: ensino, horasSolicitadas: 10, dataInicio: '2026-04-10', instituicao: 'Plataforma online' }, aprovada(10));
    await submeter('DEMOALU01', { titulo: '[DEMO] Iniciação Científica (1º semestre)', categoriaId: pesquisa, horasSolicitadas: 35, dataInicio: '2026-02-01' }, aprovada(35));
    await submeter('DEMOALU01', { titulo: '[DEMO] Projeto de Extensão em Escolas', categoriaId: extensao, horasSolicitadas: 50, dataInicio: '2026-03-15' }, aprovada(50));
    await submeter('DEMOALU01', { titulo: '[DEMO] Visita técnica', categoriaId: extensao, horasSolicitadas: 8, dataInicio: '2026-09-25' });
    await submeter('DEMOALU01', { titulo: '[DEMO] Curso externo de Inteligência Artificial', categoriaId: ensino, horasSolicitadas: 20, dataInicio: '2026-08-01', instituicao: 'Plataforma online' }, {
      resultado: 'REJEITADA', justificativa: 'O certificado enviado não mostra a carga horária. Envie a versão completa.', permiteCorrecao: true, avaliadorId: coordenador.id,
    });
  }
  if ((await prisma.submissao.count({ where: { alunoId: conta.DEMOALU02.id } })) === 0) {
    await submeter('DEMOALU02', { titulo: '[DEMO] Semana de Tecnologia', categoriaId: extensao, horasSolicitadas: 12, dataInicio: '2026-08-20' });
    await submeter('DEMOALU02', { titulo: '[DEMO] Monitoria em Estruturas de Dados', categoriaId: ensino, horasSolicitadas: 60, dataInicio: '2026-03-01' });
  }
  if ((await prisma.submissao.count({ where: { alunoId: conta.DEMOALU03.id } })) === 0) {
    await submeter('DEMOALU03', { titulo: '[DEMO] Publicação de Artigo Científico', categoriaId: pesquisa, horasSolicitadas: 30, dataInicio: '2026-01-15' });
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
      console.log(`Dados FICTÍCIOS de demonstração prontos. Contas de teste (senha: ${SENHA_DEMO}):`);
      for (const u of USUARIOS) console.log(`  ${u.perfil.padEnd(12)} ${u.matricula}  (${u.curso})`);
    })
    .catch((erro) => {
      console.error('Falha ao criar os dados de demonstração:', erro.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { principal, USUARIOS, SENHA_DEMO, pdfDemo };
