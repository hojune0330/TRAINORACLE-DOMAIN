import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const SOURCE_REPO = 'hojune0330/TRAINORACLE';
export const DOMAIN_REPO = 'hojune0330/TRAINORACLE-DOMAIN';
export const REVIEWED_SHA = '0eb26e4319c7e4fffb118976211c228cfa25e510';
export const ORIGIN = 'https://trainoracle.io/';
export const OLD_ORIGIN = 'https://hojune0330.github.io/TRAINORACLE/';
export const OLD_EMAIL = 'hojune0330@gmail.com';
export const NEW_EMAIL = 'hojune.jang@trainoracle.io';
const SHA = /^[a-f0-9]{40}$/;
const FEATURE_OFF = ['ACCOUNT_JOURNAL', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PLAN_BACKUP', 'PUBLIC_PROFILE', 'PRODUCT_ANALYTICS', 'FEEDBACK_BOARD', 'FILE_ANALYSIS_TCX', 'FILE_ANALYSIS_CSV', 'FILE_ANALYSIS_JSON', 'FILE_ANALYSIS_GPX', 'MINIGAME_PROGRESS'];

export function accountOffEnvironment(base = {}) {
  // No arbitrary runner/repository VITE_* settings or credentials are inherited.
  const env = {};
  for (const name of ['PATH', 'Path', 'HOME', 'USERPROFILE', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR']) {
    if (base[name]) env[name] = base[name];
  }
  // Reviewed source has no separate storage-backend toggle: account gates + empty connection keep it inaccessible.
  Object.assign(env, { CI: 'true', TZ: 'UTC', VITE_SERVER_OPERATIONS_ENABLED: 'false', VITE_LOUNGE_PUBLIC_ENABLED: 'false', VITE_LOUNGE_REALTIME_URL: '', VITE_LOUNGE_PAGE_URL: '', VITE_FRIEND_ARENA_URL: '', VITE_ACCOUNT_PUBLIC_ENABLED: 'false', VITE_KILL_ACCOUNT: 'true', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_ACCOUNT_STORAGE_PRIVACY_RELEASE_APPROVED: 'false', VITE_ACCOUNT_STORAGE_PRIVACY_MIGRATION: '', VITE_EMAIL_AUTH_PKCE_OPERATIONS_APPROVED: 'false', VITE_PHONE_AUTH_OPERATIONS_APPROVED: 'false', VITE_PRIVACY_POLICY_URL: ORIGIN + 'legal/privacy.html', VITE_PRIVACY_POLICY_VERSION: '2026-10-05', VITE_TERMS_OF_SERVICE_URL: ORIGIN + 'legal/terms.html', VITE_TERMS_OF_SERVICE_VERSION: '2026-10-05' });
  for (const provider of ['KAKAO', 'GOOGLE', 'EMAIL', 'PHONE']) {
    env['VITE_' + provider + '_AUTH_ENABLED'] = 'false';
    env['VITE_KILL_' + provider + '_AUTH'] = 'true';
  }
  for (const feature of FEATURE_OFF) {
    env['VITE_FEATURE_' + feature] = 'false';
    env['VITE_KILL_' + feature] = 'true';
  }
  return env;
}

export function sourceTestEnvironment(base = {}) {
  // Source contract tests intentionally switch features with their own fixtures.
  // Production kill switches must not poison those fixtures; runner credentials
  // and arbitrary repository VITE values must still never reach the test process.
  const env = accountOffEnvironment(base);
  for (const key of Object.keys(env)) if (key.startsWith('VITE_')) delete env[key];
  return env;
}

export function sourceBuildCommands(scope = 'source-verified') {
  if (!['source-verified', 'domain-hosting'].includes(scope)) throw new Error('Unknown build verification scope');
  return [['ci'], ['run', 'typecheck'], ...(scope === 'source-verified' ? [['test']] : []), ['run', 'build']];
}

export function assertAccountOff(env) {
  const expected = accountOffEnvironment();
  for (const [key, value] of Object.entries(expected)) {
    if (key.startsWith('VITE_') && env[key] !== value) throw new Error('Account-OFF contract mismatch: ' + key);
  }
  for (const key of Object.keys(env)) {
    if (key.startsWith('VITE_') && !Object.hasOwn(expected, key)) throw new Error('Unreviewed VITE setting: ' + key);
  }
}

export function selectSha(requested, mainSha) {
  if (!SHA.test(mainSha)) throw new Error('Invalid main SHA');
  if (typeof requested !== 'string') throw new Error('source_sha must be a string');
  const selected = requested.trim() || mainSha;
  if (!SHA.test(selected)) throw new Error('source_sha must be a full lowercase 40-character SHA');
  // No rollback or branch selection on this publisher.
  if (selected !== mainSha) throw new Error('source_sha must equal the current source main HEAD');
  return selected;
}

async function mainSha() {
  const response = await fetch('https://api.github.com/repos/' + SOURCE_REPO + '/commits/main', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'TRAINORACLE-DOMAIN-public-publisher' }, cache: 'no-store' });
  if (!response.ok) throw new Error('Public main lookup failed: HTTP ' + response.status);
  const data = await response.json();
  if (!SHA.test(data.sha)) throw new Error('Invalid public main response');
  return data.sha;
}

