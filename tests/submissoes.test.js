// Envio de certificados (POST /submissoes), Minhas Submissões e download do arquivo.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

before(h.iniciar);
after(h.encerrar);

const pastaComprovantes = () => path.join(process.env.UPLOADS_DIR, 'comprovantes');

describe('POST /api/submissoes (enviar certificado)', () => {
  it('aluno envia PDF: 201, status PENDENTE e certificado com link', async () => {
    const r = await h.enviarCertificado('ALUA1', {
      titulo: 'Curso de Git e GitHub', instituicao: 'Universidade de Fortaleza', cargaHoraria: '20',
      dataInicio: h.diaPassado(30), dataFim: h.diaPassado(25), observacoes: 'Curso online com prova final.',
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const s = r.body.submissao;
    assert.equal(r.headers.get('location'), `/api/submissoes/${s.id}`);
    assert.equal(s.status, 'PENDENTE');
    assert.equal(s.titulo, 'Curso de Git e GitHub');
    assert.deepEqual(s.categoria, { id: h.ids.categoria.Ensino, nome: 'Ensino' });
    assert.equal(s.horasSolicitadas, 20);
    assert.equal(s.horasAprovadas, null);
    assert.equal(s.dataInicio, h.diaPassado(30));
    assert.equal(s.observacoes, 'Curso online com prova final.');
    assert.equal(s.atividade, null); // atividade externa
    assert.equal(s.certificado.nomeOriginal, 'certificado.pdf');
    assert.equal(s.certificado.tipo, 'application/pdf');
    assert.match(s.certificado.url, /\/api\/comprovantes\/\d+\/arquivo\?expira=\d+&assinatura=/);
    assert.equal(s.alertaDuplicidade, undefined); // alerta é só para o coordenador
  });

  it('o status enviado pelo formulário é ignorado: sempre começa PENDENTE', async () => {
    const r = await h.enviarCertificado('ALUA1', { status: 'APROVADA', horasAprovadas: '99', titulo: 'Tentativa de burlar' });
    assert.equal(r.status, 201);
    assert.equal(r.body.submissao.status, 'PENDENTE');
    assert.equal(r.body.submissao.horasAprovadas, null);
  });

  it('aceita PNG e JPEG; o arquivo vai para o disco com nome aleatório', async () => {
    const r1 = await h.enviarCertificado('ALUA1', { titulo: 'Certificado em imagem PNG' }, { conteudo: h.png(), nome: 'foto.PNG', tipo: 'image/png' });
    const r2 = await h.enviarCertificado('ALUA1', { titulo: 'Certificado em imagem JPEG' }, { conteudo: h.jpeg(), nome: 'foto.jpeg', tipo: 'image/jpeg' });
    assert.equal(r1.status, 201);
    assert.equal(r2.status, 201);
    assert.equal(r2.body.submissao.certificado.tipo, 'image/jpeg');
    const c = await h.prisma.comprovante.findUnique({ where: { id: r1.body.submissao.certificado.id } });
    assert.match(c.nomeArmazenado, /^[0-9a-f-]{36}\.png$/);
    assert.ok(fs.existsSync(path.join(pastaComprovantes(), c.nomeArmazenado)));
    assert.equal(c.sha256.length, 64);
  });

  it('aceita nomes de arquivo com acento', async () => {
    const r = await h.enviarCertificado('ALUA1', { titulo: 'Certificado com acento' }, { conteudo: h.pdf(), nome: 'certificação-extensão.pdf', tipo: 'application/pdf' });
    assert.equal(r.body.submissao.certificado.nomeOriginal, 'certificação-extensão.pdf');
  });

  it('confere o TIPO REAL: executável renomeado para .pdf é recusado', async () => {
    const falso = Buffer.from('MZ\x90\x00 isto é um executável');
    const r = await h.enviarCertificado('ALUA1', { titulo: 'Arquivo falso' }, { conteudo: falso, nome: 'certificado.pdf', tipo: 'application/pdf' });
    assert.equal(r.status, 400);
    assert.ok(r.body.erro.detalhes.campos.arquivo);
  });

  it('recusa extensão que não combina com o conteúdo, e formatos fora da lista', async () => {
    const r1 = await h.enviarCertificado('ALUA1', { titulo: 'PDF com nome de imagem' }, { conteudo: h.pdf(), nome: 'certificado.png', tipo: 'image/png' });
    const r2 = await h.enviarCertificado('ALUA1', { titulo: 'Documento do Word' }, { conteudo: Buffer.from('PK\x03\x04 docx'), nome: 'certificado.docx', tipo: 'application/vnd.openxmlformats' });
    assert.equal(r1.status, 400);
    assert.equal(r2.status, 400);
  });

  it('arquivo maior que o limite: 413 (e nada é gravado)', async () => {
    const antes = await h.prisma.submissao.count();
    const grande = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1024 * 1024 + 10, 0x20)]);
    const r = await h.enviarCertificado('ALUA1', { titulo: 'Arquivo grande' }, { conteudo: grande, nome: 'grande.pdf', tipo: 'application/pdf' });
    assert.equal(r.status, 413);
    assert.equal(r.body.erro.codigo, 'ARQUIVO_MUITO_GRANDE');
    assert.equal(await h.prisma.submissao.count(), antes);
  });

  it('sem arquivo, arquivo vazio ou dois arquivos: 400', async () => {
    assert.equal((await h.enviarCertificado('ALUA1', {}, null)).status, 400);
    assert.equal((await h.enviarCertificado('ALUA1', {}, { conteudo: Buffer.alloc(0), nome: 'vazio.pdf', tipo: 'application/pdf' })).status, 400);
    const form = h.formularioCertificado({ titulo: 'Dois arquivos' });
    form.append('arquivo', new Blob([h.pdf()], { type: 'application/pdf' }), 'outro.pdf');
    assert.equal((await h.api('POST', '/submissoes', { form, como: 'ALUA1' })).status, 400);
  });

  it('campos obrigatórios e regras de data', async () => {
    const r = await h.api('POST', '/submissoes', { form: h.formularioCertificado({ titulo: '', categoriaId: '', cargaHoraria: '0' }), como: 'ALUA1' });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.erro.detalhes.campos).sort(), ['cargaHoraria', 'categoriaId', 'titulo']);

    const futuro = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    assert.equal((await h.enviarCertificado('ALUA1', { dataInicio: futuro })).status, 400);
    assert.equal((await h.enviarCertificado('ALUA1', { dataFim: h.diaPassado(3) })).status, 400); // fim sem início
    assert.equal((await h.enviarCertificado('ALUA1', { dataInicio: h.diaPassado(3), dataFim: h.diaPassado(10) })).status, 400);
    assert.equal((await h.enviarCertificado('ALUA1', { observacoes: 'x'.repeat(501) })).status, 400);
  });

  it('categoria ou atividade inexistentes: 400', async () => {
    assert.equal((await h.enviarCertificado('ALUA1', { categoriaId: 999999 })).status, 400);
    assert.equal((await h.enviarCertificado('ALUA1', { atividadeId: 999999 })).status, 400);
  });

  it('pode ligar a uma atividade do catálogo, mas só uma vez por aluno (409)', async () => {
    const atividade = await h.criarAtividadeNoBanco({ titulo: 'Semana de Tecnologia' });
    const r1 = await h.enviarCertificado('ALUA2', { atividadeId: atividade.id, titulo: 'Semana de Tecnologia' });
    assert.equal(r1.status, 201);
    assert.deepEqual(r1.body.submissao.atividade, { id: atividade.id, titulo: 'Semana de Tecnologia' });
    const r2 = await h.enviarCertificado('ALUA2', { atividadeId: atividade.id, titulo: 'Semana de Tecnologia de novo' });
    assert.equal(r2.status, 409);
    assert.equal(r2.body.erro.codigo, 'SUBMISSAO_DUPLICADA');
  });

  it('o mesmo arquivo duas vezes pelo mesmo aluno: 409', async () => {
    const mesmo = h.pdf('arquivo repetido do aluno');
    const arquivo = { conteudo: mesmo, nome: 'a.pdf', tipo: 'application/pdf' };
    assert.equal((await h.enviarCertificado('ALUB1', { titulo: 'Primeiro envio' }, arquivo)).status, 201);
    const r = await h.enviarCertificado('ALUB1', { titulo: 'Segundo envio' }, arquivo);
    assert.equal(r.status, 409);
    assert.equal(r.body.erro.codigo, 'ARQUIVO_JA_ENVIADO');
  });

  it('suspeitas não bloqueiam, mas avisam o coordenador', async () => {
    const compartilhado = h.pdf('arquivo de outro aluno');
    await h.enviarCertificado('ALUA1', { titulo: 'Original' }, { conteudo: compartilhado, nome: 'x.pdf', tipo: 'application/pdf' });
    const copia = await h.enviarCertificado('ALUA2', { titulo: 'Cópia' }, { conteudo: compartilhado, nome: 'x.pdf', tipo: 'application/pdf' });
    assert.equal(copia.status, 201);
    await h.enviarCertificado('ALUA2', { titulo: 'Palestra de Carreira', cargaHoraria: '4' });
    const parecida = await h.enviarCertificado('ALUA2', { titulo: '  palestra de CARREIRA ', cargaHoraria: '4' });
    assert.equal(parecida.status, 201);

    const painel = await h.api('GET', '/submissoes?porPagina=100', { como: 'COOA' });
    const alerta = (id) => painel.body.submissoes.find((s) => s.id === id).alertaDuplicidade;
    assert.match(alerta(copia.body.submissao.id), /outro aluno/);
    assert.match(alerta(parecida.body.submissao.id), /Título e carga horária iguais/);
  });

  it('só aluno envia (coordenador 403, sem login 401); aluno sem curso: 409', async () => {
    assert.equal((await h.enviarCertificado('COOA', {})).status, 403);
    assert.equal((await h.api('POST', '/submissoes', { form: h.formularioCertificado() })).status, 401);
    const r = await h.enviarCertificado('ALUSEM', {});
    assert.equal(r.status, 409);
  });
});

