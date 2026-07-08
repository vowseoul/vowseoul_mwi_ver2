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

export default function FAQPage() {
  const { faqs, fetchData } = useAppStore()

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Group FAQs by category
  const groupedFaqs = faqs.reduce((acc, faq) => {
    const category = faq.category || '기타'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(faq)
    return acc
  }, {} as Record<string, typeof faqs>)

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-16 md:py-24 flex-1">
        <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">자주 묻는 질문</h1>
        <p className="mt-4 text-muted-foreground">
          VOW SEOUL 서비스 이용에 대해 궁금하신 점을 확인해보세요.
        </p>
      </div>

      <div className="space-y-12">
        {Object.entries(groupedFaqs).map(([category, categoryFaqs]) => (
          <div key={category}>
            <h2 className="mb-4 text-xl font-semibold">{category}</h2>
            <Accordion type="single" collapsible className="w-full">
              {categoryFaqs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-base font-medium">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}

        {faqs.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            등록된 자주 묻는 질문이 없습니다.
          </div>
        )}
      </div>
    </div>
    <Footer />
    </div>
  )
}
