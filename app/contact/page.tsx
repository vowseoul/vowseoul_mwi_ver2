'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import { Mail, Phone, MapPin } from 'lucide-react'

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast.error('모든 항목을 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('inquiries').insert({
        id: `inq_${uuidv4().slice(0, 8)}`,
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      })

      if (error) throw error

      toast.success('문의가 성공적으로 접수되었습니다. 빠른 시일 내에 답변 드리겠습니다.')
      setFormData({ name: '', email: '', subject: '', message: '' })
    } catch (error) {
      console.error('Error submitting inquiry:', error)
      toast.error('문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      
      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto max-w-5xl px-4 py-16 md:py-24">
          <div className="mb-12 text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">문의하기</h1>
            <p className="mt-4 text-muted-foreground">
              VOW SEOUL 서비스 이용에 대해 궁금하신 점이나 제휴 문의를 남겨주세요.
            </p>
          </div>

          <div className="grid gap-12 md:grid-cols-2">
            {/* Contact Information */}
            <div>
              <h2 className="mb-6 text-2xl font-semibold">고객 지원 센터</h2>
              <p className="mb-8 text-muted-foreground leading-relaxed">
                궁금하신 점이 있으신가요? 아래 폼을 통해 문의를 남겨주시면,
                담당자가 확인 후 영업일 기준 24시간 이내에 답변을 드립니다.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">이메일</h3>
                    <p className="text-muted-foreground">support@vow.seoul</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">전화번호</h3>
                    <p className="text-muted-foreground">02-123-4567 (평일 10:00 - 17:00)</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">오시는 길</h3>
                    <p className="text-muted-foreground">서울특별시 강남구 테헤란로 123, VOW 빌딩</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">이름</Label>
                  <Input 
                    id="name" 
                    placeholder="홍길동" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="example@email.com" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="subject">제목</Label>
                  <Input 
                    id="subject" 
                    placeholder="문의하실 제목을 입력해주세요" 
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="message">문의 내용</Label>
                  <Textarea 
                    id="message" 
                    placeholder="문의하실 내용을 상세히 적어주세요." 
                    className="min-h-[150px]"
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? '전송 중...' : '문의 보내기'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
