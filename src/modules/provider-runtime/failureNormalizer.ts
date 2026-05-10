import { ProviderError, type ProviderErrorType } from "./types";

export function normalizeError(error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  
  let type: ProviderErrorType = "unknown";
  let shouldRetry = false;

  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("rate limit") || lowerMessage.includes("429")) {
    type = "rate_limit";
    shouldRetry = true;
  } else if (lowerMessage.includes("auth") || lowerMessage.includes("unauthorized") || lowerMessage.includes("401")) {
    type = "auth_error";
    shouldRetry = false;
  } else if (lowerMessage.includes("timeout") || lowerMessage.includes("aborted")) {
    type = "timeout";
    shouldRetry = true;
  } else if (lowerMessage.includes("500") || lowerMessage.includes("502") || lowerMessage.includes("503") || lowerMessage.includes("server error")) {
    type = "server_error";
    shouldRetry = true;
  } else if (lowerMessage.includes("validation") || lowerMessage.includes("bad request") || lowerMessage.includes("400")) {
    type = "validation_error";
    shouldRetry = false;
  }

  return new ProviderError(message, type, shouldRetry);
}
