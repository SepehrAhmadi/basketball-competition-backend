-- AlterTable: Rename founded_year (Int) to founded_date (Date)
-- Data was migrated via manual SQL execution before this migration file was created.
ALTER TABLE `teams` DROP COLUMN `founded_year`;
ALTER TABLE `teams` ADD COLUMN `founded_date` DATE NULL;
