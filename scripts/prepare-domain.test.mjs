import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { accountOffEnvironment, sourceTestEnvironment, assertAccountOff, selectSha, patchDocument, migrationPage, prepareDomain, verifyDist, REVIEWED_SHA, OLD_EMAIL, NEW_EMAIL, OLD_ORIGIN, ORIGIN } from './prepare-domain.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const files = ['legal/privacy.html', 'legal/terms.html', 'legal/device-integrations.html', 'support.html'];
const contact = '<a href="mailto:' + OLD_EMAIL + '">' + OLD_EMAIL + '</a>';
const fixture = {
  'index.html': '<html><meta property="og:url" content="' + OLD_ORIGIN + '" /><link rel="canonical" href="' + OLD_ORIGIN + '" /><div id="root"></div><script src="./assets/main.js"></script></html>',
  'legal/privacy.html': '<p>기타 개인정보처리방침 본문 그대로</p>' + contact,
  'legal/terms.html': '<p>기타 이용약관 본문 그대로</p>' + contact,
  'legal/device-integrations.html': contact + '\n    <h2>받으려는 정보</h2>\n<p>기타 수집·삭제 내용 그대로</p>',
  'support.html': '<p>최근 확인: 2026년 8월 29일</p><p><strong>공식 연동 신청은 완료됐고 제공자 검토를 기다리고 있습니다.</strong> 승인 여부와 시점은 Garmin·COROS가 결정합니다. 지금은 두 계정을 연결할 수 없습니다.</p><h2>제공자 검토 대기 중인 공식 자동 연동</h2><table><tr><td>Garmin</td><td>공식 개발자 프로그램 신청 완료 · 제공자 검토 대기</td></tr><tr><td>COROS</td><td>공식 API 신청 완료 · 제공자 검토 대기</td></tr></table>' + contact,
};

async function withDist(callback) {
  const dist = await mkdtemp(join(project, '.test-dist-'));
  try {
    await mkdir(join(dist, 'legal'));
    await mkdir(join(dist, 'assets'));
    for (const [name, text] of Object.entries(fixture)) await writeFile(join(dist, name), text);
    await writeFile(join(dist, 'assets/main.js'), 'console.log("same-app");');
    await callback(dist);
  } finally { await rm(dist, { recursive: true, force: true }); }
}

test('latest main default, exact full SHA only, no stale/branch SHA', () => {
  assert.equal(selectSha('', REVIEWED_SHA), REVIEWED_SHA);
  assert.equal(selectSha(REVIEWED_SHA, REVIEWED_SHA), REVIEWED_SHA);
  for (const value of ['main', '0eb26e4', '; echo wrong', 'a'.repeat(40)]) assert.throws(() => selectSha(value, REVIEWED_SHA));
  assert.throws(() => selectSha({}, REVIEWED_SHA));
});

test('OFF environment strips credentials and inherited VITE values; dev dependencies remain installable', () => {
  const env = accountOffEnvironment({ PATH: '/safe/bin', GITHUB_TOKEN: 'fixture-only', VITE_ACCOUNT_PUBLIC_ENABLED: 'true', VITE_UNREVIEWED_KEY: 'fixture-only', NODE_ENV: 'production' });
  assertAccountOff(env);
  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.VITE_UNREVIEWED_KEY, undefined);
  assert.equal(env.NODE_ENV, undefined);
  assert.equal(env.VITE_SUPABASE_ANON_KEY, '');
  assert.equal(env.VITE_KILL_SHARING, 'true');
  assert.equal(env.VITE_FEATURE_ACCOUNT_JOURNAL, 'false');
  assert.throws(() => assertAccountOff({ ...env, VITE_GOOGLE_AUTH_ENABLED: 'true' }));
});

test('lounge and minigame remote progress stay OFF; unreviewed VITE settings fail closed', () => {
  const env = accountOffEnvironment({ VITE_LOUNGE_PUBLIC_ENABLED: 'true', VITE_LOUNGE_REALTIME_URL: 'https://fixture.invalid', VITE_LOUNGE_PAGE_URL: 'https://fixture.invalid' });
  assert.equal(env.VITE_LOUNGE_PUBLIC_ENABLED, 'false');
  assert.equal(env.VITE_LOUNGE_REALTIME_URL, '');
  assert.equal(env.VITE_LOUNGE_PAGE_URL, '');
  assert.equal(env.VITE_KILL_MINIGAME_PROGRESS, 'true');
  assertAccountOff(env);
  assert.throws(() => assertAccountOff({ ...env, VITE_LOUNGE_PUBLIC_ENABLED: 'true' }));
  assert.throws(() => assertAccountOff({ ...env, VITE_UNREVIEWED_NETWORK_ENABLED: 'true' }), /Unreviewed VITE setting/);
});

