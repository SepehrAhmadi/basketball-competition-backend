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
    title: "تیم‌ها",
    permissions: [
      { code: "teams.view", label: "مشاهده تیم‌ها" },
      { code: "teams.create", label: "ایجاد تیم" },
      { code: "teams.update", label: "ویرایش تیم" },
      { code: "teams.delete", label: "حذف تیم" },
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
