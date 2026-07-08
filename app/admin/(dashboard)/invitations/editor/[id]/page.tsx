'use client'

import React, { useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function AdminEditorRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  useEffect(() => {
    if (id) {
      router.replace(`/editor/${id}`)
    }
  }, [id, router])

  return (
    <div className="w-full h-[60vh] flex flex-col items-center justify-center font-sans">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm mt-4">청첩장 편집기로 이동하고 있습니다...</p>
    </div>
  )
}
