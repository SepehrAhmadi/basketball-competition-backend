-- CreateTable
CREATE TABLE `age_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `age_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `age_category_cutoffs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `age_category_id` INTEGER NOT NULL,
    `season_id` INTEGER NOT NULL,
    `min_birth_date` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `age_category_cutoffs_season_id_idx`(`season_id`),
    UNIQUE INDEX `age_category_cutoffs_age_category_id_season_id_key`(`age_category_id`, `season_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `age_category_cutoffs` ADD CONSTRAINT `age_category_cutoffs_age_category_id_fkey` FOREIGN KEY (`age_category_id`) REFERENCES `age_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `age_category_cutoffs` ADD CONSTRAINT `age_category_cutoffs_season_id_fkey` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
