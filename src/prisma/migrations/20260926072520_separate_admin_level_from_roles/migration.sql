/*
  Warnings:

  - You are about to drop the column `created_at` on the `admin_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `admin_permissions` table. All the data in the column will be lost.
  - The values [SUPER_ADMIN,ADMIN,PUBLIC] on the enum `user_roles_role` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[user_admin_id,permission]` on the table `admin_permissions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_admin_id` to the `admin_permissions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `admin_permissions` DROP FOREIGN KEY `admin_permissions_user_id_fkey`;

-- DropIndex
DROP INDEX `admin_permissions_user_id_permission_key` ON `admin_permissions`;

-- CreateTable
CREATE TABLE `user_admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `level` ENUM('ADMIN', 'SUPER_ADMIN') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_admins_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill user_admins from existing user_roles (SUPER_ADMIN wins over ADMIN)
INSERT INTO `user_admins` (`user_id`, `level`)
SELECT `user_id`, IF(SUM(`role` = 'SUPER_ADMIN') > 0, 'SUPER_ADMIN', 'ADMIN')
FROM `user_roles`
WHERE `role` IN ('ADMIN', 'SUPER_ADMIN')
GROUP BY `user_id`;

-- Remove admin-level roles and PUBLIC from user_roles (no longer valid enum values)
DELETE FROM `user_roles` WHERE `role` IN ('ADMIN', 'SUPER_ADMIN', 'PUBLIC');

-- AlterTable
ALTER TABLE `user_roles` MODIFY `role` ENUM('ORG_MANAGER', 'COACH', 'PLAYER', 'REFEREE') NOT NULL;

-- Migrate admin_permissions from user_id to user_admin_id, preserving rows
ALTER TABLE `admin_permissions` ADD COLUMN `user_admin_id` INTEGER NULL;
UPDATE `admin_permissions` `ap`
  JOIN `user_admins` `ua` ON `ua`.`user_id` = `ap`.`user_id`
  SET `ap`.`user_admin_id` = `ua`.`id`;
-- Permissions belonging to users who are not admins cannot be preserved
DELETE FROM `admin_permissions` WHERE `user_admin_id` IS NULL;
ALTER TABLE `admin_permissions` MODIFY `user_admin_id` INTEGER NOT NULL;
ALTER TABLE `admin_permissions` DROP COLUMN `user_id`,
    DROP COLUMN `created_at`;

-- CreateIndex
CREATE UNIQUE INDEX `admin_permissions_user_admin_id_permission_key` ON `admin_permissions`(`user_admin_id`, `permission`);

-- AddForeignKey
ALTER TABLE `user_admins` ADD CONSTRAINT `user_admins_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_permissions` ADD CONSTRAINT `admin_permissions_user_admin_id_fkey` FOREIGN KEY (`user_admin_id`) REFERENCES `user_admins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
