# TRAINORACLE-DOMAIN 전용 도메인 배포

## 명시적 계정 공개 모드 — 2026-11-05 준비

수동 게시의 기본값은 계속 `account_mode=off`입니다. `repository_dispatch`는 공개
설정 변수가 있으면 canonical 모드를 유지하고, 없으면 OFF로 게시합니다. 설정이
잘못되면 게시를 중단하며 OFF로 대체하지 않습니다. canonical 모드에서는 이 문서의
OFF 환경·빈 연결·OFF receipt 규칙 대신 검증된 공개 설정을 사용합니다. 원본
`TRAINORACLE`의 `gh-pages` 빌더와 계정 차단은 변경하지 않습니다. 이 저장소는
Actions Pages 방식이므로 원본 `gh-pages:CNAME`이나 새 CNAME 파일을 요구하지 않습니다.

1. 운영 담당자가 `TRAINORACLE_CANONICAL_ACCOUNT_CONFIG` 저장소 **변수**에 공개 JSON을
   등록합니다. 최상위는 `canonicalOrigin: "https://trainoracle.io"`, 회사 서버의 정확한
   HTTPS `gatewayOrigin`, `environment`뿐입니다. `environment`의 허용 항목은
   `scripts/canonical-account-config.mjs`에 한정됩니다. Supabase URL과 검증된
   publishable/anon 키만 브라우저에 넣으며, service-role·암호화·서명 키는 거절합니다.
2. 계정·일지·Garmin 기능 true와 대응 kill false, 정확한 회사 gateway 두 경로
   또는 같은 Supabase 프로젝트의 Garmin function과 빈 journal gateway override,
   Garmin authorization origin, 11월 4일 법률 문서와 저장 공개 승인/0058 표기,
   운영 확인된 인증수단 하나 이상을 모두 명시합니다. 이메일·전화의 기존 별도
   운영 승인도 필요합니다. 공유·일반 동기화·AI 코칭은 이 모드가 열지 않습니다.
3. `workflow_dispatch`에서 정확한 `source_sha`와 `account_mode=canonical`을 선택합니다.
   이후 `repository_dispatch`도 이 공개 설정이 존재하면 canonical을 유지합니다.
   명시적 수동 `account_mode=off`는 공개 설정이 있어도 그대로 적용합니다.
   실행 저장소/브랜치가 정확히
   `hojune0330/TRAINORACLE-DOMAIN`의 `main`이어야 합니다. 기존 타입 검사·선택한 원본
   검사 범위·원본 hosted validator·빌드·동일 산출물 재검증·최신 main 검사는 유지합니다.
4. receipt는 `accountMode: "canonical"`, 공개 설정 지문과 `backendVerification:
   "NOT_CONFIRMED"`를 기록합니다. 배포 직전에도 같은 변수와 artifact의 설정을
   대조하므로 실행 도중 설정이 바뀌면 중단합니다. 정확히 검증한 공개 키 문자열만
   artifact scanner가 허용하며 다른 키·JWT·비밀 패턴은 계속 거절합니다.

로컬에서 공개 JSON 파일만 읽어 설정을 확인할 수 있습니다. 네트워크·빌드·게시를
수행하지 않으며 키 문자열을 출력하지 않습니다.

```powershell
node scripts/prepare-domain.mjs inspect-account <public-config.json>
```

이 설정 검사는 운영 DB의 저장 검토·Origin·기존 암호화 키 재사용·사용자 동의·실제
OAuth나 기록 수신의 성공 증거가 아닙니다. 원본의 제공자 상태·정책 본문은 계속
원본 책임자가 갱신하며, 게시기는 연락처와 공개 모드에 맞는 주소 보존 안내만 바꿉니다.

대상은 별도 **PUBLIC** 저장소 `hojune0330/TRAINORACLE-DOMAIN`의 `main`뿐입니다. 원본 `hojune0330/TRAINORACLE`의 코드, `gh-pages`, `previews/`, 기존 배포환경은 수정하지 않습니다. 이 저장소는 전용 도메인 배포 설정입니다. 실제 공개 상태는 Pages 배포 결과와 사이트의 배포 영수증으로 확인합니다.

## 파일

- `.github/workflows/publish.yml`: 수동 `workflow_dispatch`, `repository_dispatch`의 `publish-domain`만 받습니다. push·정기 작업 없음.
- `scripts/prepare-domain.mjs`: public main 확인, OFF 환경 빌드, 생성된 정적 문서 변경, receipt·해시 검증.
- `scripts/prepare-domain.test.mjs`: 네트워크 없이 계약·변환·법률 본문·해시·거절 경로 검증.

