import { ProviderError, type ProviderErrorSeverity, type ProviderErrorType, type ProviderType } from "./types";

export function normalizeError(error: unknown, provider: ProviderType): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  
  let type: ProviderErrorType = "unknown";
  let shouldRetry = false;
  let severity: ProviderErrorSeverity = "medium";

  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("rate limit") || lowerMessage.includes("429")) {
    type = "rate_limit";
    shouldRetry = true;
    severity = "low";
  } else if (lowerMessage.includes("auth") || lowerMessage.includes("unauthorized") || lowerMessage.includes("401")) {
    type = "auth_error";
    shouldRetry = false;
    severity = "critical";
  } else if (lowerMessage.includes("timeout") || lowerMessage.includes("aborted")) {
    type = "timeout";
    shouldRetry = true;
    severity = "medium";
  } else if (lowerMessage.includes("500") || lowerMessage.includes("502") || lowerMessage.includes("503") || lowerMessage.includes("server error")) {
    type = "server_error";
    shouldRetry = true;
    severity = "high";
  } else if (lowerMessage.includes("validation") || lowerMessage.includes("bad request") || lowerMessage.includes("400")) {
    type = "validation_error";
    shouldRetry = false;
    severity = "medium";
  } else if (lowerMessage.includes("provider_unavailable")) {
    type = "provider_unavailable";
    shouldRetry = false;
    severity = "medium";
  }

  return new ProviderError(message, type, provider, severity, shouldRetry);
}
