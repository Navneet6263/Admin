import { useEffect, useState } from 'react';
import { session, type SessionUser } from './api';

/** Keeps the server and first browser render identical, then restores the session. */
export function useSessionUser() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;
    const cached = session.user;
    if (cached) setUser(cached);
    void session.me().then((fresh) => {
      if (active) setUser(fresh);
    });
    return () => { active = false; };
  }, []);

  return user;
}
