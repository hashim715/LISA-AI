export interface Email {
  body: string;
  subject: string;
  timestamp: Date;
  from: string;
}

export interface JwtPayload {
  username: string;
}
