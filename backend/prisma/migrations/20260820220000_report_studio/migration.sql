CREATE TABLE `ReportTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ReportTemplate_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReportTheme` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `configJson` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ReportTheme_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReportTemplateVersion` (
  `id` VARCHAR(191) NOT NULL,
  `reportTemplateId` VARCHAR(191) NOT NULL,
  `version` VARCHAR(40) NOT NULL,
  `status` ENUM('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `themeId` VARCHAR(191) NULL,
  `layoutJson` JSON NOT NULL,
  `bindingConfigJson` JSON NULL,
  `pendingBindings` INTEGER NOT NULL DEFAULT 0,
  `createdById` VARCHAR(191) NULL,
  `reviewedById` VARCHAR(191) NULL,
  `approvedById` VARCHAR(191) NULL,
  `publishedById` VARCHAR(191) NULL,
  `configurationHash` CHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `publishedAt` DATETIME(3) NULL,
  UNIQUE INDEX `ReportTemplateVersion_reportTemplateId_version_key`(`reportTemplateId`, `version`),
  INDEX `ReportTemplateVersion_status_updatedAt_idx`(`status`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReportAsset` (
  `id` VARCHAR(191) NOT NULL,
  `themeId` VARCHAR(191) NULL,
  `name` VARCHAR(180) NOT NULL,
  `mimeType` VARCHAR(100) NOT NULL,
  `data` LONGBLOB NOT NULL,
  `byteSize` INTEGER NOT NULL,
  `sha256` CHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ReportAsset_themeId_idx`(`themeId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReportClassificationSet` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `description` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ReportClassificationSet_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReportClassificationRange` (
  `id` VARCHAR(191) NOT NULL,
  `reportClassificationSetId` VARCHAR(191) NOT NULL,
  `minValue` INTEGER NOT NULL,
  `maxValue` INTEGER NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  `color` VARCHAR(20) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  INDEX `ReportClassRange_set_sort_idx`(`reportClassificationSetId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeneratedReport` (
  `id` VARCHAR(191) NOT NULL,
  `resultRunId` VARCHAR(191) NULL,
  `reportTemplateVersionId` VARCHAR(191) NOT NULL,
  `generatedById` VARCHAR(191) NULL,
  `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `status` ENUM('GENERATING','READY','FAILED') NOT NULL DEFAULT 'GENERATING',
  `filename` VARCHAR(255) NOT NULL,
  `mimeType` VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  `pdfData` LONGBLOB NULL,
  `byteSize` INTEGER NULL,
  `sha256` CHAR(64) NULL,
  `pageCount` INTEGER NULL,
  `error` TEXT NULL,
  `dataSnapshot` JSON NULL,
  INDEX `GeneratedReport_resultRunId_generatedAt_idx`(`resultRunId`, `generatedAt`),
  INDEX `GeneratedReport_reportTemplateVersionId_generatedAt_idx`(`reportTemplateVersionId`, `generatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ReportTemplateVersion` ADD CONSTRAINT `ReportTemplateVersion_reportTemplateId_fkey` FOREIGN KEY (`reportTemplateId`) REFERENCES `ReportTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReportTemplateVersion` ADD CONSTRAINT `ReportTemplateVersion_themeId_fkey` FOREIGN KEY (`themeId`) REFERENCES `ReportTheme`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReportAsset` ADD CONSTRAINT `ReportAsset_themeId_fkey` FOREIGN KEY (`themeId`) REFERENCES `ReportTheme`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReportClassificationRange` ADD CONSTRAINT `ReportClassificationRange_reportClassificationSetId_fkey` FOREIGN KEY (`reportClassificationSetId`) REFERENCES `ReportClassificationSet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GeneratedReport` ADD CONSTRAINT `GeneratedReport_resultRunId_fkey` FOREIGN KEY (`resultRunId`) REFERENCES `ResultRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `GeneratedReport` ADD CONSTRAINT `GeneratedReport_reportTemplateVersionId_fkey` FOREIGN KEY (`reportTemplateVersionId`) REFERENCES `ReportTemplateVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
