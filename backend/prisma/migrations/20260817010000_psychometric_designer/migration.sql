-- Persist configurable Likert scoring and associate derived metrics with a scoring version.
CREATE TABLE `LikertScoringRule` (
    `id` VARCHAR(191) NOT NULL,
    `scoringKeyVersionId` VARCHAR(191) NOT NULL,
    `likertQuestionId` VARCHAR(191) NOT NULL,
    `scaleId` VARCHAR(191) NOT NULL,
    `weight` DECIMAL(20, 10) NOT NULL DEFAULT 1,
    `reverse` BOOLEAN NOT NULL DEFAULT false,
    `scoreMap` JSON NULL,

    UNIQUE INDEX `LikertScoringRule_scoringKeyVersionId_likertQuestionId_key`(`scoringKeyVersionId`, `likertQuestionId`),
    INDEX `LikertScoringRule_scoringKeyVersionId_scaleId_idx`(`scoringKeyVersionId`, `scaleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DerivedMetricVersion`
    ADD COLUMN `scoringKeyVersionId` VARCHAR(191) NULL,
    ADD UNIQUE INDEX `DerivedMetricVersion_scoringKeyVersionId_derivedMetricId_key`(`scoringKeyVersionId`, `derivedMetricId`);

ALTER TABLE `LikertScoringRule`
    ADD CONSTRAINT `LikertScoringRule_scoringKeyVersionId_fkey`
    FOREIGN KEY (`scoringKeyVersionId`) REFERENCES `ScoringKeyVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `LikertScoringRule_likertQuestionId_fkey`
    FOREIGN KEY (`likertQuestionId`) REFERENCES `LikertQuestion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `LikertScoringRule_scaleId_fkey`
    FOREIGN KEY (`scaleId`) REFERENCES `Scale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DerivedMetricVersion`
    ADD CONSTRAINT `DerivedMetricVersion_scoringKeyVersionId_fkey`
    FOREIGN KEY (`scoringKeyVersionId`) REFERENCES `ScoringKeyVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
