export interface AgnesResult {
  status: number;
  body: {
    text?: string;
    error?: string;
  };
}

export function askAgnes(
  payload: unknown,
  apiKey?: string,
  model?: string,
): Promise<AgnesResult>;
