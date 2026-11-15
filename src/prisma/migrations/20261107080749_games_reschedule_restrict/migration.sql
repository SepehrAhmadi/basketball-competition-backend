-- DropForeignKey
ALTER TABLE `games` DROP FOREIGN KEY `games_rescheduled_from_game_id_fkey`;

-- AddForeignKey
ALTER TABLE `games` ADD CONSTRAINT `games_rescheduled_from_game_id_fkey` FOREIGN KEY (`rescheduled_from_game_id`) REFERENCES `games`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
