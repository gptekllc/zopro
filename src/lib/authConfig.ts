export const PRODUCTION_DOMAIN = 'https://fsm.zopro.app';

export const getAuthRedirectUrl = (path: string = '/dashboard') => {
  return `${PRODUCTION_DOMAIN}${path}`;
};
