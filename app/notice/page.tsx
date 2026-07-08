'use client'

import { useEffect } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useAppStore } from '@/lib/store'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { cn } from '@/lib/utils'

export default function NoticePage() {
  const { notices, fetchData } = useAppStore()

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-16 md:py-24 flex-1">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">공지사항</h1>
          <p className="mt-4 text-muted-foreground">
            VOW SEOUL의 소식과 다양한 혜택, 업데이트 소식을 빠르게 전해드립니다.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-background border border-border rounded-lg p-6 shadow-sm">
            <Accordion type="single" collapsible className="w-full">
              {notices.map((notice) => (
                <AccordionItem key={notice.id} value={notice.id} className="border-b last:border-b-0">
                  <AccordionTrigger className="text-left py-4 hover:no-underline">
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 w-full">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-semibold w-fit",
                        notice.category === '안내' ? "bg-blue-100 text-blue-800" :
                        notice.category === '업데이트' ? "bg-green-100 text-green-800" :
                        "bg-orange-100 text-orange-800"
                      )}>
                        {notice.category}
                      </span>
                      <span className="font-medium text-sm md:text-base flex-1 pr-4">{notice.title}</span>
                      <span className="text-xs text-muted-foreground">{notice.createdAt}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line bg-muted/30 p-4 rounded-md mt-1">
                    {notice.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {notices.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              등록된 공지사항이 없습니다.
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
