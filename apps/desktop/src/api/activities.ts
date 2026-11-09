import type { ActivityTask } from "../../../runtime/src/tasks/queue";
import { api } from "./client";

export interface ActivityOverview {
  paused: boolean;
  tasks: ActivityTask[];
  schedules: {
    id: string;
    enabled: boolean;
    mode: string;
    intervalMinutes: number;
    choices: { platform: string; videoId: string }[];
    nextAt: number;
  }[];
}

export function loadActivities() {
  return api<ActivityOverview>("/v1/activities");
}

export function cancelActivity(id: string) {
  return api(`/v1/activities/${id}/cancel`, "POST");
}
