-- =====================================================================
-- Migração inicial do Portal de Atividades Complementares (Prisma/MySQL)
-- =====================================================================
-- Corresponde ao prisma/schema.prisma. A PARTE 2 (restrições CHECK) foi
-- escrita à mão: o Prisma não representa CHECK no schema, mas as aplica
-- normalmente por estar na migração e não as remove em migrações futuras.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PARTE 1 — Tabelas, índices e chaves estrangeiras
-- ---------------------------------------------------------------------

-- CreateTable
CREATE TABLE `cursos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(150) NOT NULL,
    `carga_horaria_minima` DECIMAL(6, 2) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cursos_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `curso_categoria_metas` (
    `curso_id` INTEGER NOT NULL,
    `categoria_id` INTEGER NOT NULL,
    `horas_meta` DECIMAL(6, 2) NOT NULL,

    INDEX `curso_categoria_metas_categoria_id_idx`(`categoria_id`),
    PRIMARY KEY (`curso_id`, `categoria_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricula` VARCHAR(20) NOT NULL,
    `nome` VARCHAR(150) NOT NULL,
    `email` VARCHAR(254) NULL,
    `perfil` ENUM('ALUNO', 'ORGANIZADOR', 'COORDENADOR', 'ADMINISTRADOR') NOT NULL DEFAULT 'ALUNO',
    `curso_id` INTEGER NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usuarios_matricula_key`(`matricula`),
    UNIQUE INDEX `usuarios_email_key`(`email`),
    INDEX `usuarios_curso_id_idx`(`curso_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categorias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(100) NOT NULL,
    `descricao` VARCHAR(500) NULL,
    `ativa` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categorias_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipos_atividade` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(60) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tipos_atividade_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `atividades` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(200) NOT NULL,
    `descricao` TEXT NOT NULL,
    `categoria_id` INTEGER NOT NULL,
    `tipo_id` INTEGER NOT NULL,
    `modalidade` ENUM('PRESENCIAL', 'ONLINE', 'HIBRIDA') NOT NULL,
    `data_inicio` DATETIME(3) NOT NULL,
    `data_fim` DATETIME(3) NULL,
    `local` VARCHAR(255) NULL,
    `link` VARCHAR(500) NULL,
    `imagem_url` VARCHAR(500) NULL,
    `carga_horaria` DECIMAL(6, 2) NOT NULL,
    `prazo_inscricao` DATETIME(3) NULL,
    `vagas` INTEGER UNSIGNED NULL,
    `inscricao_info` VARCHAR(1000) NULL,
    `contato` VARCHAR(255) NULL,
    `organizador_id` INTEGER NOT NULL,
    `status` ENUM('ATIVA', 'CANCELADA') NOT NULL DEFAULT 'ATIVA',
    `motivo_cancelamento` VARCHAR(500) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `atividades_categoria_id_idx`(`categoria_id`),
    INDEX `atividades_tipo_id_idx`(`tipo_id`),
    INDEX `atividades_organizador_id_idx`(`organizador_id`),
    INDEX `atividades_data_inicio_idx`(`data_inicio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `atividade_cursos` (
    `atividade_id` INTEGER NOT NULL,
    `curso_id` INTEGER NOT NULL,

    INDEX `atividade_cursos_curso_id_idx`(`curso_id`),
    PRIMARY KEY (`atividade_id`, `curso_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submissoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `aluno_id` INTEGER NOT NULL,
    `atividade_id` INTEGER NULL,
    `categoria_id` INTEGER NOT NULL,
    `titulo` VARCHAR(200) NOT NULL,
    `instituicao` VARCHAR(200) NULL,
    `descricao` TEXT NULL,
    `data_inicio` DATE NOT NULL,
    `data_fim` DATE NULL,
    `horas_solicitadas` DECIMAL(6, 2) NOT NULL,
    `horas_aprovadas` DECIMAL(6, 2) NULL,
    `status` ENUM('PENDENTE', 'APROVADA', 'REJEITADA') NOT NULL DEFAULT 'PENDENTE',
    `permite_correcao` BOOLEAN NOT NULL DEFAULT false,
    `justificativa` TEXT NULL,
    `avaliador_id` INTEGER NULL,
    `enviada_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `avaliada_em` DATETIME(3) NULL,
    `atualizada_em` DATETIME(3) NOT NULL,

    INDEX `submissoes_status_idx`(`status`),
    INDEX `submissoes_categoria_id_idx`(`categoria_id`),
    INDEX `submissoes_atividade_id_idx`(`atividade_id`),
    INDEX `submissoes_avaliador_id_idx`(`avaliador_id`),
    UNIQUE INDEX `submissoes_aluno_id_atividade_id_key`(`aluno_id`, `atividade_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comprovantes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `submissao_id` INTEGER NOT NULL,
    `nome_original` VARCHAR(255) NOT NULL,
    `nome_armazenado` VARCHAR(100) NOT NULL,
    `tipo_mime` VARCHAR(50) NOT NULL,
    `tamanho_bytes` INTEGER UNSIGNED NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `enviado_por` INTEGER NOT NULL,
    `enviado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `comprovantes_nome_armazenado_key`(`nome_armazenado`),
    INDEX `comprovantes_submissao_id_idx`(`submissao_id`),
    INDEX `comprovantes_sha256_idx`(`sha256`),
    INDEX `comprovantes_enviado_por_idx`(`enviado_por`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `avaliacoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `submissao_id` INTEGER NOT NULL,
    `avaliador_id` INTEGER NOT NULL,
    `resultado` ENUM('APROVADA', 'REJEITADA') NOT NULL,
    `horas_aprovadas` DECIMAL(6, 2) NULL,
    `permite_correcao` BOOLEAN NOT NULL DEFAULT false,
    `justificativa` TEXT NULL,
    `avaliada_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `avaliacoes_submissao_id_idx`(`submissao_id`),
    INDEX `avaliacoes_avaliador_id_idx`(`avaliador_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `curso_categoria_metas` ADD CONSTRAINT `curso_categoria_metas_curso_id_fkey` FOREIGN KEY (`curso_id`) REFERENCES `cursos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curso_categoria_metas` ADD CONSTRAINT `curso_categoria_metas_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_curso_id_fkey` FOREIGN KEY (`curso_id`) REFERENCES `cursos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atividades` ADD CONSTRAINT `atividades_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atividades` ADD CONSTRAINT `atividades_tipo_id_fkey` FOREIGN KEY (`tipo_id`) REFERENCES `tipos_atividade`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atividades` ADD CONSTRAINT `atividades_organizador_id_fkey` FOREIGN KEY (`organizador_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atividade_cursos` ADD CONSTRAINT `atividade_cursos_atividade_id_fkey` FOREIGN KEY (`atividade_id`) REFERENCES `atividades`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atividade_cursos` ADD CONSTRAINT `atividade_cursos_curso_id_fkey` FOREIGN KEY (`curso_id`) REFERENCES `cursos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissoes` ADD CONSTRAINT `submissoes_aluno_id_fkey` FOREIGN KEY (`aluno_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissoes` ADD CONSTRAINT `submissoes_atividade_id_fkey` FOREIGN KEY (`atividade_id`) REFERENCES `atividades`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissoes` ADD CONSTRAINT `submissoes_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissoes` ADD CONSTRAINT `submissoes_avaliador_id_fkey` FOREIGN KEY (`avaliador_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comprovantes` ADD CONSTRAINT `comprovantes_submissao_id_fkey` FOREIGN KEY (`submissao_id`) REFERENCES `submissoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comprovantes` ADD CONSTRAINT `comprovantes_enviado_por_fkey` FOREIGN KEY (`enviado_por`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avaliacoes` ADD CONSTRAINT `avaliacoes_submissao_id_fkey` FOREIGN KEY (`submissao_id`) REFERENCES `submissoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avaliacoes` ADD CONSTRAINT `avaliacoes_avaliador_id_fkey` FOREIGN KEY (`avaliador_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- PARTE 2 — Restrições CHECK (regras de negócio garantidas pelo banco)
-- Mesmo que um bug no código tente gravar algo inconsistente, o MySQL recusa.
-- ---------------------------------------------------------------------

ALTER TABLE `cursos`
    ADD CONSTRAINT `ck_cursos_carga` CHECK (`carga_horaria_minima` > 0);

ALTER TABLE `curso_categoria_metas`
    ADD CONSTRAINT `ck_metas_horas` CHECK (`horas_meta` > 0);

ALTER TABLE `atividades`
    ADD CONSTRAINT `ck_atividades_carga` CHECK (`carga_horaria` > 0),
    ADD CONSTRAINT `ck_atividades_periodo` CHECK (`data_fim` IS NULL OR `data_fim` >= `data_inicio`),
    ADD CONSTRAINT `ck_atividades_vagas` CHECK (`vagas` IS NULL OR `vagas` > 0);

ALTER TABLE `submissoes`
    ADD CONSTRAINT `ck_submissoes_horas` CHECK (`horas_solicitadas` > 0),
    ADD CONSTRAINT `ck_submissoes_aprovadas` CHECK (`horas_aprovadas` IS NULL OR (`horas_aprovadas` > 0 AND `horas_aprovadas` <= `horas_solicitadas`)),
    ADD CONSTRAINT `ck_submissoes_aprovada_tem_horas` CHECK (`status` <> 'APROVADA' OR `horas_aprovadas` IS NOT NULL),
    ADD CONSTRAINT `ck_submissoes_rejeitada_tem_motivo` CHECK (`status` <> 'REJEITADA' OR `justificativa` IS NOT NULL),
    ADD CONSTRAINT `ck_submissoes_periodo` CHECK (`data_fim` IS NULL OR `data_fim` >= `data_inicio`);

ALTER TABLE `comprovantes`
    ADD CONSTRAINT `ck_comprovantes_tipo` CHECK (`tipo_mime` IN ('application/pdf', 'image/png', 'image/jpeg'));

ALTER TABLE `avaliacoes`
    ADD CONSTRAINT `ck_avaliacoes_horas` CHECK (`horas_aprovadas` IS NULL OR `horas_aprovadas` > 0),
    ADD CONSTRAINT `ck_avaliacoes_aprovada_tem_horas` CHECK (`resultado` <> 'APROVADA' OR `horas_aprovadas` IS NOT NULL),
    ADD CONSTRAINT `ck_avaliacoes_rejeitada_tem_motivo` CHECK (`resultado` <> 'REJEITADA' OR `justificativa` IS NOT NULL);
