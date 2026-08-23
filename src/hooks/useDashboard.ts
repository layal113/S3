import { useCallback, useEffect, useState } from 'react';

import type { DashboardService } from '../services';
import type { DashboardData, HouseholdId } from '../types/dashboard';

type RequestSnapshot =
  | { key: string; status: 'loading'; data: null; error: null }
  | { key: string; status: 'success'; data: DashboardData; error: null }
  | { key: string; status: 'error'; data: null; error: string };

export function useDashboard(
  service: DashboardService,
  householdId: HouseholdId,
) {
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = `${householdId}:${reloadCount}`;
  const [snapshot, setSnapshot] = useState<RequestSnapshot>({
    key: '',
    status: 'loading',
    data: null,
    error: null,
  });
  const reload = useCallback(() => setReloadCount((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    service
      .getDashboard(householdId)
      .then((data) => {
        if (active)
          setSnapshot({
            key: requestKey,
            status: 'success',
            data,
            error: null,
          });
      })
      .catch(() => {
        if (active)
          setSnapshot({
            key: requestKey,
            status: 'error',
            data: null,
            error: 'Dashboard data could not be loaded. Please try again.',
          });
      });
    return () => {
      active = false;
    };
  }, [householdId, requestKey, service]);

  const isCurrent = snapshot.key === requestKey;
  return {
    data: isCurrent ? snapshot.data : null,
    error: isCurrent ? snapshot.error : null,
    isLoading: !isCurrent || snapshot.status === 'loading',
    reload,
  };
}
