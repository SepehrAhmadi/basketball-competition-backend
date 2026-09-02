export const messages = {
  error: {
    auth: {
      invalidSelfRegisterRole: "نقش انتخاب‌شده برای ثبت‌نام مجاز نیست",
      phoneOrEmailInUse: "شماره تلفن یا ایمیل قبلاً استفاده شده است",
      invalidCredentials: "اطلاعات ورود نامعتبر است",
      accountNotActive: "حساب کاربری فعال نیست",
      notAuthorizedAdminPanel: "شما مجاز به ورود به پنل مدیریت نیستید",
      refreshTokenNotFound: "توکن تازه‌سازی یافت نشد",
      invalidRefreshToken: "توکن تازه‌سازی نامعتبر است",
      userNotFound: "کاربر یافت نشد",
      fullNameRequired: "نام کامل الزامی است",
      phoneRequired: "شماره تلفن الزامی است",
      invalidEmail: "ایمیل نامعتبر است",
      passwordMinLength: "رمز عبور باید حداقل ۸ کاراکتر باشد",
      identifierRequired: "شماره تلفن یا ایمیل الزامی است",
      passwordRequired: "رمز عبور الزامی است",
      atLeastOneRoleRequired: "حداقل یک نقش الزامی است",
      phoneNumberLength: "شماره تلفن باید ۱۱ رقم باشد",
    },
    organization: {
      nameRequired: "نام باشگاه الزامی است",
      notFound: "باشگاه یافت نشد",
      notAuthorized: "شما مجاز به دسترسی به این باشگاه نیستید",
    },
    player: {
      notFound: "بازیکن یافت نشد",
    },
    coach: {
      notFound: "مربی یافت نشد",
    },
    referee: {
      notFound: "داور یافت نشد",
    },
  },
  success: {
    auth: {
      accountCreated: "حساب کاربری با موفقیت ایجاد شد",
      loginSuccessful: "ورود با موفقیت انجام شد",
      tokenRefreshed: "توکن با موفقیت تازه‌سازی شد",
      loggedOut: "خروج با موفقیت انجام شد",
      accountDeleted: "حساب کاربری با موفقیت حذف شد",
      userCreated: "کاربر با موفقیت ایجاد شد",
      userDeleted: "کاربر با موفقیت حذف شد",
    },
    organization: {
      list: "لیست باشگاه‌ها با موفقیت دریافت شد",
      found: "باشگاه با موفقیت دریافت شد",
      created: "باشگاه با موفقیت ایجاد شد",
      updated: "باشگاه با موفقیت به‌روزرسانی شد",
      deleted: "باشگاه با موفقیت حذف شد",
    },
    player: {
      found: "اطلاعات بازیکن با موفقیت دریافت شد",
      updated: "اطلاعات بازیکن با موفقیت به‌روزرسانی شد",
    },
    coach: {
      found: "اطلاعات مربی با موفقیت دریافت شد",
      updated: "اطلاعات مربی با موفقیت به‌روزرسانی شد",
    },
    referee: {
      found: "اطلاعات داور با موفقیت دریافت شد",
      updated: "اطلاعات داور با موفقیت به‌روزرسانی شد",
    },
    roles: {
      fetched: "نقش‌ها با موفقیت دریافت شد",
    },
    coachDegrees: {
      fetched: "درجات مربیگری با موفقیت دریافت شد",
    },
    refereeLevels: {
      fetched: "درجات داوری با موفقیت دریافت شد",
    },
  },
} as const;
