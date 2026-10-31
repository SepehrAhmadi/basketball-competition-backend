// Catalog of fine-grained admin permissions. This is "what operations exist
// in the code" — a constant, not a DB table, same reasoning as the Role enum.
// The grouped shape (with Persian titles/labels) is the single source of truth;
// the flat code list and the Permission type are both derived from it below.
export const PERMISSION_CATALOG = [
  {
    title: "کاربران",
    permissions: [
      { code: "users.view", label: "مشاهده کاربران" },
      { code: "users.create", label: "ایجاد کاربر" },
      { code: "users.update", label: "ویرایش کاربر" },
      { code: "users.delete", label: "حذف کاربر" },
      { code: "users.reset_password", label: "بازنشانی رمز عبور" }, 
    ],
  },
  {
    title: "سازمان‌ها",
    permissions: [
      { code: "organizations.view", label: "مشاهده سازمان‌ها" },
      { code: "organizations.create", label: "ایجاد سازمان" },
      { code: "organizations.update", label: "ویرایش سازمان" },
      { code: "organizations.delete", label: "حذف سازمان" },
      { code: "organizations.restore", label: "بازیابی سازمان" },
    ],
  },
  {
    title: "تیم‌ها",
    permissions: [
      { code: "teams.view", label: "مشاهده تیم‌ها" },
      { code: "teams.create", label: "ایجاد تیم" },
      { code: "teams.update", label: "ویرایش تیم" },
      { code: "teams.delete", label: "حذف تیم" },
      { code: "teams.restore", label: "بازیابی تیم" },
    ],
  },
  {
    title: "راستر",
    permissions: [
      { code: "roster.view", label: "مشاهده راستر" },
      { code: "roster.create", label: "افزودن عضو راستر" },
      { code: "roster.update", label: "ویرایش عضو راستر" },
      { code: "roster.delete", label: "حذف عضو راستر" },
    ],
  },
  {
    title: "فصل‌ها",
    permissions: [
      { code: "seasons.view", label: "مشاهده فصل‌ها" },
      { code: "seasons.create", label: "ایجاد فصل" },
      { code: "seasons.update", label: "ویرایش فصل" },
      { code: "seasons.delete", label: "حذف فصل" },
    ],
  },
  {
    title: "رده‌های سنی",
    permissions: [
      { code: "age-categories.view", label: "مشاهده رده‌های سنی" },
      { code: "age-categories.create", label: "ایجاد رده سنی" },
      { code: "age-categories.update", label: "ویرایش رده سنی" },
      { code: "age-categories.delete", label: "حذف رده سنی" },
    ],
  },
  {
    title: "لیگ‌ها",
    permissions: [
      { code: "leagues.view", label: "مشاهده لیگ‌ها" },
      { code: "leagues.create", label: "ایجاد لیگ" },
      { code: "leagues.update", label: "ویرایش لیگ" },
      { code: "leagues.delete", label: "حذف لیگ" },
    ],
  },
  {
    title: "ثبت‌نام تیم در لیگ",
    permissions: [
      { code: "league-teams.view", label: "مشاهده تیم‌های لیگ" },
      { code: "league-teams.create", label: "ثبت‌نام تیم در لیگ" },
      { code: "league-teams.delete", label: "حذف تیم از لیگ" },
    ],
  },
  {
    title: "راستر لیگ",
    permissions: [
      { code: "league-roster.view", label: "مشاهده راستر لیگ" },
      { code: "league-roster.create", label: "افزودن عضو به راستر لیگ" },
      { code: "league-roster.delete", label: "حذف عضو از راستر لیگ" },
    ],
  },
  {
    title: "گروه‌ها",
    permissions: [
      { code: "groups.view", label: "مشاهده گروه‌ها" },
      { code: "groups.create", label: "ایجاد گروه" },
      { code: "groups.update", label: "ویرایش گروه" },
      { code: "groups.delete", label: "حذف گروه" },
    ],
  },
] as const;

// Union of the exact code literals — derived from the catalog itself (NOT from
// PERMISSION_CODES below, whose flatMap widens to plain string[]).
export type Permission =
  (typeof PERMISSION_CATALOG)[number]["permissions"][number]["code"];

// Flat list of just the codes, derived once — the only thing validation/JWT/DB
// ever see. Typed as a non-empty readonly tuple so z.enum(PERMISSION_CODES)
// typechecks directly (the assertion is safe: the catalog is never empty).
export const PERMISSION_CODES: readonly [Permission, ...Permission[]] =
  PERMISSION_CATALOG.flatMap((group) =>
    group.permissions.map((p) => p.code),
    // Safe: the catalog is a non-empty literal, so the result is a non-empty
    // tuple of code literals — `unknown` bridge needed because TS can't prove
    // an array→tuple conversion structurally.
  ) as unknown as readonly [Permission, ...Permission[]];


// Permissions that a page/endpoint needs in addition to its own action
// permission. The admin panel loads lists (view) before it can offer any
// write action, so holding e.g. "league-teams.create" without
// "league-teams.view" could never work end-to-end. Granting an action
// therefore implicitly grants the read permissions it depends on — never
// anything that mutates data.
const CROSS_RESOURCE_DEPENDENCIES: Readonly<Record<string, readonly Permission[]>> = {
  "roster.view": ["teams.view"],
  "league-teams.view": ["leagues.view"],
  "league-roster.view": ["league-teams.view"],
  "groups.view": ["leagues.view", "league-teams.view"],
};

const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSION_CODES);

/**
 * Expands a raw permission list with the read permissions it implies:
 *  - any `<resource>.<action>` implies `<resource>.view`
 *  - plus the cross-resource links in CROSS_RESOURCE_DEPENDENCIES
 * (transitively). Single source of truth for both token issuance (what the
 * admin panel shows) and request-time enforcement (what the API allows).
 */
export function expandPermissions(granted: readonly string[]): Permission[] {
  const result = new Set<string>();
  const queue = [...granted];
  while (queue.length > 0) {
    const code = queue.pop()!;
    if (result.has(code) || !PERMISSION_SET.has(code)) continue;
    result.add(code);

    const dot = code.lastIndexOf(".");
    const resource = code.slice(0, dot);
    if (code.slice(dot + 1) !== "view") queue.push(`${resource}.view`);
    queue.push(...(CROSS_RESOURCE_DEPENDENCIES[code] ?? []));
  }
  return [...result] as Permission[];
}
