export interface ProcessBackfillCommand {
  forceNewApifyRun?: boolean;
}

export interface ProcessBackfillCommandResult {
  success: boolean;
  message: string;
  batchId?: string;
  error?: string;
}
