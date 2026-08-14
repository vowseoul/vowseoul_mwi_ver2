# 분기별 의존성 감사 프로세스

VOW SEOUL은 CI에 자동 의존성 스캔(Dependabot 등)이 연결되어 있지 않다. 그 공백을 메우기 위해
**분기(3개월)에 한 번**, 아래 체크리스트를 그대로 실행한다. 소요 시간은 보통 30분 이내 —
실제로 손이 가는 업데이트가 있을 때만 늘어난다.

## 언제

- 1월, 4월, 7월, 10월 첫 주 중 아무 때나(정확한 날짜보다 "분기당 최소 1회"가 중요하다).
- 그 외에도 `pnpm audit`에서 **high/critical**이 새로 뜨면 다음 분기를 기다리지 않고 바로 처리한다.

## 체크리스트

```bash
pnpm outdated   # 버전이 뒤처진 패키지 목록
pnpm audit      # 알려진 보안 취약점 스캔
```

1. **`pnpm audit`부터 본다.** 취약점은 버전 차이보다 우선순위가 높다.
   - 직접 의존성(`package.json`에 있는 패키지)이 원인이면 `pnpm add <pkg>@<patched>`로 바로 올린다.
   - 전이 의존성(다른 패키지가 물고 온 것)이 원인이면 `pnpm why <pkg>`로 어디서 들어오는지 먼저
     확인한다. leaf 패키지(런타임 API 표면이 없는 내부 유틸, 예: `nanoid`/`js-yaml`/`brace-expansion`)면
     `pnpm-workspace.yaml`의 `overrides`로 강제 승급해도 안전하다. 런타임에 실제로 쓰이는
     패키지(예: `lodash`, `ws`)면 override보다 상위 패키지 자체의 업데이트/마이그레이션을 우선한다.
2. **`pnpm outdated`로 나머지를 본다.** 패치/마이너는 대체로 바로 올려도 된다. **메이저**
   버전(예: `recharts` 2.x → 3.x)은 breaking change 여지가 있으니 별도 작업 티켓으로 분리하고,
   이 감사 세션 안에서 무리하게 진행하지 않는다.
3. **`next`/`@sentry/nextjs`/`eslint-config-next`는 세트로 맞춰서 올린다.** Next.js는 마이너
   릴리스에도 보안 패치가 자주 포함되므로(미들웨어 우회, DoS, SSRF 등) 이 셋은 특히
   최신 마이너를 우선한다.
4. 업데이트 후 반드시 순서대로 확인한다 — 하나라도 깨지면 그 라운드의 업데이트를 되돌린다.
   ```bash
   pnpm typecheck
   pnpm test
   pnpm run build
   ```
5. 이 문서의 "감사 기록" 표에 한 줄을 추가한다. 다음 분기 담당자가 "그때 왜 이건 안 올렸는지"를
   바로 알 수 있게 — 특히 의도적으로 미룬 항목(메이저 마이그레이션 등)은 이유를 남긴다.

## 판단 기준

- **바로 올린다**: 패치/마이너 버전, 특히 보안 패치가 포함된 경우.
- **override로 강제 승급**: 전이 의존성이고, 상위 패키지가 아직 안 올렸고, 해당 패키지가
  런타임 로직에 관여하지 않는 빌드/린트 툴체인 내부 leaf 패키지인 경우.
- **별도 작업으로 분리(이 세션에서 손대지 않는다)**: 메이저 버전(breaking change 가능성),
  또는 코드 전반에 걸친 API 사용 변경이 필요한 경우.

## 감사 기록

| 날짜 | 처리 내용 | 남은 것 / 이유 |
|---|---|---|
| 2026-08-15 | `pnpm audit` 38건(23 high) → 3건으로 축소. `next` 16.2.0→16.3.0(+`eslint-config-next` 동반, 미들웨어 우회/DoS/SSRF 등 Next.js 자체 CVE 다수 해소), `postcss` 8.5.6→8.5.26, `@supabase/supabase-js`/`@supabase/ssr` 최신화. `nanoid`/`js-yaml`/`brace-expansion`은 eslint 툴체인 내부 leaf라 `pnpm-workspace.yaml` override로 강제 패치. `pnpm typecheck`/`pnpm test`/`pnpm run build` 전부 통과 확인. | 남은 3건(`lodash`, high 2 + moderate 1)은 전부 `recharts@2.15.0`(2.x 브랜치 EOL, 공식적으로 3.x만 유지보수됨)이 물고 온 것. `recharts` v3는 breaking change가 있어(마이그레이션 가이드: https://github.com/recharts/recharts/wiki/3.0-migration-guide) 통계 페이지(`app/admin/(dashboard)/statistics/page.tsx`) 차트 전수 재검토가 필요한 별도 작업으로 분리. |

---

관련: CI는 `pnpm typecheck`/`pnpm test`를 필수 체크로, `pnpm lint`는 기존 레거시 오류가
정리될 때까지 정보성(non-blocking) 체크로 돈다 (`.github/workflows/ci.yml`).
