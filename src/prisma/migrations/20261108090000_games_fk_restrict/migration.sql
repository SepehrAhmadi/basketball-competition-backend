-- DropForeignKey
ALTER TABLE `games` DROP FOREIGN KEY `games_group_id_fkey`;
ALTER TABLE `games` DROP FOREIGN KEY `games_forfeit_league_team_id_fkey`;

-- AddForeignKey
ALTER TABLE `games` ADD CONSTRAINT `games_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `league_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `games` ADD CONSTRAINT `games_forfeit_league_team_id_fkey` FOREIGN KEY (`forfeit_league_team_id`) REFERENCES `league_teams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
