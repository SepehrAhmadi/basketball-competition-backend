-- CreateTable
CREATE TABLE `leagues` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `age_category_cutoff_id` INTEGER NOT NULL,
    `status` ENUM('INACTIVE', 'REGISTRATION', 'ACTIVE', 'FINISHED') NOT NULL DEFAULT 'INACTIVE',
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `roster_deadline` DATE NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leagues_age_category_cutoff_id_name_key`(`age_category_cutoff_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `league_teams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `league_id` INTEGER NOT NULL,
    `team_id` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `league_teams_league_id_team_id_key`(`league_id`, `team_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `league_team_members` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `league_team_id` INTEGER NOT NULL,
    `team_season_member_id` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `league_team_members_team_season_member_id_idx`(`team_season_member_id`),
    UNIQUE INDEX `league_team_members_league_team_id_team_season_member_id_key`(`league_team_id`, `team_season_member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `leagues` ADD CONSTRAINT `leagues_age_category_cutoff_id_fkey` FOREIGN KEY (`age_category_cutoff_id`) REFERENCES `age_category_cutoffs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `league_teams` ADD CONSTRAINT `league_teams_league_id_fkey` FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `league_teams` ADD CONSTRAINT `league_teams_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `league_team_members` ADD CONSTRAINT `league_team_members_league_team_id_fkey` FOREIGN KEY (`league_team_id`) REFERENCES `league_teams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `league_team_members` ADD CONSTRAINT `league_team_members_team_season_member_id_fkey` FOREIGN KEY (`team_season_member_id`) REFERENCES `team_season_members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
