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
   `pnpm lint`를 빼먹지 않는다 — typecheck/test/build가 전부 통과해도 override가 ESLint
   자체를 크래시시키는 경우가 있었다(§감사 기록 2026-08-15 두 번째 줄. eslint는 실행 자체가
   안 되면 조용히 "통과"로 보이는 게 아니라 매번 에러 코드로 죽으므로 CI에서는 잡히지만,
   로컬에서 typecheck/test/build만 돌리고 넘어가면 놓치기 쉽다).
   ```bash
   pnpm typecheck
   pnpm test
   pnpm lint
   pnpm run build
   ```
5. 이 문서의 "감사 기록" 표에 한 줄을 추가한다. 다음 분기 담당자가 "그때 왜 이건 안 올렸는지"를
   바로 알 수 있게 — 특히 의도적으로 미룬 항목(메이저 마이그레이션 등)은 이유를 남긴다.

## 판단 기준

- **바로 올린다**: 패치/마이너 버전, 특히 보안 패치가 포함된 경우.
- **override로 강제 승급**: 전이 의존성이고, 상위 패키지가 아직 안 올렸고, 해당 패키지가
  런타임 로직에 관여하지 않는 빌드/린트 툴체인 내부 leaf 패키지인 경우. 단, 같은 패키지가
  서로 다른 major 버전으로 트리에 동시에 존재하면(예: 오래된 소비자는 v1 API를, 새 소비자는
  v5 API를 기대) **override는 신중하게** — pnpm-workspace.yaml의 `pkg@1: 'range'` /
  `pkg@5: 'range'` 처럼 소비자가 요청한 버전대별로 나눈 override나 `parent>pkg: 'range'`
  같은 경로 한정 override가 항상 의도대로 그 소비자에만 적용된다고 가정하지 않는다 —
  버전이 다르면 API도 다를 수 있어, 잘못 스코프되면 오래된 소비자가 새 major를 받아
  조용히 깨진다(§감사 기록 2026-08-15 두 번째 줄 — `brace-expansion` override가 ESLint
  자체를 크래시시켰다). 안전하게 스코프할 수 없으면 차라리 override를 포기하고 "남은 것"
  칸에 사유를 남긴다 — 툴체인이 도는 게 취약점 하나 안 남기는 것보다 우선한다.
- **별도 작업으로 분리(이 세션에서 손대지 않는다)**: 메이저 버전(breaking change 가능성),
  또는 코드 전반에 걸친 API 사용 변경이 필요한 경우.

## 감사 기록

| 날짜 | 처리 내용 | 남은 것 / 이유 |
|---|---|---|
| 2026-08-15 | `pnpm audit` 38건(23 high) → 3건으로 축소. `next` 16.2.0→16.3.0(+`eslint-config-next` 동반, 미들웨어 우회/DoS/SSRF 등 Next.js 자체 CVE 다수 해소), `postcss` 8.5.6→8.5.26, `@supabase/supabase-js`/`@supabase/ssr` 최신화. `nanoid`/`js-yaml`/`brace-expansion`은 eslint 툴체인 내부 leaf라 `pnpm-workspace.yaml` override로 강제 패치. `pnpm typecheck`/`pnpm test`/`pnpm run build` 전부 통과 확인. | 남은 3건(`lodash`, high 2 + moderate 1)은 전부 `recharts@2.15.0`(2.x 브랜치 EOL, 공식적으로 3.x만 유지보수됨)이 물고 온 것. `recharts` v3는 breaking change가 있어(마이그레이션 가이드: https://github.com/recharts/recharts/wiki/3.0-migration-guide) 통계 페이지(`app/admin/(dashboard)/statistics/page.tsx`) 차트 전수 재검토가 필요한 별도 작업으로 분리. |
| 2026-08-15 (후속) | 위 `brace-expansion` override가 실은 **ESLint를 완전히 크래시**시키고 있었다(`TypeError: expand is not a function` — minimatch@3.1.5는 brace-expansion v1의 함수형 export를 기대하는데, `pkg@1`/`pkg@5` 두 버전대로 나눈 override가 의도대로 스코프되지 않고 v5가 minimatch에도 적용됐다. `minimatch>brace-expansion` 경로 한정 override로 바꿔도 재현됨). typecheck/test/build만 돌리고 `pnpm lint`를 안 돌려서 그때는 못 잡았다. brace-expansion override를 완전히 제거 — 재설치해보니 eslint 툴체인 쪽 트리가 자연 해소되어(`eslint-config-next` 16.3.0 반영 이후) 이제 override 없이도 정상 동작하고 `pnpm audit`도 2건(lodash만 남음)으로 오히려 더 줄었다. `pnpm typecheck`/`pnpm test`/`pnpm lint`/`pnpm run build` 전부 재확인. | 위 체크리스트 4번에 `pnpm lint`를 추가하고, "판단 기준"에 버전대별 override 스코프 주의사항을 남겼다. |

---

관련: CI는 `pnpm typecheck`/`pnpm test`를 필수 체크로, `pnpm lint`는 기존 레거시 오류가
정리될 때까지 정보성(non-blocking) 체크로 돈다 (`.github/workflows/ci.yml`).
