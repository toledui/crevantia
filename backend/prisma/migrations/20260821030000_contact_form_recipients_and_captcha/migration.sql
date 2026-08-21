ALTER TABLE `SiteSettings`
  ADD COLUMN `contactFormRecipientEmails` JSON NULL,
  ADD COLUMN `contactCaptchaProvider` VARCHAR(20) NULL,
  ADD COLUMN `contactCaptchaSiteKey` VARCHAR(255) NULL,
  ADD COLUMN `contactCaptchaSecretEncrypted` LONGTEXT NULL;

UPDATE `SiteSettings`
SET `contactFormRecipientEmails` = JSON_ARRAY(`contactFormRecipientEmail`)
WHERE `contactFormRecipientEmail` IS NOT NULL AND TRIM(`contactFormRecipientEmail`) <> '';
