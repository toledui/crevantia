-- CreateTable
CREATE TABLE `MailSettings` (
    `id` VARCHAR(20) NOT NULL DEFAULT 'smtp',
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `host` VARCHAR(255) NOT NULL,
    `port` INTEGER NOT NULL DEFAULT 587,
    `secure` BOOLEAN NOT NULL DEFAULT false,
    `username` VARCHAR(191) NULL,
    `passwordEncrypted` TEXT NULL,
    `fromName` VARCHAR(100) NOT NULL DEFAULT 'Crevantia',
    `fromAddress` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