test('friend arena is explicitly OFF, discards inherited URLs and requires the exact empty string', () => {
  const base = { VITE_FRIEND_ARENA_URL: 'wss://arena.example.invalid' };
  const env = accountOffEnvironment(base);
  assert.equal(base.VITE_FRIEND_ARENA_URL, 'wss://arena.example.invalid');
  assert.ok(Object.hasOwn(env, 'VITE_FRIEND_ARENA_URL'));
  assert.equal(env.VITE_FRIEND_ARENA_URL, '');
  assertAccountOff(env);
  for (const value of [base.VITE_FRIEND_ARENA_URL, ' ', undefined, null, false]) {
    assert.throws(() => assertAccountOff({ ...env, VITE_FRIEND_ARENA_URL: value }), /Account-OFF contract mismatch: VITE_FRIEND_ARENA_URL/);
  }
});

test('source tests isolate feature fixtures while stripping credentials; production OFF remains unchanged', async () => {
  const production = accountOffEnvironment({ PATH: '/safe/bin', GITHUB_TOKEN: 'fixture-only', VITE_ACCOUNT_PUBLIC_ENABLED: 'true' });
  const before = JSON.stringify(production);
  const env = sourceTestEnvironment({ ...production, GITHUB_TOKEN: 'fixture-only', VITE_UNREVIEWED_KEY: 'fixture-only', VITE_FRIEND_ARENA_URL: 'wss://arena.example.invalid' });
  assert.equal(env.PATH, '/safe/bin');
  assert.equal(env.CI, 'true');
  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.ok(Object.keys(env).every(key => !key.startsWith('VITE_')));
  assert.equal(JSON.stringify(production), before);
  assertAccountOff(production);
  const script = await readFile(join(project, 'scripts/prepare-domain.mjs'), 'utf8');
  assert.match(script, /args\[0\] === 'test' \? sourceTestEnvironment\(process\.env\) : env/);
  assert.match(script, /args\[0\] !== 'test'\) assertAccountOff\(commandEnv\)/);
  assert.match(script, /env: commandEnv, stdio: 'inherit'/);
});

test('privacy/terms remain byte-identical except contact', () => {
  for (const name of ['legal/privacy.html', 'legal/terms.html']) assert.equal(patchDocument(name, fixture[name]), fixture[name].replaceAll(OLD_EMAIL, NEW_EMAIL));
});

test('Garmin dated pause with unknown restart, COROS unchanged; upstream drift rejected', () => {
  const support = patchDocument('support.html', fixture['support.html']);
  assert.match(support, /2026년 10월 9일/);
  assert.match(support, /신규 심사·승인 잠정 중단/);
  assert.match(support, /재개일 미정/);
  assert.match(support, /자동 연동 미공개/);
  assert.ok(support.includes('<tr><td>COROS</td><td>공식 API 신청 완료 · 제공자 검토 대기</td></tr>'));
  assert.throws(() => patchDocument('support.html', fixture['support.html'].replace('최근 확인:', '문서 변경:')));
  const device = patchDocument('legal/device-integrations.html', fixture['legal/device-integrations.html']);
  assert.match(device, /자동 연동은 아직 공개되지 않았습니다/);
});

test('migration notice keeps old origin link and disclaims complete restoration, no scripts/redirect', () => {
  const page = migrationPage();
  assert.ok(page.includes(OLD_ORIGIN));
  assert.match(page, /같은 원본의 전체 앱/);
  assert.match(page, /계정 로그인/);
  assert.match(page, /완전한 복원을 약속하지 않습니다/);
  assert.doesNotMatch(page, /http-equiv|<script|location\./i);
});

