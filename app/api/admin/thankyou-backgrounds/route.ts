import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { readSetting, requireStaff, writeSetting } from "@/lib/admin-settings"
import { BUCKET_NAME } from "@/lib/storage"

/**
 * 모바일 감사장 배경 이미지 목록(settings.key = 'thankyou_backgrounds').
 *
 * settings 쓰기는 RLS 상 운영자(ADMIN)만 되지만 감사장은 직원 누구나 만든다. 그래서
 * 브라우저가 직접 쓰지 않고 여기서 직원 확인을 거쳐 service_role 로 대신 쓴다
 * (§app/api/admin/qr-link 와 같은 방식). 이미지 파일 자체는 브라우저가 Storage 에
 * 올리고(공개 업로드 허용), 여기에는 그 주소만 등록한다.
 *
 * GET              : 목록
 * POST   { url }   : 추가
 * DELETE { url }   : 목록에서 빼고 Storage 파일도 지운다
 */

const KEY = "thankyou_backgrounds"
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET_NAME}/`

async function readList(): Promise<string[]> {
  const value = await readSetting(KEY)
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

const writeList = (list: string[]) => writeSetting(KEY, list)

/** 우리 Storage 에 올라간 파일 주소만 받는다 — 아무 주소나 등록되면 남의 이미지를 끌어다 쓰게 된다 */
function storagePath(url: unknown): string | null {
  if (typeof url !== "string") return null
  try {
    const u = new URL(url)
    const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host
    if (u.host !== supabaseHost || !u.pathname.startsWith(PUBLIC_PREFIX)) return null
    return decodeURIComponent(u.pathname.slice(PUBLIC_PREFIX.length))
  } catch {
    return null
  }
}

export async function GET() {
  if (!(await requireStaff())) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
  return NextResponse.json({ backgrounds: await readList() })
}

export async function POST(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
  const { url } = await request.json().catch(() => ({}))
  if (!storagePath(url)) return NextResponse.json({ error: "잘못된 이미지 주소입니다." }, { status: 400 })
  const list = await readList()
  if (!list.includes(url)) await writeList([...list, url])
  return NextResponse.json({ backgrounds: list.includes(url) ? list : [...list, url] })
}

export async function DELETE(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
  const { url } = await request.json().catch(() => ({}))
  const path = storagePath(url)
  if (!path) return NextResponse.json({ error: "잘못된 이미지 주소입니다." }, { status: 400 })
  const next = (await readList()).filter((u) => u !== url)
  await writeList(next)
  const { error } = await createSupabaseAdminClient().storage.from(BUCKET_NAME).remove([path])
  if (error) console.error("thankyou background file delete failed:", error.message)
  return NextResponse.json({ backgrounds: next })
}
