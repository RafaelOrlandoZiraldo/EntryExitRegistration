import { useEffect } from "react";
import type {
  CreateDailyBackupInput,
  CreateDailyBackupResult
} from "@application/use-cases";
import { reportDevelopmentError } from "@app/errors/diagnostics";
import {
  formatLocalDate,
  getMillisecondsUntilNextLocalMidnight
} from "./dailyBackupSchedule";

export interface DailyBackupRunnerProps {
  createDailyBackupUseCase: {
    execute(input: CreateDailyBackupInput): Promise<CreateDailyBackupResult>;
  };
}

export function DailyBackupRunner({
  createDailyBackupUseCase
}: DailyBackupRunnerProps) {
  useEffect(() => {
    let timeoutId: number | undefined;
    let isMounted = true;

    const runBackup = async () => {
      try {
        await createDailyBackupUseCase.execute({
          backupDate: formatLocalDate(new Date())
        });
      } catch (error) {
        reportDevelopmentError(error);
      }
    };

    const scheduleNextMidnight = () => {
      if (!isMounted) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        void runBackup().finally(scheduleNextMidnight);
      }, getMillisecondsUntilNextLocalMidnight(new Date()));
    };

    void runBackup().finally(scheduleNextMidnight);

    return () => {
      isMounted = false;

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [createDailyBackupUseCase]);

  return null;
}
