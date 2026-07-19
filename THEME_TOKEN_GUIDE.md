# VOW SEOUL 모바일 청첩장 테마 디자인 토큰 구성 가이드 (Theme Design Token Guide)

이 문서는 VOW SEOUL 모바일 청첩장 플랫폼의 새로운 **테마(Theme)**를 디자인하고 등록할 때 사용되는 **디자인 토큰(Design Tokens) JSON 파일**의 구조와 작성 방법을 규격화하여 명세합니다.

---

## 1. 디자인 토큰(Design Tokens) 개요

VOW SEOUL에서 디자인 토큰은 초대장 렌더링에 사용되는 핵심 디자인 시스템(색상, 서체, 여백, 곡률 등)을 추상화하여 정의한 JSON 데이터 규격입니다.
관리자 페이지에서 테마를 생성하거나 디자인을 교체할 때, 이 토큰 데이터를 기반으로 CSS Custom Properties(Variables)가 실시간으로 변환되어 청첩장 빌더 및 하객용 웹 화면에 즉시 적용됩니다.

---

## 2. 디자인 토큰 JSON 구조 명세 (Schema Specification)

디자인 토큰 파일은 다음과 같은 기본 JSON 구조를 가져야 합니다. 각 속성은 VOW SEOUL 모바일 청첩장 컴포넌트(`Block`)들의 레이아웃과 직접 연결되어 동작합니다.

### 2.1. 전체 스키마 명세

```json
{
  "colors": {
    "primary": "#c4a574",
    "secondary": "#f5e6d3",
    "background": "#faf9f7",
    "text": "#3d3d3d",
    "textMuted": "#8a8a8a",
    "border": "#ececec",
    "accent": "#b29363"
  },
  "typography": {
    "heading": {
      "fontFamily": "Playfair Display, Noto Serif KR, serif",
      "fontWeight": 400
    },
    "body": {
      "fontFamily": "Inter, Noto Sans KR, sans-serif",
      "fontWeight": 400
    }
  },
  "spacing": {
    "sectionGap": "48px",
    "contentPadding": "24px"
  },
  "border": {
    "radius": "8px"
  }
}
```

---

## 3. 필드별 상세 설명 (Field Description)

### 3.1. `colors` (색상 설정)
테마의 전체적인 톤 앤 매너를 형성하는 색상 목록입니다. 모든 색상은 `#HEX` 형태(혹은 RGBa 형식)의 문자열이어야 합니다.
- **`primary`**: 주 테마 색상. 주요 강조 버튼, 제목 라인, 핵심 하이라이트 요소에 사용됩니다.
- **`secondary`**: 보조 색상. 카드 배경이나 보조 태그 배경 등 대비감을 주거나 부드럽게 감싸는 영역에 사용됩니다.
- **`background`**: 청첩장의 전체 모바일 화면 배경색입니다.
- **`text`**: 메인 본문 및 설명 문구의 글꼴 색상입니다.
- **`textMuted`**: 주석 문구, 도움말, 연한 날짜 표시 등에 활용될 보조 글꼴 색상입니다.
- **`border`**: 카드 구분선, 인풋 태두리선 등에 사용될 연한 경계선 색상입니다.
- **`accent`**: 주요 이벤트나 포인트 요소에 사용될 강조 색상입니다.

### 3.2. `typography` (글꼴 및 타이포그래피)
청첩장에서 표현될 텍스트 폰트 패밀리 및 기본 굵기를 제어합니다.
- **`heading`**: 제목 영역(신랑 신부 이름, 예식 안내 제목, D-Day 표시 등)에 사용되는 글꼴 구성입니다.
  - `fontFamily`: CSS 폰트 패밀리 문자열. (예: `Playfair Display, Noto Serif KR, serif`)
  - `fontWeight`: 폰트 굵기(Number). 보통 `300`, `400`, `700` 중 하나를 채택합니다.
