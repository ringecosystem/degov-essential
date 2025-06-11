


export interface TwitterAuthorizeForm {
  profile: string;
  method: "api";
}

export interface TwitterOAuthType {
  oauth_token: string;
  oauth_token_secret: string;
}

export interface QueryTwitterCallback {
  profile: string;
  oauth_token: string;
  oauth_verifier: string;
}

