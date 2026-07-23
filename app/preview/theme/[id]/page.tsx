import { supabase } from "@/lib/supabase"
import type { Viewport } from "next"
import ThemePreviewClient from "./theme-preview-client"
import type { ThemeRow } from "@/lib/theme-template"

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
}

export const dynamic = "force-dynamic"
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  let themeRow: ThemeRow | null = null
  try {
    const { data } = await supabase.from("themes").select("*").eq("id", id).maybeSingle()
    themeRow = (data as ThemeRow) ?? null
  } catch (err) {
    console.error("Error fetching theme for preview:", err)
  }

  return <ThemePreviewClient themeRow={themeRow} />
}
