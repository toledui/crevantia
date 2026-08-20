CREATE TABLE `SiteSettings` (
  `id` VARCHAR(20) NOT NULL DEFAULT 'default', `version` INTEGER NOT NULL DEFAULT 1,
  `siteName` VARCHAR(120) NOT NULL DEFAULT 'Crevantia',
  `siteDescription` VARCHAR(500) NOT NULL DEFAULT 'Plataforma de evaluaciones Crevantia',
  `logoData` LONGBLOB NULL, `logoMimeType` VARCHAR(100) NULL,
  `faviconData` LONGBLOB NULL, `faviconMimeType` VARCHAR(100) NULL,
  `contactEmail` VARCHAR(191) NULL, `contactPhone` VARCHAR(60) NULL,
  `contactWhatsapp` VARCHAR(60) NULL, `contactAddress` VARCHAR(500) NULL,
  `contactHours` VARCHAR(255) NULL, `contactMapUrl` TEXT NULL,
  `reportBrandName` VARCHAR(160) NULL, `reportPromoTitle` VARCHAR(255) NULL,
  `reportPromoText` LONGTEXT NULL, `reportPromoUrl` TEXT NULL,
  `reportIntroduction` LONGTEXT NULL, `reportInterpretation` LONGTEXT NULL,
  `reportCategories` JSON NULL, `reportDisplayMappings` JSON NULL, `reportTextBlocks` JSON NULL,
  `headCode` LONGTEXT NULL, `bodyEndCode` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
