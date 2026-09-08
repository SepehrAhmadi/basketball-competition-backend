import moment from "moment-jalaali";

const JALALI_FORMAT = "jYYYY/jMM/jDD";
const JALALI_PATTERN = /^\d{4}\/\d{2}\/\d{2}$/;

export function jalaliToGregorian(value: string): Date {
  if (!JALALI_PATTERN.test(value)) {
    throw new Error("Invalid Jalali date format. Expected YYYY/MM/DD.");
  }

  const parsed = moment(value, JALALI_FORMAT, true);

  if (!parsed.isValid()) {
    throw new Error("Invalid Jalali date.");
  }

  return new Date(
    Date.UTC(
      parsed.year(),
      parsed.month(),
      parsed.date(),
      12,
      0,
      0,
      0,
    ),
  );
}

export function gregorianToJalali(value: Date | null): string | null {
  if (!value) return null;

  return moment.utc(value).format(JALALI_FORMAT);
}