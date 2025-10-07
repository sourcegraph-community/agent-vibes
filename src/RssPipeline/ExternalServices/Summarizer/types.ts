export interface OllamaSummarizerConfig {
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface SummaryRequest {
  entryId: string;
  content: string;
  title?: string | null;
  author?: string | null;
}

export interface SummaryResponse {
  summary: string;
  model: string;
  latencyMs: number;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: false;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
    top_k?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface SummaryProcessingResult {
  success: boolean;
  summary?: SummaryResponse;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  latencyMs: number;
}