function replaceOnce(text, before, after, label) {
  if (text.indexOf(before) < 0 || text.indexOf(before) !== text.lastIndexOf(before)) throw new Error('Upstream document changed; review required: ' + label);
  return text.replace(before, after);
}

export function patchDocument(file, original) {
  if (!original.includes(OLD_EMAIL)) throw new Error('Expected contact missing: ' + file);
  let text = original.replaceAll(OLD_EMAIL, NEW_EMAIL);
  if (file === 'support.html') {
    text = replaceOnce(text, '최근 확인: 2026년 8월 29일', '상태 안내 기준일: 2026년 10월 9일', 'support date');
    text = replaceOnce(text, '<strong>공식 연동 신청은 완료됐고 제공자 검토를 기다리고 있습니다.</strong> 승인 여부와 시점은 Garmin·COROS가 결정합니다.', '<strong>Garmin은 2026년 10월 9일 안내 기준 신규 심사·승인이 잠정 중단되었으며 재개일은 미정입니다.</strong> COROS는 공식 API 신청 완료 후 제공자 검토 대기 상태입니다. 승인 여부와 시점은 각 제공자가 결정합니다.', 'provider notice');
    text = replaceOnce(text, '제공자 검토 대기 중인 공식 자동 연동', '아직 공개되지 않은 공식 자동 연동', 'provider heading');
    text = replaceOnce(text, '<h2>아직 공개되지 않은 공식 자동 연동</h2>', '<p class="legal-note">새 주소의 계정 로그인·온라인 보관·동기화는 아직 공개하지 않습니다. 기존 기기 기록은 기존 GitHub.io 주소에 남습니다. <a href="./migration.html">기존 주소와 기록 보존 안내</a>를 확인해 주세요.</p>\n\n    <h2>아직 공개되지 않은 공식 자동 연동</h2>', 'origin preservation link');
    text = replaceOnce(text, '<td>공식 개발자 프로그램 신청 완료 · 제공자 검토 대기</td>', '<td>공식 개발자 프로그램 신청 완료 · 2026년 10월 9일 신규 심사·승인 잠정 중단 · 재개일 미정 · 자동 연동 미공개</td>', 'Garmin row');
  }
  if (file === 'legal/device-integrations.html') {
    text = replaceOnce(text, '    <h2>받으려는 정보</h2>', '    <p class="legal-note">기기 연동 상태 안내 기준일: 2026년 10월 9일. Garmin 신규 심사·승인은 잠정 중단되었고 재개일은 미정입니다. COROS는 공식 API 신청 완료 후 제공자 검토 대기 상태를 유지합니다. 두 서비스의 자동 연동은 아직 공개되지 않았습니다.</p>\n\n    <h2>받으려는 정보</h2>', 'device status');
  }
  return text;
}

