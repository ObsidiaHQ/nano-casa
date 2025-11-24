import { createAuthClient } from 'better-auth/client';
import { environment } from '../environments/environment';

export const authClient = createAuthClient({
  baseURL: environment.server,
});
