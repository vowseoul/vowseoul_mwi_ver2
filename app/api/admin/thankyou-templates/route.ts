import { NextResponse } from "next/server"
import { readSetting, requireStaff, writeSetting } from "@/lib/admin-settings"

/**
 * 모바일 감사장 저장 문구(settings.key = 'thankyou_templates') — 제목을 붙여 저장해 두고
 * 상황(신랑측 혼주, 신부측 혼주, 신랑신부 등)에 따라 긴 글을 바로 불러온다. 직원이 함께 쓴다.
 *
 * GET                          : 목록
 * POST   { title, body, name } : 저장. 같은 제목이 있으면 그 문구를 덮어쓴다
 * DELETE { title }             : 삭제
 */

const KEY = "thankyou_templates"
const MAX_TITLE = 40
const MAX_TEXT = 3000

interface Template { title: string; body: string; name: string }

async function readList(): Promise<Template[]> {
  const value = await readSetting(KEY)
  if (!Array.isArray(value)) return []
  return value.filter((t): t is Template =>
    !!t && typeof t === "object" &&
    typeof (t as Template).title === "string" && typeof (t as Template).body === "string" && typeof (t as Template).name === "string"
  )
}

const forbidden = () => NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })

export async function GET() {
  if (!(await requireStaff())) return forbidden()
  return NextResponse.json({ templates: await readList() })
}

export async function POST(request: Request) {
  if (!(await requireStaff())) return forbidden()
  const input = await request.json().catch(() => ({}))
  const title = typeof input.title === "string" ? input.title.trim() : ""
  const body = typeof input.body === "string" ? input.body : ""
  const name = typeof input.name === "string" ? input.name : ""
  if (!title) return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 })
  if (title.length > MAX_TITLE || body.length > MAX_TEXT || name.length > MAX_TEXT) {
    return NextResponse.json({ error: "내용이 너무 깁니다." }, { status: 400 })
  }
  const list = await readList()
  const next = list.some((t) => t.title === title)
    ? list.map((t) => (t.title === title ? { title, body, name } : t))
    : [...list, { title, body, name }]
  await writeSetting(KEY, next)
  return NextResponse.json({ templates: next })
}

export async function DELETE(request: Request) {
  if (!(await requireStaff())) return forbidden()
  const { title } = await request.json().catch(() => ({}))
  const next = (await readList()).filter((t) => t.title !== title)
  await writeSetting(KEY, next)
  return NextResponse.json({ templates: next })
}
