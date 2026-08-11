'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { PrivacyConsentField } from '@/components/privacy-consent-field'
import { CONSENT_VERSION, INQUIRY_CONSENT_COPY } from '@/lib/privacy-consent'

export function InquiryForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [consentAgreed, setConsentAgreed] = useState(false)
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
    if (!consentAgreed) {
      toast.error('개인정보 수집·이용에 동의해주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('inquiries').insert({
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
        consent_agreed_at: new Date().toISOString(),
        consent_version: CONSENT_VERSION,
      })

      if (error) throw error

      toast.success('문의가 성공적으로 접수되었습니다. 빠른 시일 내에 답변 드리겠습니다.')
      setFormData({ name: '', email: '', subject: '', message: '' })
      setConsentAgreed(false)
    } catch (error) {
      console.error('Error submitting inquiry:', error)
      toast.error('문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">이름</Label>
          <Input
            id="name"
            placeholder="홍길동"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            placeholder="example@email.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">제목</Label>
          <Input
            id="subject"
            placeholder="문의하실 제목을 입력해주세요"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">문의 내용</Label>
          <Textarea
            id="message"
            placeholder="문의하실 내용을 상세히 적어주세요."
            className="min-h-[150px]"
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          />
        </div>

        <PrivacyConsentField copy={INQUIRY_CONSENT_COPY} checked={consentAgreed} onCheckedChange={setConsentAgreed} />

        <Button type="submit" className="w-full" disabled={isSubmitting || !consentAgreed}>
          {isSubmitting ? '전송 중...' : '문의 보내기'}
        </Button>
      </form>
    </div>
  )
}
