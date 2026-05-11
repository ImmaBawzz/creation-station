export type CertificationStatus = "passed" | "failed" | "skipped";

export interface CertificationStep {
  name: string;
  status: CertificationStatus;
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface CertificationReport {
  provider: string;
  certifiedAt: string;
  totalDurationMs: number;
  overallStatus: CertificationStatus;
  steps: CertificationStep[];
}
