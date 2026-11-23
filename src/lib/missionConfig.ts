import missionRules from "../config/mission-rules.v1.json";

export interface MissionRule {
  ruleId: string;
  ruleVersion: string;
  domain: "immune" | "bone" | "cardiovascular" | "behavioral_health";
  metricCode: string;
  unit: string;
  thresholdSetId: string;
  watchBand: { low: number; high: number };
  urgentBand?: { low: number; high: number };
  actionCode: string;
}

export interface CountermeasureConfig {
  actionCode: string;
  title: string;
  instructions: string[];
  priority: "routine" | "soon" | "immediate";
  requiresConfirmation: boolean;
  escalationPath: string;
}

export interface MissionConfig {
  schemaVersion: number;
  configId: string;
  configVersion: string;
  signature: string;
  effectiveFrom: string;
  expiresAt: string;
  dataFreshness: {
    staleAfterSeconds: number;
    questionableAfterSeconds: number;
  };
  rules: MissionRule[];
  countermeasures: CountermeasureConfig[];
}

export const missionConfig = missionRules as MissionConfig;

export function getRule(metricCode: string): MissionRule | undefined {
  return missionConfig.rules.find((rule) => rule.metricCode === metricCode);
}
