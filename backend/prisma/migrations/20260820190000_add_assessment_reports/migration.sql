CREATE TABLE `AssessmentReport` (
  `id` VARCHAR(191) NOT NULL,
  `resultRunId` VARCHAR(191) NOT NULL,
  `status` ENUM('GENERATING', 'READY', 'FAILED') NOT NULL DEFAULT 'GENERATING',
  `filename` VARCHAR(255) NOT NULL,
  `mimeType` VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  `pdfData` LONGBLOB NULL,
  `byteSize` INTEGER NULL,
  `sha256` CHAR(64) NULL,
  `configurationVersion` INTEGER NOT NULL,
  `configurationSnapshot` JSON NOT NULL,
  `error` TEXT NULL,
  `generatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AssessmentReport_resultRunId_key`(`resultRunId`),
  INDEX `AssessmentReport_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AssessmentReportDelivery` (
  `id` VARCHAR(191) NOT NULL,
  `reportId` VARCHAR(191) NOT NULL,
  `recipient` VARCHAR(191) NOT NULL,
  `trigger` VARCHAR(40) NOT NULL,
  `requestedById` VARCHAR(191) NULL,
  `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `error` TEXT NULL,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `AssessmentReportDelivery_reportId_createdAt_idx`(`reportId`, `createdAt`),
  INDEX `AssessmentReportDelivery_recipient_createdAt_idx`(`recipient`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AssessmentReport`
  ADD CONSTRAINT `AssessmentReport_resultRunId_fkey`
  FOREIGN KEY (`resultRunId`) REFERENCES `ResultRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AssessmentReportDelivery`
  ADD CONSTRAINT `AssessmentReportDelivery_reportId_fkey`
  FOREIGN KEY (`reportId`) REFERENCES `AssessmentReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
