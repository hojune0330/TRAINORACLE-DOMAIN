import { createHash } from 'node:crypto';

export const CANONICAL_ORIGIN = 'https://trainoracle.io';
const SETTINGS = new Set([
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_ACCOUNT_PUBLIC_ENABLED', 'VITE_KILL_ACCOUNT',
  'VITE_FEATURE_ACCOUNT_JOURNAL', 'VITE_KILL_ACCOUNT_JOURNAL',
  'VITE_FEATURE_GARMIN_INTEGRATION', 'VITE_KILL_GARMIN_INTEGRATION',
  'VITE_ACCOUNT_JOURNAL_GATEWAY_URL', 'VITE_GARMIN_INTEGRATION_URL', 'VITE_GARMIN_AUTHORIZATION_ORIGIN',
  'VITE_PRIVACY_POLICY_URL', 'VITE_PRIVACY_POLICY_VERSION', 'VITE_TERMS_OF_SERVICE_URL', 'VITE_TERMS_OF_SERVICE_VERSION',
  'VITE_ACCOUNT_STORAGE_PRIVACY_RELEASE_APPROVED', 'VITE_ACCOUNT_STORAGE_PRIVACY_MIGRATION',
  ...['KAKAO', 'GOOGLE', 'EMAIL', 'PHONE'].flatMap(provider => [`VITE_${provider}_AUTH_ENABLED`, `VITE_KILL_${provider}_AUTH`]),
  'VITE_EMAIL_AUTH_PKCE_OPERATIONS_APPROVED', 'VITE_PHONE_AUTH_OPERATIONS_APPROVED',
]);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;
function exactOrigin(raw) {
  try { const url = new URL(raw); return typeof raw === 'string' && url.protocol === 'https:' && url.origin === raw; }
  catch { return false; }
}
function publicKey(value) {
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/u.test(value)) return true;
  if (typeof value !== 'string' || value.startsWith('sb_secret_') || value.split('.').length !== 3) return false;
  try { return JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8')).role === 'anon'; }
  catch { return false; }
}

export function parseCanonicalAccountInput(raw) {
  try {
    if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > 16_384) throw 0;
    return JSON.parse(raw);
  } catch { throw Error('CANONICAL_ACCOUNT_CONFIG_INVALID'); }
}

