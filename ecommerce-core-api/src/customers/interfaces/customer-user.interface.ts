export interface CustomerUser {
  id: string;
  storeId: string;
  phone: string;
  email: string | null;
  fullName: string;
  sessionId: string;
}

export interface CustomerAccessTokenPayload {
  sub: string;
  sid: string;
  storeId: string;
  phone: string;
  email: string | null;
  fullName: string;
}

export interface CustomerAuthResult {
  accessToken: string;
  refreshToken: string;
  customer: CustomerUser;
}
