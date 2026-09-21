/*
  Warnings:

  - Made the column `start_date` on table `seasons` required. This step will fail if there are existing NULL values in that column.
  - Made the column `end_date` on table `seasons` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `seasons` MODIFY `start_date` DATETIME(3) NOT NULL,
    MODIFY `end_date` DATETIME(3) NOT NULL;