/** An explicit public build declaration, never evidence that server gates or user consent are ready. */
export function canonicalAccountEnvironment(off, input) {
  if (!object(input) || Object.keys(input).sort().join(',') !== 'canonicalOrigin,environment,gatewayOrigin'
    || input.canonicalOrigin !== CANONICAL_ORIGIN || !exactOrigin(input.gatewayOrigin) || !object(input.environment)) {
    throw Error('CANONICAL_ACCOUNT_CONFIG_INVALID');
  }
  const env = input.environment;
  for (const [name, value] of Object.entries(env)) {
    if (!SETTINGS.has(name) || typeof value !== 'string' || value.length > 4096 || value.trim() !== value
      || (/(?:_ENABLED|_APPROVED)$|^VITE_(?:KILL_|FEATURE_)/u.test(name) && !['true', 'false'].includes(value))) {
      throw Error('CANONICAL_ACCOUNT_SETTING_REJECTED');
    }
  }
  for (const name of ['VITE_ACCOUNT_PUBLIC_ENABLED', 'VITE_FEATURE_ACCOUNT_JOURNAL', 'VITE_FEATURE_GARMIN_INTEGRATION',
    'VITE_ACCOUNT_STORAGE_PRIVACY_RELEASE_APPROVED']) {
    if (env[name] !== 'true') throw Error('CANONICAL_ACCOUNT_REQUIRED_SETTING');
  }
  for (const name of ['VITE_KILL_ACCOUNT', 'VITE_KILL_ACCOUNT_JOURNAL', 'VITE_KILL_GARMIN_INTEGRATION']) {
    if (env[name] !== 'false') throw Error('CANONICAL_ACCOUNT_REQUIRED_SETTING');
  }
  if (!exactOrigin(env.VITE_SUPABASE_URL) || !publicKey(env.VITE_SUPABASE_ANON_KEY)) throw Error('CANONICAL_ACCOUNT_PUBLIC_CONNECTION_INVALID');
  const companyGateway = env.VITE_ACCOUNT_JOURNAL_GATEWAY_URL === `${input.gatewayOrigin}/api/account-journal`
    && env.VITE_GARMIN_INTEGRATION_URL === `${input.gatewayOrigin}/api/garmin-integration`;
  // An empty journal override retains its existing authenticated Supabase transport and stored records.
  const projectFunctions = input.gatewayOrigin === env.VITE_SUPABASE_URL
    && env.VITE_ACCOUNT_JOURNAL_GATEWAY_URL === ''
    && env.VITE_GARMIN_INTEGRATION_URL === `${env.VITE_SUPABASE_URL}/functions/v1/garmin-integration`;
  if ((!companyGateway && !projectFunctions)
    || env.VITE_GARMIN_AUTHORIZATION_ORIGIN !== 'https://connect.garmin.com') throw Error('CANONICAL_ACCOUNT_ENDPOINT_INVALID');
  if (env.VITE_PRIVACY_POLICY_URL !== `${CANONICAL_ORIGIN}/legal/privacy.html`
    || env.VITE_TERMS_OF_SERVICE_URL !== `${CANONICAL_ORIGIN}/legal/terms.html`
    || env.VITE_PRIVACY_POLICY_VERSION !== '2026-11-04' || env.VITE_TERMS_OF_SERVICE_VERSION !== '2026-11-04'
    || env.VITE_ACCOUNT_STORAGE_PRIVACY_MIGRATION !== '0058_storage_withdrawal_erasure') throw Error('CANONICAL_ACCOUNT_LEGAL_CONFIGURATION_INVALID');
  const providers = ['KAKAO', 'GOOGLE', 'EMAIL', 'PHONE'].filter(provider => env[`VITE_${provider}_AUTH_ENABLED`] === 'true');
  if (!providers.length || providers.some(provider => env[`VITE_KILL_${provider}_AUTH`] !== 'false')) throw Error('CANONICAL_ACCOUNT_AUTH_REQUIRED');
  for (const [provider, approval] of [['EMAIL', 'VITE_EMAIL_AUTH_PKCE_OPERATIONS_APPROVED'], ['PHONE', 'VITE_PHONE_AUTH_OPERATIONS_APPROVED']]) {
    if (providers.includes(provider) && env[approval] !== 'true') throw Error('CANONICAL_ACCOUNT_AUTH_OPERATIONS_REQUIRED');
  }
  return { ...off, VITE_FEATURE_SELF_HOSTED_COACHING: 'false', VITE_KILL_SELF_HOSTED_COACHING: 'true', ...env };
}

export function canonicalAccountEvidence(environment) {
  return { mode: 'CANONICAL_ACCOUNT', origin: CANONICAL_ORIGIN, configurationSha256: createHash('sha256')
    .update(JSON.stringify(Object.entries(environment).filter(([name]) => name.startsWith('VITE_'))
      .sort(([a], [b]) => a.localeCompare(b)))).digest('hex') };
}

export function selectDomainAccountInput(env) {
  const retainCanonical = env.GITHUB_EVENT_NAME === 'repository_dispatch'
    && typeof env.DOMAIN_ACCOUNT_CONFIG_JSON === 'string' && env.DOMAIN_ACCOUNT_CONFIG_JSON.trim() !== '';
  const mode = env.DOMAIN_ACCOUNT_MODE || (retainCanonical ? 'canonical' : 'off');
  if (mode === 'off') return null;
  if (mode !== 'canonical' || env.GITHUB_REPOSITORY !== 'hojune0330/TRAINORACLE-DOMAIN'
    || env.GITHUB_REF !== 'refs/heads/main') throw Error('CANONICAL_ACCOUNT_PUBLISHER_REQUIRED');
  return parseCanonicalAccountInput(env.DOMAIN_ACCOUNT_CONFIG_JSON);
}
