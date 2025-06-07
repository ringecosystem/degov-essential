export type AuthMethod = "cookies" | "credentials" | "api";

// Define the search modes
export type SearchMode = "Top" | "Latest" | "Photos" | "Videos";

export type XApiVersion = "v1" | "v2";

export interface AuthConfig {
  method: AuthMethod;
  alias?: string;
  data: CookieAuth | CredentialsAuth | ApiAuth;
}

export interface CookieAuth {
  cookies: string[];
}

export interface CredentialsAuth {
  username: string;
  password: string;
  email?: string;
  twoFactorSecret?: string;
}

export interface ApiAuth {
  apiKey: string;
  apiSecretKey: string;
  accessToken: string;
  accessTokenSecret: string;
}

export class TwitterAgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "TwitterAgentError";
  }
}

export interface PollData {
  id?: string;
  end_datetime?: string;
  voting_status?: string;
  duration_minutes: number;
  options: { label: string }[];
}

export interface FollowResponse {
  success: boolean;
  message: string;
}
