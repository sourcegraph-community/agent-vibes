export type ProcessBackfillCommand = Record<string, never>;

export interface ProcessBackfillCommandResult {
  success: boolean;
  message: string;
  batchId?: string;
  error?: string;
}
