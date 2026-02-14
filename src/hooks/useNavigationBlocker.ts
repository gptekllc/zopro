import { useBlocker } from 'react-router-dom';

export function useNavigationBlocker(shouldBlock: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      shouldBlock && currentLocation.pathname !== nextLocation.pathname
  );

  return blocker;
}
