/*
  Warnings:

  - You are about to drop the column `license_level` on the `referees` table. All the data in the column will be lost.
  - Added the required column `licenseLevel` to the `referees` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `referees` DROP COLUMN `license_level`,
    ADD COLUMN `licenseLevel` ENUM('LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'NATIONAL') NOT NULL;
