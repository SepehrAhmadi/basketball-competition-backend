-- AlterTable
ALTER TABLE `team_season_members` ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE', 'DELETED') NOT NULL DEFAULT 'ACTIVE';