검토 기준 원본 SHA: `0eb26e4319c7e4fffb118976211c228cfa25e510`.

## 2026-10-17 웹·모바일 버전 통일

- 이번 통합 대상 원본: `b744917a2add6b5aff2f69442fd54a90e1522ed9`.
- `TRAINORACLE/main`과 구주소, 이 도메인, `TRAINORACLE-MOBILE` 후보가 같은 원본을 사용한다.
  각 저장소 자체의 커밋 번호는 역할이 다르므로 서로 같을 필요가 없다.
- 원본 필수 CI 통과를 확인한 뒤 `publish.yml`에 정확한 `source_sha`를 전달한다.
  같은 SHA의 원본 CI를 확인했다면 `domain-hosting` 범위는 타입·OFF 환경·빌드·파일 검증을
  다시 수행하며 원본 회귀검사 증거는 해당 CI 실행으로 구분한다. 실패를 통과로 바꾸지 않는다.
- 문서의 대상 SHA는 실제 배포 완료 증거가 아니다. Actions 결과와
  `https://trainoracle.io/trainoracle-domain-receipt.json`의 `sourceSha`를 함께 확인한다.
- 현재 GitHub Pages와 도메인·메일 DNS를 유지한다. Cloudflare 이전, 계정 공개,
  앱스토어 제출은 이 버전 통일의 범위가 아니다. 구주소의 자료 접근도 보존한다.

다음 갱신 때도 원본을 먼저 검수·고정하고 두 게시 저장소를 맞춘다. 모바일은
`release-config.json`의 원본 SHA와 후보 빌드를 함께 갱신한다. 설정만 바꿔 앱이
출시됐다고 표시하지 않는다.

### 배포 완료 확인 — 2026-10-17 01:48 KST

