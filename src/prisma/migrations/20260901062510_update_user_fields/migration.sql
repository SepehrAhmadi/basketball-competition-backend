/*
  Warnings:

  - You are about to drop the column `first_name` on the `coaches` table. All the data in the column will be lost.
  - You are about to drop the column `last_name` on the `coaches` table. All the data in the column will be lost.
  - You are about to drop the column `national_id` on the `coaches` table. All the data in the column will be lost.
  - You are about to drop the column `birth_date` on the `players` table. All the data in the column will be lost.
  - You are about to drop the column `first_name` on the `players` table. All the data in the column will be lost.
  - You are about to drop the column `last_name` on the `players` table. All the data in the column will be lost.
  - You are about to drop the column `national_id` on the `players` table. All the data in the column will be lost.
  - You are about to drop the column `first_name` on the `referees` table. All the data in the column will be lost.
  - You are about to drop the column `last_name` on the `referees` table. All the data in the column will be lost.
  - You are about to drop the column `national_id` on the `referees` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[national_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `coaches_national_id_key` ON `coaches`;

-- DropIndex
DROP INDEX `players_national_id_key` ON `players`;

-- DropIndex
DROP INDEX `referees_national_id_key` ON `referees`;

-- AlterTable
ALTER TABLE `coaches` DROP COLUMN `first_name`,
    DROP COLUMN `last_name`,
    DROP COLUMN `national_id`;

-- AlterTable
ALTER TABLE `players` DROP COLUMN `birth_date`,
    DROP COLUMN `first_name`,
    DROP COLUMN `last_name`,
    DROP COLUMN `national_id`;

-- AlterTable
ALTER TABLE `referees` DROP COLUMN `first_name`,
    DROP COLUMN `last_name`,
    DROP COLUMN `national_id`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `birth_date` DATETIME(3) NULL,
    ADD COLUMN `national_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_national_id_key` ON `users`(`national_id`);
