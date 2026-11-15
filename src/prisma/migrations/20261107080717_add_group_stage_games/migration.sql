-- CreateTable
CREATE TABLE `games` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `league_id` INTEGER NOT NULL,
    `group_id` INTEGER NULL,
    `home_league_team_id` INTEGER NOT NULL,
    `away_league_team_id` INTEGER NOT NULL,
    `status` ENUM('SCHEDULED', 'LIVE', 'FINISHED', 'CANCELED') NOT NULL DEFAULT 'SCHEDULED',
    `scheduled_date` DATE NULL,
    `scheduled_time` VARCHAR(5) NULL,
    `home_score` INTEGER NULL,
    `away_score` INTEGER NULL,
    `result_type` ENUM('NORMAL', 'FORFEIT') NULL,
    `forfeit_league_team_id` INTEGER NULL,
    `result_note` TEXT NULL,
    `cancel_reason` TEXT NULL,
    `rescheduled_from_game_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `games_rescheduled_from_game_id_key`(`rescheduled_from_game_id`),
    INDEX `games_league_id_idx`(`league_id`),
    INDEX `games_group_id_idx`(`group_id`),
    INDEX `games_home_league_team_id_idx`(`home_league_team_id`),
    INDEX `games_away_league_team_id_idx`(`away_league_team_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `games` ADD CONSTRAINT `games_league_id_fkey` FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `games` ADD CONSTRAINT `games_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `league_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `games` ADD CONSTRAINT `games_home_league_team_id_fkey` FOREIGN KEY (`home_league_team_id`) REFERENCES `league_teams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `games` ADD CONSTRAINT `games_away_league_team_id_fkey` FOREIGN KEY (`away_league_team_id`) REFERENCES `league_teams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `games` ADD CONSTRAINT `games_forfeit_league_team_id_fkey` FOREIGN KEY (`forfeit_league_team_id`) REFERENCES `league_teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `games` ADD CONSTRAINT `games_rescheduled_from_game_id_fkey` FOREIGN KEY (`rescheduled_from_game_id`) REFERENCES `games`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
