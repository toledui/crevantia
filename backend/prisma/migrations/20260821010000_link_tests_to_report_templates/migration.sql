CREATE TABLE `TestReportTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `testId` VARCHAR(191) NOT NULL,
  `assessmentId` VARCHAR(191) NULL,
  `reportTemplateId` VARCHAR(191) NOT NULL,
  `language` VARCHAR(10) NOT NULL DEFAULT 'es-MX',
  `audience` VARCHAR(40) NOT NULL DEFAULT 'INDIVIDUAL',
  `isDefault` BOOLEAN NOT NULL DEFAULT true,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TestReportTemplate_testId_reportTemplateId_language_audience_key`(`testId`, `reportTemplateId`, `language`, `audience`),
  INDEX `TestReportTemplate_resolution_idx`(`testId`, `assessmentId`, `language`, `audience`, `isDefault`, `isActive`),
  INDEX `TestReportTemplate_reportTemplateId_isActive_idx`(`reportTemplateId`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TestReportTemplate` ADD CONSTRAINT `TestReportTemplate_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `Test`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TestReportTemplate` ADD CONSTRAINT `TestReportTemplate_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `TestReportTemplate` ADD CONSTRAINT `TestReportTemplate_reportTemplateId_fkey` FOREIGN KEY (`reportTemplateId`) REFERENCES `ReportTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
