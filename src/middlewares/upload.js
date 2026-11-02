// Recebe o formulário multipart/form-data do envio de certificado (multer).
// O arquivo fica em MEMÓRIA até ser validado: só depois de conferir o tipo
// real e as regras é que ele vai para o disco (src/services/arquivoService.js).
const multer = require('multer');
const config = require('../config/env');

const upload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8', // nomes de arquivo com acento chegam corretos
  limits: {
    fileSize: config.arquivos.tamanhoMaximoBytes,
    files: 1, // um certificado por envio
    fields: 20,
    fieldSize: 10 * 1024, // 10 KB por campo de texto
    parts: 25,
  },
});

/** Campo do arquivo no formulário: "arquivo". */
const receberCertificado = upload.single('arquivo');

module.exports = { receberCertificado };
