-- ORG_MANAGER is no longer a role: management is the organization_managers relation.
-- Delete the role rows first, otherwise shrinking the enum fails or corrupts data.
-- organization_managers is NOT touched, so no manager loses an organization.
DELETE FROM `user_roles` WHERE `role` = 'ORG_MANAGER';

-- AlterTable
ALTER TABLE `user_roles` MODIFY `role` ENUM('COACH', 'PLAYER', 'REFEREE') NOT NULL;
