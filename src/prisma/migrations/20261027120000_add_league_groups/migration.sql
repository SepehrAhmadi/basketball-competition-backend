CREATE TABLE `league_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `league_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `qualifiers_override` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `league_groups_league_id_name_key`(`league_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `league_group_teams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `group_id` INTEGER NOT NULL,
    `league_team_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `league_group_teams_league_team_id_key`(`league_team_id`),
    INDEX `league_group_teams_group_id_idx`(`group_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `league_groups` ADD CONSTRAINT `league_groups_league_id_fkey` FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `league_group_teams` ADD CONSTRAINT `league_group_teams_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `league_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `league_group_teams` ADD CONSTRAINT `league_group_teams_league_team_id_fkey` FOREIGN KEY (`league_team_id`) REFERENCES `league_teams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
