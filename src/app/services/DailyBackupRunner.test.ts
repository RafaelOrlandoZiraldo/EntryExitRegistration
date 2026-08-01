import { describe, expect, it } from "vitest";
import {
  formatLocalDate,
  getMillisecondsUntilNextLocalMidnight
} from "./dailyBackupSchedule";

describe("DailyBackupRunner date helpers", () => {
  it("formatLocalDate_WhenDateHasSingleDigitMonthAndDay_ShouldPadValues", () => {
    expect(formatLocalDate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  it("getMillisecondsUntilNextLocalMidnight_WhenTimeIsNoon_ShouldReturnTwelveHours", () => {
    expect(
      getMillisecondsUntilNextLocalMidnight(new Date(2026, 7, 1, 12, 0, 0, 0))
    ).toBe(12 * 60 * 60 * 1000);
  });

  it("getMillisecondsUntilNextLocalMidnight_WhenTimeIsExactlyMidnight_ShouldReturnOneDay", () => {
    expect(
      getMillisecondsUntilNextLocalMidnight(new Date(2026, 7, 1, 0, 0, 0, 0))
    ).toBe(24 * 60 * 60 * 1000);
  });
});
