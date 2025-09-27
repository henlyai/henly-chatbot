import { useMemo, useCallback, useContext } from 'react';
import type { TUser, PermissionTypes, Permissions } from 'librechat-data-provider';
import { AuthContext } from '~/hooks/AuthContext';

const useHasAccess = ({
  permissionType,
  permission,
}: {
  permissionType: PermissionTypes;
  permission: Permissions;
}) => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const roles = authContext?.roles;
  const isAuthenticated = authContext?.isAuthenticated || false;

  const checkAccess = useCallback(
    ({
      user,
      permissionType,
      permission,
    }: {
      user?: TUser | null;
      permissionType: PermissionTypes;
      permission: Permissions;
    }) => {
      if (!authContext) {
        console.log('[useHasAccess DEBUG] No authContext');
        return false;
      }

      if (isAuthenticated && user?.role != null && roles && roles[user.role]) {
        const hasPermission = roles[user.role]?.permissions?.[permissionType]?.[permission] === true;
        console.log(`[useHasAccess DEBUG] User: ${user.id}, Role: ${user.role}, Permission: ${permissionType}.${permission}, HasAccess: ${hasPermission}`);
        console.log(`[useHasAccess DEBUG] Role permissions:`, roles[user.role]?.permissions);
        return hasPermission;
      }
      console.log('[useHasAccess DEBUG] No valid role found. User role:', user?.role, 'Roles available:', Object.keys(roles || {}));
      return false;
    },
    [authContext, isAuthenticated, roles],
  );

  const hasAccess = useMemo(
    () => checkAccess({ user, permissionType, permission }),
    [user, permissionType, permission, checkAccess],
  );

  return hasAccess;
};

export default useHasAccess;