- [원본 필수 CI 38927995230](https://github.com/hojune0330/TRAINORACLE/actions/runs/38927995230) 성공. UTC/KST, 브라우저 4종의 두 실행 경로와 전용 저장·게임 검사를 포함한다. 자동 게시는 `[manual-pages]` 정책에 따라 생략하고 아래 수동 게시로 분리했다.
- [이 도메인 게시 38934316561](https://github.com/hojune0330/TRAINORACLE-DOMAIN/actions/runs/38934316561) 성공. 실제 공개 영수증의 원본은 위 통합 SHA와 일치하며 계정 OFF를 유지한다.
- 기존 GitHub 주소는 보존형 Pages 커밋 `f030e036444df5614547a3a118767b13e4e53474`로 게시했고 Pages `built` 및 공개 원본 SHA 일치를 확인했다. 이전 자산·미리보기는 삭제하지 않았다.
- [모바일 후보 38928117433](https://github.com/hojune0330/TRAINORACLE-MOBILE/actions/runs/38928117433)도 같은 원본의 웹 묶음·Android·iOS 검사를 통과했다. 앱스토어 출시는 아니다.
- 두 공개 웹 주소의 새 격리 모바일 브라우저에서 합성 JSON의 실제 Worker 처리, 확인 전 미저장, 확인 후 정확한 기기 저장을 확인했다. POST 요청·페이지 실행 오류는 0건이었다. 기존 사용자 기록·실계정·설치된 PWA 캐시 전환 검증은 포함하지 않는다.

위 내용은 해당 시점의 검증 기록이다. 다음 작업자는 원본의
`node .tools/check-release-channels.mjs`와 새 배포 결과를 다시 확인한다. 기존 주소·새 도메인·테스트 앱의 사용자 저장소는 자동 통합되지 않는다.

## 배포 순서와 제한

1. Node **24.19.0**. 검토한 원본 CI의 checkout/setup-node SHA를 재사용합니다.
2. `source_sha` 생략 시 실행 시점의 public `main` HEAD를 읽습니다. 입력 시 소문자 40자리 SHA이고 현재 main HEAD와 정확히 같아야 합니다. 구버전·브랜치·rollback 선택은 의도적으로 거절합니다.
3. SHA가 URL에 박힌 public codeload archive를 다운로드합니다. 브랜치 archive는 사용하지 않습니다. archive SHA-256은 전후 비교용이며 GitHub 외 독립적인 진위 보증은 아닙니다.
4. 별도 작업 복사본에서 `npm ci`, `npm run typecheck`, `npm test`, 원본 `validate-hosted-release-env.mjs`, `npm run build`. 앱 소스·원본 npm scripts를 수정하지 않습니다.
5. 계정·4종 인증·계정 일지·동기화·공유·계정 의존 기능·파일 분석·피드백 백엔드는 명시적으로 OFF/kill. Supabase 연결과 키는 빈 값, 보관 공개 승인은 false. runner의 임의 VITE 변수·자격증명을 상속하지 않으며 source `.env`도 거절합니다. 이 배포에 새 API 키나 secret은 필요 없습니다.
6. 빌드 **후 dist만** 변경합니다. index canonical/og:url → `https://trainoracle.io/`. privacy/terms/device-integrations/support의 이메일 → `hojune.jang@trainoracle.io`. privacy/terms의 다른 바이트는 보존합니다.
7. support/device-integrations의 제공자 상태·확인일·처리 정책은 검수한 원본 그대로 보존합니다. 2026-11-04부터 오래된 10월 9일 Garmin 심사 중단 문구로 다시 덮어쓰지 않습니다. 원본은 프로그램 승인, 실제 앱 권한·수신 준비, COROS 대기를 구분합니다. 게시기는 연락처와 구주소 보존 안내만 변경합니다.
8. `/migration.html`은 같은 원본의 전체 앱 제공, 계정 기능 미공개, 구주소 자료 접근 유지, origin별 저장공간 분리, 완전 복원 비보장을 안내합니다. 자동 redirect 없음. **구주소의 기존 repo에 custom domain을 설정하지 말 것**.
9. `trainoracle-domain-receipt.json`은 `sourceSha`, `accountMode: "off"`, `originPreserved: true`, 공개 OFF 설정 및 receipt 자신을 제외한 파일별 SHA-256을 기록합니다. `originPreserved`는 이 workflow가 구주소를 건드리지 않는다는 뜻이며, 개별 브라우저 자료의 존재·영구 보존 보증은 아닙니다.
10. 파일 경로·알려진 credential 패턴·해시·receipt·최신 main을 **artifact 업로드 전**, 그리고 내려받은 **동일 실행 artifact 배포 직전** 다시 검증합니다. main이 이동하면 중단합니다. Pages API 호출 직전 검증과 실제 수락 사이의 극소 시간 경합은 원본 저장소를 잠그지 않고 제거할 수 없습니다.
11. `upload-pages-artifact` → `deploy-pages`. 새 repo의 github-pages 환경만 사용합니다. concurrency는 고정 그룹, `cancel-in-progress: false`. contents write, git push, 원본 write, DB 작업은 없습니다.

## 보안·검증 범위

빌드는 public source와 빈 계정 연결만 사용하며 로컬 사용자 데이터·브라우저 저장공간·쿠키를 읽거나 복사하지 않습니다. dotfile, symlink, DB/key/PEM/sourcemap 파일 및 알려진 credential literal 패턴을 거절합니다. 정규식 검사는 모든 형태의 비밀값이나 public source에 잘못 커밋된 개인정보의 부재를 수학적으로 증명하지 못합니다. 배포 전 담당자가 산출물 목록·원본 공개 자산도 확인해야 합니다. receipt는 해시 목록이지 서명된 독립 감사 증명서가 아닙니다.

업스트림의 문서 앵커가 바뀌면 자동 치환하지 않고 실패합니다. 이는 법률 내용의 무단 변경을 막는 의도적인 fail-closed 동작입니다.

## 로컬 테스트

```powershell
node --test --test-isolation=none scripts/prepare-domain.test.mjs
```

제공된 로컬 원본을 읽기 전용으로 실제 변환 검증에 추가하려면:

```powershell
$env:TRAINORACLE_TEST_SOURCE = '원본 소스의 절대 경로'
node --test --test-isolation=none scripts/prepare-domain.test.mjs
```

`--test-isolation=none`은 현재 Windows 샌드박스의 자식 프로세스 제한을 피하기 위한 로컬 옵션이며 Actions에서는 기본 격리 테스트를 사용합니다.

테스트 임시 파일은 이 저장소 폴더 안에서만 만들고 정리합니다. 로컬에서 전체 원본 `npm ci`/typecheck/npm test/build 또는 GitHub Actions/Pages를 실행한 것으로 해석하면 안 됩니다. 실제 실행 여부는 별도 보고를 확인하세요.

## 부모 UI에서 남은 설정

새 PUBLIC repo 생성·이 파일 검토 후 게시, Pages Source를 GitHub Actions로 선택, 새 repo에만 root custom domain `trainoracle.io` 설정, DNS/HTTPS 확인, github-pages 환경 배포 보호 확인이 필요합니다. Actions 방식에서는 CNAME 파일을 넣지 않습니다. 구주소 접근·사용자 기존 기록·새 origin 저장·앱 화면은 실제 배포 후 별도 검증해야 합니다. Pages 관련 Action 3종은 2026-10-14 공식 저장소의 tag를 확인하여 불변 commit SHA로 고정했습니다.
