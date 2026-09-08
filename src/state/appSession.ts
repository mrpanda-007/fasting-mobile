import type { AuthStatus } from '../domain/auth/models';
import type { ActiveFast } from '../domain/fasting/models';

/** Ephemeral app state only. The durable records belong in repositories. */
export type AppSessionState = {
  authStatus: AuthStatus;
  activeFast: ActiveFast | null;
  isHydrated: boolean;
  syncStatus: 'idle' | 'syncing' | 'offline' | 'error';
};