export function migrationPage() {
  return '<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>주소 이전과 기존 기록 안내 | TRAINORACLE</title><link rel="stylesheet" href="./legal/legal.css"><link rel="canonical" href="https://trainoracle.io/migration.html"></head><body><main class="legal-document"><h1>새 주소와 기존 기록 안내</h1><p>새 주소 <a href="https://trainoracle.io/">trainoracle.io</a>에서는 같은 원본의 전체 앱을 제공합니다. 계정 로그인, 계정 보관, 동기화, 공유와 연결 백엔드는 아직 공개하지 않습니다.</p><h2>기존 기록은 구주소에서 확인하세요</h2><p><a href="https://hojune0330.github.io/TRAINORACLE/">기존 GitHub.io 앱 열기</a></p><p>기존 기록은 해당 브라우저의 구주소 저장공간에 남아 있습니다. 구주소의 앱과 자료 접근 경로를 유지하며, 이 배포는 구주소를 리디렉션하거나 삭제하지 않습니다. 브라우저 저장공간을 지우지 말고 기록을 작성한 같은 브라우저로 구주소를 열어 주세요.</p><p>서로 다른 주소의 브라우저 저장공간은 자동으로 공유되지 않습니다. 새 주소에서 구주소의 기록을 자동으로 읽거나 모두 옮길 수 있다고 보장하지 않습니다. 백업·가져오기를 사용하더라도 지원되는 자료 범위를 확인하고 원본을 보관하세요. 모든 항목의 완전한 복원을 약속하지 않습니다.</p><p><a href="./">새 주소 앱 열기</a> · <a href="./support.html">도움말</a> · <a href="mailto:hojune.jang@trainoracle.io">문의</a></p></main></body></html>\n';
}

const LEGAL_FILES = ['legal/privacy.html', 'legal/terms.html', 'legal/device-integrations.html', 'support.html'];
const RECEIPT = 'trainoracle-domain-receipt.json';
const DENIED_CONTENT = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{20,}/, /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}/, /\bAIza[A-Za-z0-9_-]{30,}/, /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/];

