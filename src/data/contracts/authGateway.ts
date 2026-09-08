import type { AuthSession } from '../../domain/auth/models';

/** Future provider adapter: email, Apple, Google, or another provider all fit here. */
export interface AuthGateway {
  restoreSession(): Promise<AuthSession | null>;
  signIn(): Promise<AuthSession>;
  signOut(): Promise<void>;
}
