# 개발 업무 인수인계서 (HANDOVER.md)

이 문서는 후임 개발자가 VOW SEOUL 모바일 청첩장 웹 애플리케이션의 개발을 즉시 이어받아 진행하기 위해 파악해야 하는 시작 지점, 설계상 주의사항 및 코드 준수 기준을 명시합니다.

---

## 1. 업무 시작 및 로컬 설정 (Start Point)

### 1.1 저장소 및 브랜치
* **저장소**: https://github.com/vowseoul/vowseoul_mwi_ver2.git
* **기본 작업 브랜치**: `main`

### 1.2 로컬 설정 절차
1. 프로젝트 루트 경로의 `.env.local` 파일 내 Supabase 키 정보가 제대로 등록되어 있는지 확인합니다.
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://yhggegrobxpjgygkdnyz.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
2. 패키지 의존성을 설치하고 로컬 개발 서버를 구동합니다.
   ```bash
   pnpm install
   pnpm dev
   ```
3. 웹 브라우저로 `http://localhost:3000`에 접속합니다. 루트(`/`)에서 `/admin` 대시보드로 자동 리다이렉트가 처리되는지 확인합니다.
4. 관리자 기능 접근을 테스트하려면 Supabase `profiles` 테이블에 해당 계정 ID의 `role` 컬럼 값이 `'ADMIN'`으로 지정되어 있어야 합니다.

---

## 2. 개발 시 강력히 주의할 점 (Caveats & Watchouts)

이 프로젝트의 품질과 안정성을 유지하기 위해 코드를 고치거나 새로 작성할 때 반드시 아래 규칙들을 지켜주십시오.

### 2.1 리액트 훅 호출 순서 규칙 (React Error #310 방지)
* **주의**: `useState`, `useEffect`, `use` 등의 모든 React 훅은 컴포넌트 함수 시작 직후 **최상단에서 무조건 조건 없이 선언**되어야 합니다.
* **금지 행동**: `if (isLoading) return ...` 이나 `if (!unlocked) return ...` 과 같은 조기 반환(Early Return) 코드 아래에 훅을 선언하면 컴포넌트 렌더링 도중 훅 실행 순서가 꼬여 React 런타임이 완전히 붕괴(`Minified React error #310`)됩니다.

### 2.2 폰트 스타일 선언 규칙 (Pretendard Font OTS 에러 방지)
* **주의**: Next.js 빌드 환경에서 프리미엄 Pretendard 웹폰트를 깨짐 없이 디코딩하려면 `@font-face` 개별 선언 대신 CSS 파일 최상단에서 아래 `@import` 구문으로 가져와야 합니다.
* **적용 위치**: `app/globals.css` 최상단
  ```css
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
  ```

### 2.3 Supabase 단일 행 조회 API 제한
* **주의**: 설정값이나 단일 유저 데이터를 쿼리할 때, 데이터가 없을 가능성이 있는 경우 Supabase 쿼리 빌더 끝에 `.single()`을 쓰지 마십시오. 결과가 0건일 시 API 통신이 차단(HTTP 406)되므로 반드시 `.maybeSingle()`을 이용해 안전하게 처리하십시오.

### 2.4 외부 아이콘 추가 시 수동 Import 검증
* **주의**: `lucide-react` 아이콘(예: `Trash2`, `Plus` 등)을 추가로 사용할 때는 컴파일러가 자동 임포트하지 못하는 경우가 있으므로, 파일 상단에 명시적으로 추가되었는지 꼭 체크하십시오. 누락 시 빌드가 실패하거나 페이지 접속 시 빈 화면이 나타납니다.

---

## 3. 작업 완료 및 배포 검증 기준 (Completion Standards)

수정사항이 완결된 후 원격 배포하기 위해 통과해야 하는 기준입니다.

1. **로컬 빌드 검증 성공**:
   `pnpm build` (혹은 `npm run build`) 실행 시 에러나 경고 없이 컴파일 결과물이 성공적으로 생성되어야 합니다.
2. **반응형 모바일 화면 체크**:
   크롬 검사 도구의 디바이스 모드(375px 이하 해상도)에서 모바일 헤더 자르기, 텍스트 넘침, 스크롤 꼬임 및 오디오 재생 무반응 현상이 없어야 합니다.
3. **오작동 이중 장치 유효성 확인**:
   고객이 입력하는 폼 페이지의 `localStorage` 백업 값과 DB 저장 스토어가 서로 간섭을 일으키거나 올바르지 않은 시점에 데이터가 리셋되지 않는지 검사하십시오.
