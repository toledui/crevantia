ALTER TABLE `SiteSettings`
  ADD COLUMN `reportDefaultsVersion` INTEGER NOT NULL DEFAULT 0 AFTER `version`;
