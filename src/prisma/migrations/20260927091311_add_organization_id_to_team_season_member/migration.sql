-- Add column as nullable so existing rows survive, backfill from teams, then enforce NOT NULL.
ALTER TABLE `team_season_members` ADD COLUMN `organization_id` INTEGER NULL;

UPDATE `team_season_members` m
INNER JOIN `teams` t ON t.`id` = m.`team_id`
SET m.`organization_id` = t.`organization_id`;

ALTER TABLE `team_season_members` MODIFY COLUMN `organization_id` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `team_season_members_organization_id_user_id_idx` ON `team_season_members`(`organization_id`, `user_id`);

-- AddForeignKey
ALTER TABLE `team_season_members` ADD CONSTRAINT `team_season_members_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