test('prepare preserves application bytes, produces receipt and verifies every file hash', async () => withDist(async dist => {
  const before = await readFile(join(dist, 'assets/main.js'));
  const receipt = await prepareDomain(dist, REVIEWED_SHA);
  assert.equal(receipt.sourceSha, REVIEWED_SHA);
  assert.equal(receipt.accountMode, 'off');
  assert.equal(receipt.originPreserved, true);
  assert.deepEqual(await readFile(join(dist, 'assets/main.js')), before);
  const index = await readFile(join(dist, 'index.html'), 'utf8');
  assert.equal(index, fixture['index.html'].replaceAll(OLD_ORIGIN, ORIGIN));
  await verifyDist(dist, REVIEWED_SHA);
  await writeFile(join(dist, 'assets/main.js'), 'modified');
  await assert.rejects(verifyDist(dist, REVIEWED_SHA), /hash\/inventory/);
}));

test('receipt mode/SHA and extra files cannot bypass verification', async () => withDist(async dist => {
  await prepareDomain(dist, REVIEWED_SHA);
  await assert.rejects(verifyDist(dist, 'b'.repeat(40)), /Receipt contract/);
  const path = join(dist, 'trainoracle-domain-receipt.json');
  const receipt = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify({ ...receipt, accountMode: 'on' }));
  await assert.rejects(verifyDist(dist, REVIEWED_SHA), /Receipt contract/);
  await writeFile(path, JSON.stringify(receipt));
  await writeFile(join(dist, 'unexpected.txt'), 'extra');
  await assert.rejects(verifyDist(dist, REVIEWED_SHA), /hash\/inventory/);
}));

test('credential literals and database exports fail closed without printing their contents', async () => {
  await withDist(async dist => {
    await writeFile(join(dist, 'assets/bad.js'), 'sb_' + 'secret_' + 'x'.repeat(24));
    await assert.rejects(prepareDomain(dist, REVIEWED_SHA), /Potential credential/);
  });
  await withDist(async dist => {
    await writeFile(join(dist, 'user.sqlite'), 'synthetic');
    await assert.rejects(prepareDomain(dist, REVIEWED_SHA), /Forbidden artifact path/);
  });
});

test('workflow has only requested events, isolated repo, safe concurrency and pre-deploy checks', async () => {
  const workflow = await readFile(join(project, '.github/workflows/publish.yml'), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /repository_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+(?:schedule|push|pull_request):/);
  assert.match(workflow, /hojune0330\/TRAINORACLE-DOMAIN/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /24\.19\.0/);
  assert.doesNotMatch(workflow, /contents: write|git push|secrets\./);
  const upload = workflow.indexOf('uses: actions/upload-pages-artifact');
  const deploy = workflow.indexOf('uses: actions/deploy-pages');
  const verify = workflow.lastIndexOf('node scripts/prepare-domain.mjs verify');
  const mainCheck = workflow.lastIndexOf('node scripts/prepare-domain.mjs assert-main');
  assert.ok(workflow.indexOf('node scripts/prepare-domain.mjs verify') < upload);
  assert.ok(upload < verify && verify < deploy && mainCheck < deploy);
});

test('optional actual read-only source: hosted validator and exact legal-document preservation', { skip: !process.env.TRAINORACLE_TEST_SOURCE }, async () => {
  const source = resolve(process.env.TRAINORACLE_TEST_SOURCE);
  const validator = await import(pathToFileURL(join(source, 'app/scripts/validate-hosted-release-env.mjs')).href);
  assert.deepEqual(validator.validateHostedReleaseEnvironment(accountOffEnvironment()), []);
  const originals = {};
  for (const file of files) originals[file] = await readFile(join(source, 'app/public', file), 'utf8');
  for (const file of ['legal/privacy.html', 'legal/terms.html']) assert.equal(patchDocument(file, originals[file]), originals[file].replaceAll(OLD_EMAIL, NEW_EMAIL));
  const support = patchDocument('support.html', originals['support.html']);
  const coros = originals['support.html'].match(/<tr><td>COROS<\/td>.*?<\/tr>/)[0];
  assert.ok(support.includes(coros));
  patchDocument('legal/device-integrations.html', originals['legal/device-integrations.html']);
  // Do not write into source: verify input bytes remained untouched.
  for (const file of files) assert.equal(await readFile(join(source, 'app/public', file), 'utf8'), originals[file]);
});
