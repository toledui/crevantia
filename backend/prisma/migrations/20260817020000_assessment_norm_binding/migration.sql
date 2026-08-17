ALTER TABLE `AssessmentVersion`
    ADD COLUMN `defaultNormSetId` VARCHAR(191) NULL,
    ADD INDEX `AssessmentVersion_defaultNormSetId_idx`(`defaultNormSetId`);

ALTER TABLE `AssessmentVersion`
    ADD CONSTRAINT `AssessmentVersion_defaultNormSetId_fkey`
    FOREIGN KEY (`defaultNormSetId`) REFERENCES `NormSet`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
