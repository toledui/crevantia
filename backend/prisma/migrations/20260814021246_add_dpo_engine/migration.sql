-- AlterTable
ALTER TABLE `attempt` ADD COLUMN `assessmentVersionId` VARCHAR(191) NULL,
    ADD COLUMN `normVersionId` VARCHAR(191) NULL,
    ADD COLUMN `scoringKeyVersionId` VARCHAR(191) NULL,
    MODIFY `status` ENUM('CREATED', 'IN_PROGRESS', 'PAUSED', 'SUBMITTED', 'SCORING', 'SCORED', 'REPORT_GENERATING', 'COMPLETED', 'FAILED', 'SCORING_ERROR', 'INVALIDATED') NOT NULL DEFAULT 'CREATED';

-- AlterTable
ALTER TABLE `auditlog` ADD COLUMN `after` JSON NULL,
    ADD COLUMN `before` JSON NULL,
    ADD COLUMN `reason` VARCHAR(1000) NULL;

-- CreateTable
CREATE TABLE `Assessment` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Assessment_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssessmentVersion` (
    `id` VARCHAR(191) NOT NULL,
    `assessmentId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `versionCode` VARCHAR(100) NOT NULL,
    `language` VARCHAR(10) NOT NULL DEFAULT 'es-MX',
    `status` ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED', 'BLOCKED') NOT NULL DEFAULT 'DRAFT',
    `intro` TEXT NULL,
    `estimatedMinutes` INTEGER NULL,
    `sourceMetadata` JSON NULL,
    `configurationHash` CHAR(64) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AssessmentVersion_assessmentId_status_idx`(`assessmentId`, `status`),
    UNIQUE INDEX `AssessmentVersion_assessmentId_version_key`(`assessmentId`, `version`),
    UNIQUE INDEX `AssessmentVersion_assessmentId_versionCode_key`(`assessmentId`, `versionCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssessmentSection` (
    `id` VARCHAR(191) NOT NULL,
    `assessmentVersionId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `instructions` TEXT NULL,
    `order` INTEGER NOT NULL,

    UNIQUE INDEX `AssessmentSection_assessmentVersionId_code_key`(`assessmentVersionId`, `code`),
    UNIQUE INDEX `AssessmentSection_assessmentVersionId_order_key`(`assessmentVersionId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DemographicField` (
    `id` VARCHAR(191) NOT NULL,
    `assessmentVersionId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `fieldKey` VARCHAR(100) NOT NULL,
    `label` VARCHAR(500) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `order` INTEGER NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `config` JSON NULL,

    UNIQUE INDEX `DemographicField_assessmentVersionId_code_key`(`assessmentVersionId`, `code`),
    UNIQUE INDEX `DemographicField_assessmentVersionId_fieldKey_key`(`assessmentVersionId`, `fieldKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DemographicAnswer` (
    `id` VARCHAR(191) NOT NULL,
    `attemptId` VARCHAR(191) NOT NULL,
    `demographicFieldId` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `operationId` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DemographicAnswer_operationId_key`(`operationId`),
    INDEX `DemographicAnswer_attemptId_idx`(`attemptId`),
    UNIQUE INDEX `DemographicAnswer_attemptId_demographicFieldId_key`(`attemptId`, `demographicFieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PairQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `assessmentVersionId` VARCHAR(191) NOT NULL,
    `sectionId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `order` INTEGER NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED', 'BLOCKED') NOT NULL DEFAULT 'DRAFT',
    `sourceMetadata` JSON NULL,

    INDEX `PairQuestion_sectionId_order_idx`(`sectionId`, `order`),
    UNIQUE INDEX `PairQuestion_assessmentVersionId_code_key`(`assessmentVersionId`, `code`),
    UNIQUE INDEX `PairQuestion_assessmentVersionId_order_key`(`assessmentVersionId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reactive` (
    `id` VARCHAR(191) NOT NULL,
    `pairQuestionId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `position` INTEGER NOT NULL,
    `text` TEXT NOT NULL,

    UNIQUE INDEX `Reactive_code_key`(`code`),
    INDEX `Reactive_pairQuestionId_idx`(`pairQuestionId`),
    UNIQUE INDEX `Reactive_pairQuestionId_position_key`(`pairQuestionId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LikertOptionSet` (
    `id` VARCHAR(191) NOT NULL,
    `assessmentVersionId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `LikertOptionSet_assessmentVersionId_code_key`(`assessmentVersionId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LikertOption` (
    `id` VARCHAR(191) NOT NULL,
    `optionSetId` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL,
    `label` VARCHAR(255) NOT NULL,
    `order` INTEGER NOT NULL,

    UNIQUE INDEX `LikertOption_optionSetId_value_key`(`optionSetId`, `value`),
    UNIQUE INDEX `LikertOption_optionSetId_order_key`(`optionSetId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LikertQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `assessmentVersionId` VARCHAR(191) NOT NULL,
    `sectionId` VARCHAR(191) NOT NULL,
    `optionSetId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `order` INTEGER NOT NULL,
    `text` TEXT NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `scoringStatus` ENUM('CONFIGURED', 'PENDING_SCORING_SPEC') NOT NULL DEFAULT 'PENDING_SCORING_SPEC',
    `sourceMetadata` JSON NULL,

    INDEX `LikertQuestion_sectionId_order_idx`(`sectionId`, `order`),
    UNIQUE INDEX `LikertQuestion_assessmentVersionId_code_key`(`assessmentVersionId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScoringKey` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ScoringKey_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScoringKeyVersion` (
    `id` VARCHAR(191) NOT NULL,
    `scoringKeyId` VARCHAR(191) NOT NULL,
    `assessmentVersionId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `sourceVersion` VARCHAR(100) NULL,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED', 'BLOCKED') NOT NULL DEFAULT 'DRAFT',
    `numericMode` VARCHAR(50) NOT NULL DEFAULT 'EXCEL_BINARY64',
    `engineCompatibility` VARCHAR(100) NULL,
    `configurationHash` CHAR(64) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ScoringKeyVersion_assessmentVersionId_status_idx`(`assessmentVersionId`, `status`),
    UNIQUE INDEX `ScoringKeyVersion_scoringKeyId_version_key`(`scoringKeyId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Scale` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,

    UNIQUE INDEX `Scale_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReactiveScoringRule` (
    `id` VARCHAR(191) NOT NULL,
    `scoringKeyVersionId` VARCHAR(191) NOT NULL,
    `reactiveId` VARCHAR(191) NOT NULL,
    `scaleId` VARCHAR(191) NOT NULL,
    `polarity` ENUM('POSITIVE', 'NEGATIVE') NOT NULL,
    `fixedWeight` DECIMAL(20, 10) NOT NULL,
    `scoreIfMore` DECIMAL(20, 10) NOT NULL,
    `scoreIfLess` DECIMAL(20, 10) NOT NULL,
    `sourceMetadata` JSON NULL,

    INDEX `ReactiveScoringRule_scoringKeyVersionId_scaleId_idx`(`scoringKeyVersionId`, `scaleId`),
    INDEX `ReactiveScoringRule_reactiveId_idx`(`reactiveId`),
    UNIQUE INDEX `ReactiveScoringRule_scoringKeyVersionId_reactiveId_key`(`scoringKeyVersionId`, `reactiveId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Composite` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `aggregationMethod` ENUM('SUM', 'ARITHMETIC_MEAN', 'WEIGHTED_MEAN', 'DIRECT_SCALE', 'AXIS_X', 'AXIS_Y', 'TWO_AXIS', 'CUSTOM_DECLARATIVE') NOT NULL DEFAULT 'ARITHMETIC_MEAN',

    UNIQUE INDEX `Composite_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompositeComponent` (
    `id` VARCHAR(191) NOT NULL,
    `scoringKeyVersionId` VARCHAR(191) NOT NULL,
    `compositeId` VARCHAR(191) NOT NULL,
    `scaleId` VARCHAR(191) NOT NULL,
    `weight` DECIMAL(20, 10) NOT NULL DEFAULT 1,
    `order` INTEGER NOT NULL,
    `aggregationMethod` ENUM('SUM', 'ARITHMETIC_MEAN', 'WEIGHTED_MEAN', 'DIRECT_SCALE', 'AXIS_X', 'AXIS_Y', 'TWO_AXIS', 'CUSTOM_DECLARATIVE') NOT NULL,
    `metadata` JSON NULL,

    INDEX `CompositeComponent_scaleId_idx`(`scaleId`),
    UNIQUE INDEX `CompositeComponent_scoringKeyVersionId_compositeId_scaleId_key`(`scoringKeyVersionId`, `compositeId`, `scaleId`),
    UNIQUE INDEX `CompositeComponent_scoringKeyVersionId_compositeId_order_key`(`scoringKeyVersionId`, `compositeId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DerivedMetric` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(180) NOT NULL,

    UNIQUE INDEX `DerivedMetric_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DerivedMetricVersion` (
    `id` VARCHAR(191) NOT NULL,
    `derivedMetricId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `calculationType` ENUM('SUM', 'ARITHMETIC_MEAN', 'WEIGHTED_MEAN', 'DIRECT_SCALE', 'AXIS_X', 'AXIS_Y', 'TWO_AXIS', 'CUSTOM_DECLARATIVE') NOT NULL,
    `sourceScaleId` VARCHAR(191) NULL,
    `declarativeConfig` JSON NULL,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED', 'BLOCKED') NOT NULL DEFAULT 'DRAFT',

    UNIQUE INDEX `DerivedMetricVersion_derivedMetricId_version_key`(`derivedMetricId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NormSet` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NormSet_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NormVersion` (
    `id` VARCHAR(191) NOT NULL,
    `normSetId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `sourceVersion` VARCHAR(100) NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED', 'BLOCKED') NOT NULL DEFAULT 'DRAFT',
    `populationLabel` VARCHAR(255) NULL,
    `sampleSize` INTEGER NULL,
    `country` VARCHAR(100) NULL,
    `ageRange` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `lookupMethod` VARCHAR(80) NOT NULL DEFAULT 'LAST_LOWER_BOUND_LTE',
    `numericMode` VARCHAR(50) NOT NULL DEFAULT 'EXCEL_BINARY64',
    `roundingMode` VARCHAR(80) NOT NULL DEFAULT 'NONE_BEFORE_NORM_LOOKUP',
    `validFrom` DATETIME(3) NULL,
    `validTo` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `publishedById` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `configurationHash` CHAR(64) NOT NULL,
    `validationStatus` VARCHAR(80) NULL,
    `sourceMetadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NormVersion_normSetId_status_idx`(`normSetId`, `status`),
    UNIQUE INDEX `NormVersion_normSetId_version_key`(`normSetId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NormTarget` (
    `id` VARCHAR(191) NOT NULL,
    `normVersionId` VARCHAR(191) NOT NULL,
    `targetType` ENUM('SCALE', 'COMPOSITE', 'DERIVED_METRIC', 'LEGACY_STYLE_PROFILE') NOT NULL,
    `targetCode` VARCHAR(100) NOT NULL,
    `sourceCode` VARCHAR(100) NULL,
    `name` VARCHAR(180) NOT NULL,
    `status` VARCHAR(80) NOT NULL,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `validationNotes` TEXT NULL,
    `sourceReference` VARCHAR(255) NULL,

    INDEX `NormTarget_normVersionId_status_idx`(`normVersionId`, `status`),
    UNIQUE INDEX `NormTarget_normVersionId_targetType_targetCode_key`(`normVersionId`, `targetType`, `targetCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NormThreshold` (
    `id` VARCHAR(191) NOT NULL,
    `normTargetId` VARCHAR(191) NOT NULL,
    `decile` INTEGER NOT NULL,
    `lowerBound` DECIMAL(30, 17) NOT NULL,
    `ordinal` INTEGER NOT NULL,
    `sourceMetadata` JSON NULL,

    INDEX `NormThreshold_normTargetId_lowerBound_idx`(`normTargetId`, `lowerBound`),
    UNIQUE INDEX `NormThreshold_normTargetId_ordinal_key`(`normTargetId`, `ordinal`),
    UNIQUE INDEX `NormThreshold_normTargetId_decile_key`(`normTargetId`, `decile`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NormValidationRun` (
    `id` VARCHAR(191) NOT NULL,
    `normVersionId` VARCHAR(191) NOT NULL,
    `hasErrors` BOOLEAN NOT NULL,
    `errorCount` INTEGER NOT NULL,
    `warningCount` INTEGER NOT NULL,
    `infoCount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NormValidationRun_normVersionId_createdAt_idx`(`normVersionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NormValidationIssue` (
    `id` VARCHAR(191) NOT NULL,
    `validationRunId` VARCHAR(191) NOT NULL,
    `normTargetId` VARCHAR(191) NULL,
    `severity` ENUM('ERROR', 'WARNING', 'INFO') NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `message` VARCHAR(1000) NOT NULL,
    `metadata` JSON NULL,

    INDEX `NormValidationIssue_validationRunId_severity_idx`(`validationRunId`, `severity`),
    INDEX `NormValidationIssue_normTargetId_idx`(`normTargetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportMapping` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(180) NOT NULL,

    UNIQUE INDEX `ReportMapping_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportMappingVersion` (
    `id` VARCHAR(191) NOT NULL,
    `reportMappingId` VARCHAR(191) NOT NULL,
    `assessmentVersionId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED', 'BLOCKED') NOT NULL DEFAULT 'DRAFT',
    `mappingStatus` VARCHAR(80) NOT NULL DEFAULT 'PENDING_CLIENT_CONFIRMATION',
    `configuration` JSON NULL,
    `configurationHash` CHAR(64) NULL,

    UNIQUE INDEX `ReportMappingVersion_reportMappingId_version_key`(`reportMappingId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ForcedChoiceAnswer` (
    `id` VARCHAR(191) NOT NULL,
    `attemptId` VARCHAR(191) NOT NULL,
    `pairQuestionId` VARCHAR(191) NOT NULL,
    `selectedMoreReactiveId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `operationId` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ForcedChoiceAnswer_operationId_key`(`operationId`),
    INDEX `ForcedChoiceAnswer_attemptId_idx`(`attemptId`),
    INDEX `ForcedChoiceAnswer_selectedMoreReactiveId_idx`(`selectedMoreReactiveId`),
    UNIQUE INDEX `ForcedChoiceAnswer_attemptId_pairQuestionId_key`(`attemptId`, `pairQuestionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LikertAnswer` (
    `id` VARCHAR(191) NOT NULL,
    `attemptId` VARCHAR(191) NOT NULL,
    `likertQuestionId` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `operationId` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LikertAnswer_operationId_key`(`operationId`),
    INDEX `LikertAnswer_attemptId_idx`(`attemptId`),
    UNIQUE INDEX `LikertAnswer_attemptId_likertQuestionId_key`(`attemptId`, `likertQuestionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResultRun` (
    `id` VARCHAR(191) NOT NULL,
    `attemptId` VARCHAR(191) NOT NULL,
    `assessmentVersionId` VARCHAR(191) NOT NULL,
    `scoringKeyVersionId` VARCHAR(191) NOT NULL,
    `normVersionId` VARCHAR(191) NOT NULL,
    `reportMappingVersionId` VARCHAR(191) NULL,
    `engineVersion` VARCHAR(50) NOT NULL,
    `configurationHash` CHAR(64) NOT NULL,
    `inputHash` CHAR(64) NULL,
    `status` ENUM('CALCULATING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'CALCULATING',
    `isOfficial` BOOLEAN NOT NULL DEFAULT true,
    `recalculationOfResultRunId` VARCHAR(191) NULL,
    `reason` VARCHAR(1000) NULL,
    `requestedById` VARCHAR(191) NULL,
    `diagnostics` JSON NULL,
    `calculatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ResultRun_attemptId_calculatedAt_idx`(`attemptId`, `calculatedAt`),
    INDEX `ResultRun_normVersionId_idx`(`normVersionId`),
    INDEX `ResultRun_recalculationOfResultRunId_idx`(`recalculationOfResultRunId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResultValue` (
    `id` VARCHAR(191) NOT NULL,
    `resultRunId` VARCHAR(191) NOT NULL,
    `targetType` ENUM('SCALE', 'COMPOSITE', 'DERIVED_METRIC', 'LEGACY_STYLE_PROFILE') NOT NULL,
    `targetCode` VARCHAR(100) NOT NULL,
    `rawScore` DECIMAL(30, 17) NOT NULL,
    `displayScore` DECIMAL(30, 8) NULL,
    `normalizedScore` DECIMAL(30, 17) NULL,
    `decile` INTEGER NULL,
    `status` VARCHAR(80) NOT NULL,
    `metadata` JSON NULL,

    INDEX `ResultValue_resultRunId_idx`(`resultRunId`),
    UNIQUE INDEX `ResultValue_resultRunId_targetType_targetCode_key`(`resultRunId`, `targetType`, `targetCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReactiveContribution` (
    `id` VARCHAR(191) NOT NULL,
    `resultRunId` VARCHAR(191) NOT NULL,
    `reactiveId` VARCHAR(191) NOT NULL,
    `selection` ENUM('MORE', 'LESS') NOT NULL,
    `scoreIfMore` DECIMAL(20, 10) NOT NULL,
    `scoreIfLess` DECIMAL(20, 10) NOT NULL,
    `appliedScore` DECIMAL(20, 10) NOT NULL,
    `scaleId` VARCHAR(191) NOT NULL,

    INDEX `ReactiveContribution_resultRunId_scaleId_idx`(`resultRunId`, `scaleId`),
    INDEX `ReactiveContribution_reactiveId_idx`(`reactiveId`),
    UNIQUE INDEX `ReactiveContribution_resultRunId_reactiveId_key`(`resultRunId`, `reactiveId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Attempt_assessmentVersionId_idx` ON `Attempt`(`assessmentVersionId`);

-- CreateIndex
CREATE INDEX `Attempt_scoringKeyVersionId_idx` ON `Attempt`(`scoringKeyVersionId`);

-- CreateIndex
CREATE INDEX `Attempt_normVersionId_idx` ON `Attempt`(`normVersionId`);

-- AddForeignKey
ALTER TABLE `Attempt` ADD CONSTRAINT `Attempt_assessmentVersionId_fkey` FOREIGN KEY (`assessmentVersionId`) REFERENCES `AssessmentVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attempt` ADD CONSTRAINT `Attempt_scoringKeyVersionId_fkey` FOREIGN KEY (`scoringKeyVersionId`) REFERENCES `ScoringKeyVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attempt` ADD CONSTRAINT `Attempt_normVersionId_fkey` FOREIGN KEY (`normVersionId`) REFERENCES `NormVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssessmentVersion` ADD CONSTRAINT `AssessmentVersion_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssessmentSection` ADD CONSTRAINT `AssessmentSection_assessmentVersionId_fkey` FOREIGN KEY (`assessmentVersionId`) REFERENCES `AssessmentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DemographicField` ADD CONSTRAINT `DemographicField_assessmentVersionId_fkey` FOREIGN KEY (`assessmentVersionId`) REFERENCES `AssessmentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DemographicAnswer` ADD CONSTRAINT `DemographicAnswer_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `Attempt`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DemographicAnswer` ADD CONSTRAINT `DemographicAnswer_demographicFieldId_fkey` FOREIGN KEY (`demographicFieldId`) REFERENCES `DemographicField`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PairQuestion` ADD CONSTRAINT `PairQuestion_assessmentVersionId_fkey` FOREIGN KEY (`assessmentVersionId`) REFERENCES `AssessmentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PairQuestion` ADD CONSTRAINT `PairQuestion_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `AssessmentSection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reactive` ADD CONSTRAINT `Reactive_pairQuestionId_fkey` FOREIGN KEY (`pairQuestionId`) REFERENCES `PairQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LikertOptionSet` ADD CONSTRAINT `LikertOptionSet_assessmentVersionId_fkey` FOREIGN KEY (`assessmentVersionId`) REFERENCES `AssessmentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LikertOption` ADD CONSTRAINT `LikertOption_optionSetId_fkey` FOREIGN KEY (`optionSetId`) REFERENCES `LikertOptionSet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LikertQuestion` ADD CONSTRAINT `LikertQuestion_assessmentVersionId_fkey` FOREIGN KEY (`assessmentVersionId`) REFERENCES `AssessmentVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LikertQuestion` ADD CONSTRAINT `LikertQuestion_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `AssessmentSection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LikertQuestion` ADD CONSTRAINT `LikertQuestion_optionSetId_fkey` FOREIGN KEY (`optionSetId`) REFERENCES `LikertOptionSet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScoringKeyVersion` ADD CONSTRAINT `ScoringKeyVersion_scoringKeyId_fkey` FOREIGN KEY (`scoringKeyId`) REFERENCES `ScoringKey`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScoringKeyVersion` ADD CONSTRAINT `ScoringKeyVersion_assessmentVersionId_fkey` FOREIGN KEY (`assessmentVersionId`) REFERENCES `AssessmentVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReactiveScoringRule` ADD CONSTRAINT `ReactiveScoringRule_scoringKeyVersionId_fkey` FOREIGN KEY (`scoringKeyVersionId`) REFERENCES `ScoringKeyVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReactiveScoringRule` ADD CONSTRAINT `ReactiveScoringRule_reactiveId_fkey` FOREIGN KEY (`reactiveId`) REFERENCES `Reactive`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReactiveScoringRule` ADD CONSTRAINT `ReactiveScoringRule_scaleId_fkey` FOREIGN KEY (`scaleId`) REFERENCES `Scale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompositeComponent` ADD CONSTRAINT `CompositeComponent_scoringKeyVersionId_fkey` FOREIGN KEY (`scoringKeyVersionId`) REFERENCES `ScoringKeyVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompositeComponent` ADD CONSTRAINT `CompositeComponent_compositeId_fkey` FOREIGN KEY (`compositeId`) REFERENCES `Composite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompositeComponent` ADD CONSTRAINT `CompositeComponent_scaleId_fkey` FOREIGN KEY (`scaleId`) REFERENCES `Scale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DerivedMetricVersion` ADD CONSTRAINT `DerivedMetricVersion_derivedMetricId_fkey` FOREIGN KEY (`derivedMetricId`) REFERENCES `DerivedMetric`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DerivedMetricVersion` ADD CONSTRAINT `DerivedMetricVersion_sourceScaleId_fkey` FOREIGN KEY (`sourceScaleId`) REFERENCES `Scale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NormVersion` ADD CONSTRAINT `NormVersion_normSetId_fkey` FOREIGN KEY (`normSetId`) REFERENCES `NormSet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NormVersion` ADD CONSTRAINT `NormVersion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NormVersion` ADD CONSTRAINT `NormVersion_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NormVersion` ADD CONSTRAINT `NormVersion_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NormVersion` ADD CONSTRAINT `NormVersion_publishedById_fkey` FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NormTarget` ADD CONSTRAINT `NormTarget_normVersionId_fkey` FOREIGN KEY (`normVersionId`) REFERENCES `NormVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NormThreshold` ADD CONSTRAINT `NormThreshold_normTargetId_fkey` FOREIGN KEY (`normTargetId`) REFERENCES `NormTarget`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NormValidationRun` ADD CONSTRAINT `NormValidationRun_normVersionId_fkey` FOREIGN KEY (`normVersionId`) REFERENCES `NormVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NormValidationIssue` ADD CONSTRAINT `NormValidationIssue_validationRunId_fkey` FOREIGN KEY (`validationRunId`) REFERENCES `NormValidationRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NormValidationIssue` ADD CONSTRAINT `NormValidationIssue_normTargetId_fkey` FOREIGN KEY (`normTargetId`) REFERENCES `NormTarget`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportMappingVersion` ADD CONSTRAINT `ReportMappingVersion_reportMappingId_fkey` FOREIGN KEY (`reportMappingId`) REFERENCES `ReportMapping`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportMappingVersion` ADD CONSTRAINT `ReportMappingVersion_assessmentVersionId_fkey` FOREIGN KEY (`assessmentVersionId`) REFERENCES `AssessmentVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ForcedChoiceAnswer` ADD CONSTRAINT `ForcedChoiceAnswer_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `Attempt`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ForcedChoiceAnswer` ADD CONSTRAINT `ForcedChoiceAnswer_pairQuestionId_fkey` FOREIGN KEY (`pairQuestionId`) REFERENCES `PairQuestion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ForcedChoiceAnswer` ADD CONSTRAINT `ForcedChoiceAnswer_selectedMoreReactiveId_fkey` FOREIGN KEY (`selectedMoreReactiveId`) REFERENCES `Reactive`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LikertAnswer` ADD CONSTRAINT `LikertAnswer_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `Attempt`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LikertAnswer` ADD CONSTRAINT `LikertAnswer_likertQuestionId_fkey` FOREIGN KEY (`likertQuestionId`) REFERENCES `LikertQuestion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultRun` ADD CONSTRAINT `ResultRun_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `Attempt`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultRun` ADD CONSTRAINT `ResultRun_assessmentVersionId_fkey` FOREIGN KEY (`assessmentVersionId`) REFERENCES `AssessmentVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultRun` ADD CONSTRAINT `ResultRun_scoringKeyVersionId_fkey` FOREIGN KEY (`scoringKeyVersionId`) REFERENCES `ScoringKeyVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultRun` ADD CONSTRAINT `ResultRun_normVersionId_fkey` FOREIGN KEY (`normVersionId`) REFERENCES `NormVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultRun` ADD CONSTRAINT `ResultRun_reportMappingVersionId_fkey` FOREIGN KEY (`reportMappingVersionId`) REFERENCES `ReportMappingVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultRun` ADD CONSTRAINT `ResultRun_recalculationOfResultRunId_fkey` FOREIGN KEY (`recalculationOfResultRunId`) REFERENCES `ResultRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultRun` ADD CONSTRAINT `ResultRun_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultValue` ADD CONSTRAINT `ResultValue_resultRunId_fkey` FOREIGN KEY (`resultRunId`) REFERENCES `ResultRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReactiveContribution` ADD CONSTRAINT `ReactiveContribution_resultRunId_fkey` FOREIGN KEY (`resultRunId`) REFERENCES `ResultRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReactiveContribution` ADD CONSTRAINT `ReactiveContribution_reactiveId_fkey` FOREIGN KEY (`reactiveId`) REFERENCES `Reactive`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