async function inventory(root, prefix = '') {
  const result = {};
  for (const entry of (await readdir(join(root, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isSymbolicLink() || (!(await lstat(join(root, name))).isFile() && !entry.isDirectory())) throw new Error('Unsafe artifact entry: ' + name);
    if (/(^|\/)(?:\.(?!nojekyll)|node_modules(?:\/|$)|.*\.(?:pem|key|p12|pfx|sqlite|sqlite3|db|map)$)/i.test(name)) throw new Error('Forbidden artifact path: ' + name);
    if (entry.isDirectory()) { Object.assign(result, await inventory(root, name)); continue; }
    const bytes = await readFile(join(root, name));
    if (DENIED_CONTENT.some(pattern => pattern.test(bytes.toString('utf8')))) throw new Error('Potential credential in artifact: ' + name);
    if (name !== RECEIPT) result[name] = createHash('sha256').update(bytes).digest('hex');
  }
  return result;
}

export async function prepareDomain(dist, sourceSha, verificationScope = 'source-verified') {
  if (!SHA.test(sourceSha)) throw new Error('Invalid source SHA');
  sourceBuildCommands(verificationScope);
  // Validate all transformations before any file is changed.
  const changes = {};
  let index = await readFile(join(dist, 'index.html'), 'utf8');
  index = replaceOnce(index, 'property="og:url" content="' + OLD_ORIGIN + '"', 'property="og:url" content="' + ORIGIN + '"', 'og URL');
  index = replaceOnce(index, 'rel="canonical" href="' + OLD_ORIGIN + '"', 'rel="canonical" href="' + ORIGIN + '"', 'canonical');
  changes['index.html'] = index;
  for (const name of LEGAL_FILES) changes[name] = patchDocument(name, await readFile(join(dist, name), 'utf8'));
  changes['migration.html'] = migrationPage();
  await inventory(dist);
  for (const [name, text] of Object.entries(changes)) await writeFile(join(dist, name), text);
  const files = await inventory(dist);
  const receipt = { schemaVersion: 1, sourceRepository: SOURCE_REPO, sourceSha, verificationScope, sourceRegressionGate: verificationScope === 'source-verified' ? 'required' : 'separate-not-claimed-as-passed', reviewedBaselineSha: REVIEWED_SHA, domain: ORIGIN, accountMode: 'off', originPreserved: true, originPreservedMeaning: 'This workflow does not modify the old origin or its repository; browser storage availability is not a server guarantee.', buildEnvironment: accountOffEnvironment(), files };
  await writeFile(join(dist, RECEIPT), JSON.stringify(receipt, null, 2) + '\n');
  await verifyDist(dist, sourceSha);
  return receipt;
}

export async function verifyDist(dist, expectedSha, expectedVerificationScope) {
  const receipt = JSON.parse(await readFile(join(dist, RECEIPT), 'utf8'));
  sourceBuildCommands(receipt.verificationScope ?? 'source-verified');
  if (expectedVerificationScope !== undefined && receipt.verificationScope !== expectedVerificationScope) throw new Error('Receipt verification scope mismatch');
  if (!SHA.test(expectedSha) || receipt.sourceSha !== expectedSha || receipt.accountMode !== 'off' || receipt.originPreserved !== true || receipt.sourceRepository !== SOURCE_REPO || receipt.domain !== ORIGIN) throw new Error('Receipt contract mismatch');
  assertAccountOff(receipt.buildEnvironment);
  const actual = await inventory(dist);
  if (JSON.stringify(actual) !== JSON.stringify(receipt.files)) throw new Error('Artifact hash/inventory mismatch');
  return receipt;
}

async function buildSource(source) {
  if (process.versions.node !== '24.19.0') throw new Error('Production build requires Node 24.19.0');
  for (const dir of [source, join(source, 'app')]) {
    if ((await readdir(dir)).some(name => /^\.env(?:$|\.)/.test(name) && name !== '.env.example')) throw new Error('Source dotenv files are forbidden');
  }
  const cwd = join(source, 'app');
  const env = accountOffEnvironment(process.env);
  assertAccountOff(env);
  const scope = process.env.DOMAIN_BUILD_SCOPE || 'source-verified';
  const commands = sourceBuildCommands(scope);
  console.log('Build verification scope: ' + scope + '; typecheck, hosted OFF validation and production build are mandatory.');
  for (const args of commands) {
    if (args[0] === 'run' && args[1] === 'build') {
      const validator = spawnSync(process.execPath, ['scripts/validate-hosted-release-env.mjs'], { cwd, env, stdio: 'inherit' });
      if (validator.status !== 0) throw new Error('Hosted validator rejected OFF environment');
    }
    // Linux Actions runner only. Never echo environment values.
    const commandEnv = args[0] === 'test' ? sourceTestEnvironment(process.env) : env;
    if (args[0] !== 'test') assertAccountOff(commandEnv);
    const run = spawnSync('npm', args, { cwd, env: commandEnv, stdio: 'inherit' });
    if (run.status !== 0) throw new Error('Failed npm step: ' + args.join(' '));
  }
}

async function cli() {
  const [command, arg1, arg2] = process.argv.slice(2);
  if (command === 'resolve-source') {
    const head = await mainSha();
    const sourceSha = selectSha(process.env.REQUESTED_SOURCE_SHA ?? '', head);
    const verificationScope = process.env.DOMAIN_BUILD_SCOPE || 'source-verified';
    sourceBuildCommands(verificationScope);
    const info = { sourceSha, mainShaAtResolution: head, verificationScope, archiveUrl: 'https://codeload.github.com/' + SOURCE_REPO + '/tar.gz/' + sourceSha };
    await writeFile(arg1, JSON.stringify(info, null, 2) + '\n');
  } else if (command === 'assert-main') {
    const info = JSON.parse(await readFile(arg1, 'utf8'));
    selectSha(info.sourceSha, await mainSha());
  } else if (command === 'build') {
    await buildSource(resolve(arg1));
  } else if (command === 'prepare' || command === 'verify') {
    const info = JSON.parse(await readFile(arg2, 'utf8'));
    await (command === 'prepare' ? prepareDomain : verifyDist)(resolve(arg1), info.sourceSha, info.verificationScope || 'source-verified');
  } else {
    throw new Error('Usage: resolve-source info.json | assert-main info.json | build source | prepare/verify dist info.json');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  cli().catch(error => { console.error(error.message); process.exitCode = 1; });
}
