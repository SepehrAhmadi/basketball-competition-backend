/*
  Warnings:

  - You are about to drop the column `phone` on the `coaches` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `referees` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `coaches` DROP COLUMN `phone`;

-- AlterTable
ALTER TABLE `referees` DROP COLUMN `phone`;
