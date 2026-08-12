"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, ArrowUp, ArrowDown, Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SaveButton } from "@/components/ui/save-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { uploadImage } from "@/lib/image-upload"
import {
  SELF_EDIT_PROFILE_FIELDS as PROFILE_FIELDS,
  SELF_EDIT_GREETING_FIELD as GREETING_FIELD,
  SELF_EDIT_ACCOUNT_FIELDS as ACCOUNT_FIELDS,
} from "@/lib/self-edit"
import { DEFAULT_SCROLL_MOTION, type ScrollMotionSettings } from "@/lib/scroll-motion"
import { ScrollMotionField } from "@/components/invitation/scroll-motion-field"

export default function EditClient({
  invitationId,
  initialFields,
  initialGalleryImages,
  initialScrollMotion,
}: {
  invitationId: string
  initialFields: Record<string, string>
  initialGalleryImages: string[]
  initialScrollMotion?: ScrollMotionSettings
}) {
  const [fields, setFields] = useState<Record<string, string>>(initialFields)
  const [galleryImages, setGalleryImages] = useState<string[]>(initialGalleryImages)
  const [scrollMotion, setScrollMotion] = useState<ScrollMotionSettings>(initialScrollMotion ?? DEFAULT_SCROLL_MOTION)
  const [uploadingGallery, setUploadingGallery] = useState(false)

  const setField = (key: string, value: string) => setFields((cur) => ({ ...cur, [key]: value }))

  const addGalleryImage = async (file: File) => {
    setUploadingGallery(true)
    try {
      const url = await uploadImage(file, "invitations/self-edit")
      setGalleryImages((cur) => [...cur, url])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.")
    } finally {
      setUploadingGallery(false)
    }
  }
  const removeGalleryImage = (index: number) => setGalleryImages((cur) => cur.filter((_, i) => i !== index))
  const moveGalleryImage = (index: number, direction: -1 | 1) => {
    setGalleryImages((cur) => {
      const next = [...cur]
      const target = index + direction
      if (target < 0 || target >= next.length) return cur
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const save = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/self-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, fields, galleryImages, scrollMotion }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result?.error || "저장에 실패했습니다.")
      toast.success("수정 내용이 저장되었습니다. 청첩장에 바로 반영됩니다.")
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장에 실패했습니다.")
      return false
    }
  }

  return (
    <div className="min-h-screen bg-muted/20 font-sans">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href={`/invitation/${invitationId}/dashboard`}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" /> 대시보드로
            </Button>
          </Link>
          <SaveButton size="sm" onSave={save} className="gap-1.5" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold">청첩장 정보 수정</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            여기서 바꾼 내용은 저장 즉시 실제 청첩장에 반영됩니다. 디자인·테마 변경이 필요하시면
            담당자에게 문의해주세요.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">기본 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {PROFILE_FIELDS.map((f) => (
                <Field key={f.key}>
                  <FieldLabel>{f.label}</FieldLabel>
                  <Input
                    type={f.type === "tel" ? "tel" : "text"}
                    value={fields[f.key] ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </Field>
              ))}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">인사말</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={5}
              value={fields[GREETING_FIELD.key] ?? ""}
              onChange={(e) => setField(GREETING_FIELD.key, e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">계좌 정보</CardTitle>
            <CardDescription>하객이 마음을 전할 때 안내되는 계좌입니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ACCOUNT_FIELDS.slice(0, 3).map((f) => (
                <Field key={f.key}>
                  <FieldLabel>{f.label}</FieldLabel>
                  <Input value={fields[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} />
                </Field>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ACCOUNT_FIELDS.slice(3, 6).map((f) => (
                <Field key={f.key}>
                  <FieldLabel>{f.label}</FieldLabel>
                  <Input value={fields[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} />
                </Field>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">갤러리 사진</CardTitle>
            <CardDescription>사진을 추가·삭제하거나 화살표로 순서를 바꿀 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {galleryImages.map((url, i) => (
                <div key={url + i} className="group relative overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeGalleryImage(i)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="absolute bottom-1 left-1 flex gap-1">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveGalleryImage(i, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={i === galleryImages.length - 1}
                      onClick={() => moveGalleryImage(i, 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted/50">
                {uploadingGallery ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                사진 추가
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingGallery}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) addGalleryImage(file)
                    e.target.value = ""
                  }}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">스크롤 모션</CardTitle>
            <CardDescription>
              하객이 청첩장을 스크롤할 때 각 섹션이 나타나는 방식입니다. 색상·폰트·테마 변경은
              담당자를 통해서만 가능하지만, 이 항목은 여기서 바로 바꾸실 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollMotionField value={scrollMotion} onChange={setScrollMotion} idPrefix="self-edit-scroll-motion" />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between pb-6">
          <Link href="/privacy" className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
            개인정보처리방침
          </Link>
          <SaveButton onSave={save} className="gap-2" />
        </div>
      </main>
    </div>
  )
}
