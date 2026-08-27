import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { session, type SessionUser } from '@/lib/api';
import { PageLoadingSkeleton } from '@/components/LoadingSkeletons';

type AppRole =
  | 'employee'
  | 'hq_admin'
  | 'center_admin'
  | 'finance'
  | 'finance_head'
  | 'super_admin';

const homeByRole: Record<AppRole, string> = {
  employee: '/employee',
  hq_admin: '/admin',
  center_admin: '/center-admin',
  finance: '/finance',
  finance_head: '/finance',
  super_admin: '/super-admin',
};

function validRole(user: SessionUser, roles: AppRole[]) {
  return roles.includes(user.role as AppRole);
}

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles: AppRole[] }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    void session.me().then((user) => {
      if (!active) return;
      if (user && validRole(user, roles)) {
        setAllowed(true);
        return;
      }
      const destination = user ? homeByRole[user.role as AppRole] || '/' : '/';
      window.location.replace(destination);
    });
    return () => { active = false; };
  }, [roles]);

  if (allowed) return children;
  return <PageLoadingSkeleton />;
}

export function protectedRoute(Page: ComponentType, roles: AppRole[]) {
  return function SecuredPage() {
    return <ProtectedRoute roles={roles}><Page /></ProtectedRoute>;
  };
}
