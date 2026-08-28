import { NextResponse } from "next/server"
import { buildIcsText } from "@/lib/ics"

/**
 * "캘린더 앱에 추가" 다운로드.
 *
 * 예전엔 클라이언트에서 만든 data:text/calendar URI를 <a download>로 열었는데,
 * iOS Safari는 최상위 탐색으로 열리는 data: 다운로드를 막고 Chrome도 top-level
 * data: 내비게이션을 차단해 상당수 하객에게 아무 반응이 없었다 — 실제 파일 응답을
 * Content-Disposition: attachment로 내려주면 두 브라우저 모두에서 정상 동작한다.
 * 예식 제목·장소·일시는 이미 청첩장 화면에 공개로 표시되는 정보라 별도 인증 없이 쿼리로 받는다.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get("title") || "결혼식"
  const location = searchParams.get("location") || ""
  const dateStr = searchParams.get("date") || ""
  const timeStr = searchParams.get("time") || undefined

  const ics = buildIcsText({ title, location, dateStr, timeStr })
  if (!ics) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=wedding.ics",
    },
  })
}