describe('GET /api/submissoes/minhas', () => {
  before(async () => {
    // Uma rejeitada com motivo e uma aprovada, para ALUB1
    const r1 = await h.enviarCertificado('ALUB1', { titulo: 'Palestra rejeitada', cargaHoraria: '4' });
    const r2 = await h.enviarCertificado('ALUB1', { titulo: 'Monitoria aprovada', cargaHoraria: '30' });
    await h.api('PATCH', `/submissoes/${r1.body.submissao.id}/rejeitar`, { corpo: { motivo: 'Certificado ilegível' }, como: 'COOB' });
    await h.api('PATCH', `/submissoes/${r2.body.submissao.id}/aprovar`, { corpo: {}, como: 'COOB' });
  });

  it('lista só as do aluno, mais recentes primeiro, com contagem por status', async () => {
    const r = await h.api('GET', '/submissoes/minhas', { como: 'ALUB1' });
    assert.equal(r.status, 200);
    assert.ok(r.body.submissoes.length >= 3);
    const alunos = await h.prisma.submissao.findMany({ where: { id: { in: r.body.submissoes.map((s) => s.id) } }, select: { alunoId: true } });
    assert.ok(alunos.every((s) => s.alunoId === h.ids.usuario.ALUB1));
    assert.equal(r.body.contagem.todas, r.body.paginacao.total);
    assert.equal(r.body.contagem.aprovadas, 1);
    assert.equal(r.body.contagem.rejeitadas, 1);
    const datas = r.body.submissoes.map((s) => new Date(s.enviadaEm).getTime());
    assert.deepEqual(datas, [...datas].sort((a, b) => b - a));
  });

  it('mostra o motivo da rejeição e filtra por status', async () => {
    const r = await h.api('GET', '/submissoes/minhas?status=rejeitada', { como: 'ALUB1' });
    assert.equal(r.body.submissoes.length, 1);
    assert.equal(r.body.submissoes[0].status, 'REJEITADA');
    assert.equal(r.body.submissoes[0].motivoRejeicao, 'Certificado ilegível');
    const aprovadas = await h.api('GET', '/submissoes/minhas?status=APROVADA', { como: 'ALUB1' });
    assert.equal(aprovadas.body.submissoes[0].horasAprovadas, 30);
    assert.equal(aprovadas.body.submissoes[0].motivoRejeicao, null);
  });

  it('busca pelo título; status inválido: 400; coordenador: 403', async () => {
    const r = await h.api('GET', '/submissoes/minhas?busca=monitoria', { como: 'ALUB1' });
    assert.deepEqual(r.body.submissoes.map((s) => s.titulo), ['Monitoria aprovada']);
    assert.equal((await h.api('GET', '/submissoes/minhas?status=EM_ANALISE', { como: 'ALUB1' })).status, 400);
    assert.equal((await h.api('GET', '/submissoes/minhas', { como: 'COOA' })).status, 403);
  });
});

