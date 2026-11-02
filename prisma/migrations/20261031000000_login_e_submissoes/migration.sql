-- =====================================================================
-- Migração 2: dois perfis, senha do login de teste e envio de certificados
-- =====================================================================
--  * O sistema passa a ter só os perfis ALUNO e COORDENADOR.
--    Contas ORGANIZADOR/ADMINISTRADOR existentes viram COORDENADOR
--    (antes de o ENUM mudar, senão o MySQL recusaria a alteração).
--  * usuarios.senha_hash: hash bcrypt do login de teste (opcional).
--  * submissoes.data_inicio passa a ser opcional (o formulário do front
--    não exige o período) e ganha alerta_duplicidade.
-- =====================================================================

-- Converte os perfis que deixaram de existir
UPDATE `usuarios` SET `perfil` = 'COORDENADOR' WHERE `perfil` IN ('ORGANIZADOR', 'ADMINISTRADOR');

-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `senha_hash` VARCHAR(100) NULL,
    MODIFY `perfil` ENUM('ALUNO', 'COORDENADOR') NOT NULL DEFAULT 'ALUNO';

-- AlterTable
ALTER TABLE `submissoes` ADD COLUMN `alerta_duplicidade` VARCHAR(255) NULL,
    MODIFY `data_inicio` DATE NULL;
