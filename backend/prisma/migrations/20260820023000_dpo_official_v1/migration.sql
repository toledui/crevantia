ALTER TABLE `Scale`
    ADD COLUMN `kind` VARCHAR(40) NOT NULL DEFAULT 'PAIRED';

ALTER TABLE `Composite`
    MODIFY COLUMN `aggregationMethod` ENUM(
        'SUM',
        'ARITHMETIC_MEAN',
        'WEIGHTED_MEAN',
        'DIRECT_SCALE',
        'DECILE_MEAN',
        'DIRECT_ALIAS',
        'AXIS_X',
        'AXIS_Y',
        'TWO_AXIS',
        'CUSTOM_DECLARATIVE'
    ) NOT NULL DEFAULT 'ARITHMETIC_MEAN';

ALTER TABLE `CompositeComponent`
    MODIFY COLUMN `aggregationMethod` ENUM(
        'SUM',
        'ARITHMETIC_MEAN',
        'WEIGHTED_MEAN',
        'DIRECT_SCALE',
        'DECILE_MEAN',
        'DIRECT_ALIAS',
        'AXIS_X',
        'AXIS_Y',
        'TWO_AXIS',
        'CUSTOM_DECLARATIVE'
    ) NOT NULL;

ALTER TABLE `DerivedMetricVersion`
    MODIFY COLUMN `calculationType` ENUM(
        'SUM',
        'ARITHMETIC_MEAN',
        'WEIGHTED_MEAN',
        'DIRECT_SCALE',
        'DECILE_MEAN',
        'DIRECT_ALIAS',
        'AXIS_X',
        'AXIS_Y',
        'TWO_AXIS',
        'CUSTOM_DECLARATIVE'
    ) NOT NULL;

ALTER TABLE `NormTarget`
    MODIFY COLUMN `targetType` ENUM(
        'SCALE',
        'COMPOSITE',
        'DERIVED_METRIC',
        'LIKERT_DIMENSION',
        'LIKERT_TOTAL',
        'REPORT_ALIAS',
        'LEGACY_STYLE_PROFILE'
    ) NOT NULL;

ALTER TABLE `ResultValue`
    MODIFY COLUMN `targetType` ENUM(
        'SCALE',
        'COMPOSITE',
        'DERIVED_METRIC',
        'LIKERT_DIMENSION',
        'LIKERT_TOTAL',
        'REPORT_ALIAS',
        'LEGACY_STYLE_PROFILE'
    ) NOT NULL;

CREATE TABLE `AssessmentActiveConfiguration` (
    `id` VARCHAR(191) NOT NULL,
    `assessmentId` VARCHAR(191) NOT NULL,
    `assessmentVersionId` VARCHAR(191) NOT NULL,
    `scoringKeyVersionId` VARCHAR(191) NOT NULL,
    `normVersionId` VARCHAR(191) NOT NULL,
    `reportMappingVersionId` VARCHAR(191) NULL,
    `activatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `AssessmentActiveConfiguration_assessmentId_key`(`assessmentId`),
    UNIQUE INDEX `AssessmentActiveConfiguration_assessmentVersionId_key`(`assessmentVersionId`),
    UNIQUE INDEX `AssessmentActiveConfiguration_scoringKeyVersionId_key`(`scoringKeyVersionId`),
    UNIQUE INDEX `AssessmentActiveConfiguration_normVersionId_key`(`normVersionId`),
    INDEX `AssessmentActiveConfiguration_reportMappingVersionId_idx`(`reportMappingVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AssessmentActiveConfiguration`
    ADD CONSTRAINT `AssessmentActiveConfiguration_assessmentId_fkey`
    FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `AssessmentActiveConfiguration_assessmentVersionId_fkey`
    FOREIGN KEY (`assessmentVersionId`) REFERENCES `AssessmentVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `AssessmentActiveConfiguration_scoringKeyVersionId_fkey`
    FOREIGN KEY (`scoringKeyVersionId`) REFERENCES `ScoringKeyVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `AssessmentActiveConfiguration_normVersionId_fkey`
    FOREIGN KEY (`normVersionId`) REFERENCES `NormVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `AssessmentActiveConfiguration_reportMappingVersionId_fkey`
    FOREIGN KEY (`reportMappingVersionId`) REFERENCES `ReportMappingVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
