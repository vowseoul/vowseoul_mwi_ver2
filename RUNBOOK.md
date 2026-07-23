# 시스템 실행 및 장애 복구 지침서 (RUNBOOK.md)

이 문서는 VOW SEOUL 모바일 청첩장 웹 애플리케이션의 개발/운영 환경 빌드 방법, 로그 확인 경로 및 주요 고장 상황별 대처/복구 절차를 설명합니다.

---

## 1. 실행 및 빌드 명령 (Execution Commands)

본 프로젝트는 Next.js(v16.2.0, Turbopack)와 pnpm/npm 패키지 매니저를 사용합니다.

### 1.1 개발 서버 구동 (Local Development)
```bash
# 의존성 패키지 설치
pnpm install # 또는 npm install

# 로컬 개발 서버 실행 (Turbopack 활성화)
pnpm dev # 또는 npm run dev
```
* 로컬 서버 주소: http://localhost:3000 (또는 포트 충돌 시 3001 등)

### 1.2 배포 빌드 및 실행 (Production Build)
```bash
# Next.js 최적화 배포 빌드 생성
pnpm build # 또는 npm run build

# 빌드 결과물 실행
pnpm start # 또는 npm run start
```

---

## 2. 로그 및 오류 모니터링 위치 (Logs Location)

### 2.1 클라이언트(브라우저) 로그
* **위치**: Chrome 등 브라우저 DevTools (F12) Console 패널.
* **주요 검출 정보**: React 렌더링 생명주기 오류(예: Hook 순서 오류 #310), API 요청 에러(Supabase Rest API Status 404/406 등), localStorage 파싱 실패 로그.

### 2.2 개발/애플리케이션 서버 로그
* **위치**: 개발 서버 터미널 표준 출력(stdout/stderr) 혹은 Vercel/AWS ECS 등 배포 플랫폼의 서버 로그 탭.
* **주요 검출 정보**: Next.js Server Components API 라우트 연동 에러, Geocoding 외부 API 요청 실패.

### 2.3 데이터베이스 및 API 서버 로그
* **위치**: Supabase 관리자 콘솔 (`https://supabase.com/dashboard/project/<project-id>/logs`)
  * **Database Logs**: PostgreSQL의 슬로우 쿼리 및 제약조건 위반 추적.
  * **API Logs**: PostgREST 모듈의 RESTful API 요청 및 응답 코드 모니터링.
  * **Storage Logs**: 이미지 파일 업로드/다운로드 권한 및 스토리지 접근 로그.

---

## 3. 상황별 긴급 복구 절차 (Recovery Procedures)

### 3.1 DB 쿼리 오류 (HTTP 404 / 406 Not Acceptable 등)
* **상황**: 특정 페이지 진입 시 `.single()` 쿼리로 인해 0개의 행 반환 시 406 에러가 떨어지거나, 존재하지 않는 테이블(예: faqs, bgms 등) 조회 시 404가 발생할 때.
* **조치**:
  1. 테이블이 누락된 경우, `supabase_schema.sql` 스크립트를 Supabase SQL Editor를 통해 한 번 더 실행해 해당 테이블을 복구합니다.
  2. 조회 결과가 null일 수 있는 쿼리에는 JS Supabase Client에서 `.single()` 대신 반드시 `.maybeSingle()`을 사용하여 빈 결과가 에러로 터지지 않도록 예외 처리합니다.

### 3.2 갤러리 이미지 원본 고화질 다운로드 실패
* **상황**: 고객 응답 상세 페이지에서 첨부한 고화질 원본 이미지 다운로드 시 CORS 혹은 네트워크 끊김 현상 발생.
* **조치**:
  1. 스토리지 버킷의 보안 정책(RLS Policy)이 `public` 읽기/쓰기가 가능한 상태인지 Supabase Storage 메뉴에서 검사합니다.
  2. 스토리지 권한이 꼬인 경우, `create_storage_bucket.sql` 내 스크립트를 이용해 버킷과 정책을 다시 선언하십시오.
  3. 클라이언트 브라우저가 직접 URL 다운로드에 실패하는 경우 헬퍼 함수가 새 탭 열기(`window.open(imgUrl, '_blank')`)로 대체 동작하여 유실을 방지합니다.

### 3.3 고객의 폼 데이터 유실 혹은 모바일 오류 문의
* **상황**: 고객이 카카오톡 인-앱 브라우저 등을 통해 정보를 긴 내용으로 입력하던 중 링크가 꺼지거나 이탈하여 화면이 빈 양식으로 초기화되는 경우.
* **조치**:
  1. 페이지 재접속 시 브라우저 내부 `localStorage`의 `vowseoul_draft_{slug}`에 키 입력마다 백업된 JSON 데이터를 자동으로 역직렬화하여 복원합니다.
  2. 복원되지 않을 시 브라우저 내부 개발 환경 저장소가 초기화된 것이므로, 관리자가 해당 고객 상세 주소(`/admin/customers/[customerId]`)에 진입하여 직접 수동으로 보정하거나 폼 만료일(`expiration_date`)을 연장하고 폼 비밀번호를 초기화하여 재생성 해줍니다.