- **`body`**: 본문 텍스트, 하객 방명록 기입란, 안내 상세 문구에 쓰이는 글꼴 구성입니다.
  - `fontFamily`: 본문용 폰트 구성. (예: `Inter, Noto Sans KR, sans-serif`)
  - `fontWeight`: 굵기 설정 (일반적으로 `400` 사용).

> [!NOTE]
> 커스텀 폰트를 적용하려면 해당 폰트가 `@import` 또는 `<link>` 태그 등을 통해 시스템 전체 폰트 로드 API(`/api/fonts`) 혹은 전역 CSS 파일에 사전 로드되어 있어야 합니다.

### 3.3. `spacing` (공간 정의)
레이아웃 간격 및 요소들 간의 여백을 규격화합니다.
- **`sectionGap`**: 블록과 블록(예: 커버와 갤러리 사이)의 세로 간격 여백 값입니다. (예: `"48px"`, `"64px"`)
- **`contentPadding`**: 청첩장 가로 영역의 내부 여백(Padding Left/Right) 크기입니다. (예: `"24px"`, `"30px"`)

### 3.4. `border` (경계 곡률)
- **`radius`**: 카드, 입력 필드, 전송 버튼의 둥글기 모서리 반지름(`border-radius`) 값입니다. (예: `"8px"`, `"16px"`, `"0px" (완전 사각형)`)

---

## 4. 실전 테마 토큰 파일 작성 예시

### 예시 1: 클래식 화이트 (Classic White) 테마 토큰
> 따뜻하고 단아한 아이보리 및 화이트 계열을 메인으로 차분하고 고급스러운 세리프 폰트를 결합한 베스트셀러 테마 토큰입니다.

```json
{
  "colors": {
    "primary": "#c4a574",
    "secondary": "#f5e6d3",
    "background": "#faf9f7",
    "text": "#3d3d3d",
    "textMuted": "#8a8a8a",
    "border": "#ececec",
    "accent": "#b29363"
  },
  "typography": {
    "heading": {
      "fontFamily": "Playfair Display, Noto Serif KR, serif",
      "fontWeight": 400
    },
    "body": {
      "fontFamily": "Inter, Noto Sans KR, sans-serif",
      "fontWeight": 400
    }
  },
  "spacing": {
    "sectionGap": "48px",
    "contentPadding": "24px"
  },
  "border": {
    "radius": "8px"
  }
}
```

### 예시 2: 모던 딥 블랙 (Modern Deep Black) 테마 토큰
> 어두운 톤의 트렌디하고 감각적인 디자인을 선호하는 커플을 위한 다크모드 기반 고대비 미니멀 테마 토큰입니다.

```json
{
  "colors": {
    "primary": "#c5a47e",
    "secondary": "#222222",
    "background": "#121212",
    "text": "#f5f5f5",
    "textMuted": "#aaaaaa",
    "border": "#333333",
    "accent": "#d4b895"
  },
  "typography": {
    "heading": {
      "fontFamily": "Cinzel, Myeongjo, serif",
      "fontWeight": 400
    },
    "body": {
      "fontFamily": "Montserrat, Sans-Serif",
      "fontWeight": 300
    }
  },
  "spacing": {
    "sectionGap": "56px",
    "contentPadding": "20px"
  },
  "border": {
    "radius": "4px"
  }
}
```

---

## 5. 관리자 화면 및 DB 등록 방법

1. **테마 정보 생성**:
   - Supabase 또는 관리자 어드민 패널(`/admin/templates` 혹은 DB)에서 `themes` 테이블에 신규 테마 행을 추가합니다.
2. **토큰 적용**:
   - `theme_versions` 테이블의 `design_tokens` 컬럼에 위에서 작성한 디자인 토큰 JSON 문자열을 그대로 입력하여 배포합니다.
3. **블록 매핑**:
   - `block_variant_selections`에 테마별 커버 타입(`type_a`, `type_b`), 갤러리 형태(`slide`, `grid`) 등의 기본 설정을 주입해 배포를 완료합니다.
