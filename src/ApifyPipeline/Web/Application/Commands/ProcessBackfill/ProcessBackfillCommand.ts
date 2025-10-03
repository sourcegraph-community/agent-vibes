export interface ProcessBackfillCommand {
  forceNewApifyRun?: boolean;
  forceRenormalizeExisting?: boolean;
}

export interface ProcessBackfillCommandResult {
  success: boolean;
  message: string;
  batchId?: string;
  error?: string;
}
