import prisma from "../../../config/db.config.ts";
import {
  OrganizationStatus,
  Role,
  TeamStatus,
  TeamMemberRole,
} from "../../../prisma/generated/prisma/enums.ts";

const ORGANIZATION_STATUS_LABELS_FA: Record<OrganizationStatus, string> = {
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  DELETED: "حذف‌شده",
};

const TEAM_STATUS_LABELS_FA: Record<TeamStatus, string> = {
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  DELETED: "حذف‌شده",
};

const TEAM_MEMBER_ROLE_LABELS_FA: Record<TeamMemberRole, string> = {
  COACH: "مربی",
  PLAYER: "بازیکن",
};

function getOrganizationStatuses() {
  return (Object.values(OrganizationStatus) as OrganizationStatus[]).map((value) => ({
    value,
    label: ORGANIZATION_STATUS_LABELS_FA[value],
  }));
}

function getTeamStatuses() {
  return (Object.values(TeamStatus) as TeamStatus[]).map((value) => ({
    value,
    label: TEAM_STATUS_LABELS_FA[value],
  }));
}

function getTeamMemberRoles() {
  return (Object.values(TeamMemberRole) as TeamMemberRole[]).map((value) => ({
    value,
    label: TEAM_MEMBER_ROLE_LABELS_FA[value],
  }));
}

interface SearchQuery {
  search?: string;
  organizationId?: number;
  role?: Role;
  page: number;
  pageSize: number;
}

async function getOrganizationsDropdown(query: SearchQuery) {
  const where: any = { status: { not: "DELETED" } };
  if (query.search?.trim()) {
    where.name = { contains: query.search.trim() };
  }
  const [items, total] = await prisma.$transaction([
    prisma.organization.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: { id: true, name: true, status: true },
    }),
    prisma.organization.count({ where }),
  ]);
  return {
    items: items.map((o) => ({ value: o.id, label: o.name, status: o.status })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getTeamsDropdown(query: SearchQuery) {
  const where: any = { status: { not: "DELETED" } };
  if (query.organizationId) where.organizationId = query.organizationId;
  if (query.search?.trim()) {
    where.name = { contains: query.search.trim() };
  }
  const [items, total] = await prisma.$transaction([
    prisma.team.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: { id: true, name: true, organizationId: true },
    }),
    prisma.team.count({ where }),
  ]);
  return {
    items: items.map((t) => ({ value: t.id, label: t.name, organizationId: t.organizationId })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getSeasonsDropdown(query: SearchQuery) {
  const where: any = {};
  if (query.search?.trim()) {
    where.name = { contains: query.search.trim() };
  }
  const [items, total] = await prisma.$transaction([
    prisma.season.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: { id: true, name: true, isActive: true },
    }),
    prisma.season.count({ where }),
  ]);
  return {
    items: items.map((s) => ({ value: s.id, label: s.name, isActive: s.isActive })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

// Users eligible as organization managers: ACTIVE + ORG_MANAGER role.
async function getManagerCandidates(query: SearchQuery) {
  const where: any = {
    status: "ACTIVE",
    roles: { some: { role: "ORG_MANAGER" } },
  };
  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [{ fullName: { contains: search } }, { phone: { contains: search } }];
  }
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: { id: true, fullName: true, phone: true },
    }),
    prisma.user.count({ where }),
  ]);
  return {
    items: items.map((u) => ({ value: u.id, label: `${u.fullName} (${u.phone})` })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

// General user options: ACTIVE users, optionally filtered by domain role.
// Omit role to return users with any role.
async function getUsersDropdown(query: SearchQuery) {
  const where: any = { status: "ACTIVE" };
  if (query.role) {
    where.roles = { some: { role: query.role } };
  }
  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [{ fullName: { contains: search } }, { phone: { contains: search } }];
  }
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: { id: true, fullName: true, phone: true, roles: { select: { role: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return {
    items: items.map((u) => ({
      value: u.id,
      label: `${u.fullName} (${u.phone})`,
      roles: u.roles.map((r) => r.role),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getAgeCategoriesDropdown(query: SearchQuery) {
  const where: any = {};
  if (query.search?.trim()) {
    where.name = { contains: query.search.trim() };
  }
  const [items, total] = await prisma.$transaction([
    prisma.ageCategory.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: { id: true, name: true },
    }),
    prisma.ageCategory.count({ where }),
  ]);
  return {
    items: items.map((c) => ({ value: c.id, label: c.name })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export default {
  getOrganizationStatuses,
  getTeamStatuses,
  getTeamMemberRoles,
  getOrganizationsDropdown,
  getTeamsDropdown,
  getSeasonsDropdown,
  getManagerCandidates,
  getUsersDropdown,
  getAgeCategoriesDropdown,
};