describe('GET /api/comprovantes/:id/arquivo (abrir o certificado)', () => {
  let enviado;
  let conteudo;
  before(async () => {
    conteudo = h.pdf('arquivo para download');
    const r = await h.enviarCertificado('ALUA1', { titulo: 'Para baixar' }, { conteudo, nome: 'meu certificado.pdf', tipo: 'application/pdf' });
    enviado = r.body.submissao.certificado;
  });

  it('o link assinado abre o arquivo SEM login (para usar num <a href>)', async () => {
    const r = await h.requisicao('GET', enviado.url);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.match(r.headers.get('content-disposition'), /^inline;/);
    assert.ok(Buffer.compare(r.body, conteudo) === 0);
  });

  it('link adulterado ou expirado: recusado', async () => {
    const adulterado = enviado.url.replace(/assinatura=[^&]+/, 'assinatura=assinatura-falsa');
    assert.equal((await h.requisicao('GET', adulterado)).status, 401);
    const outroId = enviado.url.replace(`/comprovantes/${enviado.id}/`, `/comprovantes/${enviado.id + 1}/`);
    assert.notEqual((await h.requisicao('GET', outroId)).status, 200);
    const expirado = enviado.url.replace(/expira=\d+/, `expira=${Math.floor(Date.now() / 1000) - 10}`);
    assert.equal((await h.requisicao('GET', expirado)).status, 401);
  });

  it('sem assinatura: o dono e o coordenador do curso abrem; os demais não', async () => {
    const semAssinatura = `/comprovantes/${enviado.id}/arquivo`;
    assert.equal((await h.api('GET', semAssinatura, { como: 'ALUA1' })).status, 200);
    assert.equal((await h.api('GET', semAssinatura, { como: 'COOA' })).status, 200);
    assert.equal((await h.api('GET', semAssinatura, { como: 'ALUA2' })).status, 404);
    assert.equal((await h.api('GET', semAssinatura, { como: 'COOB' })).status, 404);
    assert.equal((await h.api('GET', semAssinatura)).status, 401);
  });
});
