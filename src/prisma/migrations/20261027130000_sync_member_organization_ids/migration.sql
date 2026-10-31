-- Data fix: team_season_members.organization_id must equal the team's organization.
UPDATE `team_season_members` m
INNER JOIN `teams` t ON t.`id` = m.`team_id`
SET m.`organization_id` = t.`organization_id`
WHERE m.`organization_id` <> t.`organization_id`;
