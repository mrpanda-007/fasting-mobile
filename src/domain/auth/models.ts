export type AuthStatus = 'restoring' | 'guest' | 'authenticated';

export type Account = {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
};

export type AuthSession = {
  account: Account;
  accessToken: string;
  expiresAt: string;
};
