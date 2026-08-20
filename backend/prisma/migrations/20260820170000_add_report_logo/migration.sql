ALTER TABLE `SiteSettings`
  ADD COLUMN `reportLogoData` LONGBLOB NULL AFTER `faviconMimeType`,
  ADD COLUMN `reportLogoMimeType` VARCHAR(100) NULL AFTER `reportLogoData`;
