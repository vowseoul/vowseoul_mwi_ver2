'use client'

import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CalendarIcon, ArrowRight, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

const timeOptions = [
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00'
]

const parseIndividualParents = (fullRelation: string) => {
  const result = { fatherName: '', motherName: '', relationText: '' }
  if (!fullRelation) return result

  // Pattern 1: "아버지 김철수, 어머니 이영희의 장남"
  const pattern1 = /아버지\s*([^\s,··]+)[,\s·]*어머니\s*([^\s의]+)의\s*(.*)/
  const match1 = fullRelation.match(pattern1)
  if (match1) {
    result.fatherName = match1[1].trim()
    result.motherName = match1[2].trim()
    result.relationText = `의 ${match1[3].trim()}`
    return result
  }

  // Pattern 2: "김태진 · 정혜선 의 아들"
  const pattern2 = /^([^\s의,·]+)[,\s·]+([^\s의,·]+)\s*의\s*(.*)/
  const match2 = fullRelation.match(pattern2)
  if (match2) {
    result.fatherName = match2[1].trim()
    result.motherName = match2[2].trim()
    result.relationText = `의 ${match2[3].trim()}`
    return result
  }

  // Pattern 3: "김태진 의 아들"
  const pattern3 = /^([^\s의]+)\s*의\s*(.*)/
  const match3 = fullRelation.match(pattern3)
  if (match3) {
    result.fatherName = match3[1].trim()
    result.relationText = `의 ${match3[2].trim()}`
    return result
  }

  return result
}

const parseParentNames = (fullRelation: string) => {
  if (!fullRelation) return ''
  const match = fullRelation.match(/^(.*?)(의\s+아들|의\s+딸|의\s*\S*)$/)
  return match ? match[1].trim() : fullRelation
}

const parseRelationText = (fullRelation: string) => {
  if (!fullRelation) return ''
  const match = fullRelation.match(/^(.*?)(의\s+아들|의\s+딸|의\s*\S*)$/)
  return match ? match[2].trim() : ''
}

export default function BasicInfoPage() {
  const router = useRouter()
  const params = useParams()
  const { currentInvitation, updateCurrentInvitation, saveInvitation, setActiveSection } = useAppStore()
  const invitationId = params.id as string

  const handleNext = async () => {
    const savedId = await saveInvitation()
    const targetId = savedId || invitationId
    router.push(`/editor/${targetId}/design`)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">기본 정보</h1>
        <p className="mt-1 text-muted-foreground">
          신랑, 신부 정보와 예식 일시, 장소를 입력해주세요.
        </p>
      </div>

      {/* Groom Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">신랑 정보</CardTitle>
          <CardDescription>신랑의 이름과 혼주 정보를 입력해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="groomName">이름</FieldLabel>
                <Input
                  id="groomName"
                  placeholder="홍길동"
                  value={currentInvitation?.groomName || ''}
                  onChange={(e) => updateCurrentInvitation({ groomName: e.target.value })}
                  onFocus={() => setActiveSection('hero')}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="groomNameEn">영문 이름</FieldLabel>
                <Input
                  id="groomNameEn"
                  placeholder="Hong Gildong"
                  value={currentInvitation?.groomNameEn || ''}
                  onChange={(e) => updateCurrentInvitation({ groomNameEn: e.target.value })}
                  onFocus={() => setActiveSection('hero')}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="groomFatherName">아버지 성함</FieldLabel>
                  <Input
                    id="groomFatherName"
                    placeholder="홍길동"
                    value={currentInvitation?.customStyles?.groomFatherName !== undefined 
                      ? currentInvitation.customStyles.groomFatherName 
                      : parseIndividualParents(currentInvitation?.groomParentRelation || '').fatherName}
                    onChange={(e) => {
                      const father = e.target.value
                      const mother = currentInvitation?.customStyles?.groomMotherName !== undefined
                        ? currentInvitation.customStyles.groomMotherName
                        : parseIndividualParents(currentInvitation?.groomParentRelation || '').motherName
                      const relation = currentInvitation?.customStyles?.groomParentRelationText !== undefined
                        ? currentInvitation.customStyles.groomParentRelationText
                        : parseRelationText(currentInvitation?.groomParentRelation || '')
                      
                      const namesArr = []
                      if (father) namesArr.push(father)
                      if (mother) namesArr.push(mother)
                      const parentNamesCombined = namesArr.join(' · ')

                      let relationCombined = ''
                      if (father && mother) relationCombined = `아버지 ${father}, 어머니 ${mother} ${relation}`.trim()
                      else if (father) relationCombined = `아버지 ${father} ${relation}`.trim()
                      else if (mother) relationCombined = `어머니 ${mother} ${relation}`.trim()
                      else relationCombined = relation

                      updateCurrentInvitation({
                        groomParentRelation: relationCombined,
                        customStyles: {
                          ...(currentInvitation?.customStyles || {}),
                          groomFatherName: father,
                          groomMotherName: mother,
                          groomParentNames: parentNamesCombined,
                          groomParentRelationText: relation
                        }
                      })
                    }}
                    onFocus={() => setActiveSection('hero')}
                  />
                  <FieldDescription>아버님의 성함을 입력해주세요.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="groomMotherName">어머니 성함</FieldLabel>
                  <Input
                    id="groomMotherName"
                    placeholder="김순희"
                    value={currentInvitation?.customStyles?.groomMotherName !== undefined 
                      ? currentInvitation.customStyles.groomMotherName 
                      : parseIndividualParents(currentInvitation?.groomParentRelation || '').motherName}
                    onChange={(e) => {
                      const mother = e.target.value
                      const father = currentInvitation?.customStyles?.groomFatherName !== undefined
                        ? currentInvitation.customStyles.groomFatherName
                        : parseIndividualParents(currentInvitation?.groomParentRelation || '').fatherName
                      const relation = currentInvitation?.customStyles?.groomParentRelationText !== undefined
                        ? currentInvitation.customStyles.groomParentRelationText
                        : parseRelationText(currentInvitation?.groomParentRelation || '')
                      
                      const namesArr = []
                      if (father) namesArr.push(father)
                      if (mother) namesArr.push(mother)
                      const parentNamesCombined = namesArr.join(' · ')

                      let relationCombined = ''
                      if (father && mother) relationCombined = `아버지 ${father}, 어머니 ${mother} ${relation}`.trim()
                      else if (father) relationCombined = `아버지 ${father} ${relation}`.trim()
                      else if (mother) relationCombined = `어머니 ${mother} ${relation}`.trim()
                      else relationCombined = relation

                      updateCurrentInvitation({
                        groomParentRelation: relationCombined,
                        customStyles: {
                          ...(currentInvitation?.customStyles || {}),
                          groomFatherName: father,
                          groomMotherName: mother,
                          groomParentNames: parentNamesCombined,
                          groomParentRelationText: relation
                        }
                      })
                    }}
                    onFocus={() => setActiveSection('hero')}
                  />
                  <FieldDescription>어머님의 성함을 입력해주세요.</FieldDescription>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="groomParentRelationText">관계 표기</FieldLabel>
                <Input
                  id="groomParentRelationText"
                  placeholder="의 아들"
                  value={currentInvitation?.customStyles?.groomParentRelationText !== undefined 
                    ? currentInvitation.customStyles.groomParentRelationText 
                    : parseRelationText(currentInvitation?.groomParentRelation || '')}
                  onChange={(e) => {
                    const relation = e.target.value
                    const father = currentInvitation?.customStyles?.groomFatherName !== undefined
                      ? currentInvitation.customStyles.groomFatherName
                      : parseIndividualParents(currentInvitation?.groomParentRelation || '').fatherName
                    const mother = currentInvitation?.customStyles?.groomMotherName !== undefined
                      ? currentInvitation.customStyles.groomMotherName
                      : parseIndividualParents(currentInvitation?.groomParentRelation || '').motherName
                    
                    const namesArr = []
                    if (father) namesArr.push(father)
                    if (mother) namesArr.push(mother)
                    const parentNamesCombined = namesArr.join(' · ')

                    let relationCombined = ''
                    if (father && mother) relationCombined = `아버지 ${father}, 어머니 ${mother} ${relation}`.trim()
                    else if (father) relationCombined = `아버지 ${father} ${relation}`.trim()
                    else if (mother) relationCombined = `어머니 ${mother} ${relation}`.trim()
                    else relationCombined = relation

                    updateCurrentInvitation({
                      groomParentRelation: relationCombined,
                      customStyles: {
                        ...(currentInvitation?.customStyles || {}),
                        groomFatherName: father,
                        groomMotherName: mother,
                        groomParentNames: parentNamesCombined,
                        groomParentRelationText: relation
                      }
                    })
                  }}
                  onFocus={() => setActiveSection('hero')}
                />
                <FieldDescription>신랑과의 관계를 입력해주세요. (예: 의 아들, 의 장남)</FieldDescription>
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Bride Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">신부 정보</CardTitle>
          <CardDescription>신부의 이름과 혼주 정보를 입력해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="brideName">이름</FieldLabel>
                <Input
                  id="brideName"
                  placeholder="김영희"
                  value={currentInvitation?.brideName || ''}
                  onChange={(e) => updateCurrentInvitation({ brideName: e.target.value })}
                  onFocus={() => setActiveSection('hero')}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="brideNameEn">영문 이름</FieldLabel>
                <Input
                  id="brideNameEn"
                  placeholder="Kim Younghee"
                  value={currentInvitation?.brideNameEn || ''}
                  onChange={(e) => updateCurrentInvitation({ brideNameEn: e.target.value })}
                  onFocus={() => setActiveSection('hero')}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="brideFatherName">아버지 성함</FieldLabel>
                  <Input
                    id="brideFatherName"
                    placeholder="김철수"
                    value={currentInvitation?.customStyles?.brideFatherName !== undefined 
                      ? currentInvitation.customStyles.brideFatherName 
                      : parseIndividualParents(currentInvitation?.brideParentRelation || '').fatherName}
                    onChange={(e) => {
                      const father = e.target.value
                      const mother = currentInvitation?.customStyles?.brideMotherName !== undefined
                        ? currentInvitation.customStyles.brideMotherName
                        : parseIndividualParents(currentInvitation?.brideParentRelation || '').motherName
                      const relation = currentInvitation?.customStyles?.brideParentRelationText !== undefined
                        ? currentInvitation.customStyles.brideParentRelationText
                        : parseRelationText(currentInvitation?.brideParentRelation || '')
                      
                      const namesArr = []
                      if (father) namesArr.push(father)
                      if (mother) namesArr.push(mother)
                      const parentNamesCombined = namesArr.join(' · ')

                      let relationCombined = ''
                      if (father && mother) relationCombined = `아버지 ${father}, 어머니 ${mother} ${relation}`.trim()
                      else if (father) relationCombined = `아버지 ${father} ${relation}`.trim()
                      else if (mother) relationCombined = `어머니 ${mother} ${relation}`.trim()
                      else relationCombined = relation

                      updateCurrentInvitation({
                        brideParentRelation: relationCombined,
                        customStyles: {
                          ...(currentInvitation?.customStyles || {}),
                          brideFatherName: father,
                          brideMotherName: mother,
                          brideParentNames: parentNamesCombined,
                          brideParentRelationText: relation
                        }
                      })
                    }}
                    onFocus={() => setActiveSection('hero')}
                  />
                  <FieldDescription>아버님의 성함을 입력해주세요.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="brideMotherName">어머니 성함</FieldLabel>
                  <Input
                    id="brideMotherName"
                    placeholder="박미경"
                    value={currentInvitation?.customStyles?.brideMotherName !== undefined 
                      ? currentInvitation.customStyles.brideMotherName 
                      : parseIndividualParents(currentInvitation?.brideParentRelation || '').motherName}
                    onChange={(e) => {
                      const mother = e.target.value
                      const father = currentInvitation?.customStyles?.brideFatherName !== undefined
                        ? currentInvitation.customStyles.brideFatherName
                        : parseIndividualParents(currentInvitation?.brideParentRelation || '').fatherName
                      const relation = currentInvitation?.customStyles?.brideParentRelationText !== undefined
                        ? currentInvitation.customStyles.brideParentRelationText
                        : parseRelationText(currentInvitation?.brideParentRelation || '')
                      
                      const namesArr = []
                      if (father) namesArr.push(father)
                      if (mother) namesArr.push(mother)
                      const parentNamesCombined = namesArr.join(' · ')

                      let relationCombined = ''
                      if (father && mother) relationCombined = `아버지 ${father}, 어머니 ${mother} ${relation}`.trim()
                      else if (father) relationCombined = `아버지 ${father} ${relation}`.trim()
                      else if (mother) relationCombined = `어머니 ${mother} ${relation}`.trim()
                      else relationCombined = relation

                      updateCurrentInvitation({
                        brideParentRelation: relationCombined,
                        customStyles: {
                          ...(currentInvitation?.customStyles || {}),
                          brideFatherName: father,
                          brideMotherName: mother,
                          brideParentNames: parentNamesCombined,
                          brideParentRelationText: relation
                        }
                      })
                    }}
                    onFocus={() => setActiveSection('hero')}
                  />
                  <FieldDescription>어머님의 성함을 입력해주세요.</FieldDescription>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="brideParentRelationText">관계 표기</FieldLabel>
                <Input
                  id="brideParentRelationText"
                  placeholder="의 딸"
                  value={currentInvitation?.customStyles?.brideParentRelationText !== undefined 
                    ? currentInvitation.customStyles.brideParentRelationText 
                    : parseRelationText(currentInvitation?.brideParentRelation || '')}
                  onChange={(e) => {
                    const relation = e.target.value
                    const father = currentInvitation?.customStyles?.brideFatherName !== undefined
                      ? currentInvitation.customStyles.brideFatherName
                      : parseIndividualParents(currentInvitation?.brideParentRelation || '').fatherName
                    const mother = currentInvitation?.customStyles?.brideMotherName !== undefined
                      ? currentInvitation.customStyles.brideMotherName
                      : parseIndividualParents(currentInvitation?.brideParentRelation || '').motherName
                    
                    const namesArr = []
                    if (father) namesArr.push(father)
                    if (mother) namesArr.push(mother)
                    const parentNamesCombined = namesArr.join(' · ')

                    let relationCombined = ''
                    if (father && mother) relationCombined = `아버지 ${father}, 어머니 ${mother} ${relation}`.trim()
                    else if (father) relationCombined = `아버지 ${father} ${relation}`.trim()
                    else if (mother) relationCombined = `어머니 ${mother} ${relation}`.trim()
                    else relationCombined = relation

                    updateCurrentInvitation({
                      brideParentRelation: relationCombined,
                      customStyles: {
                        ...(currentInvitation?.customStyles || {}),
                        brideFatherName: father,
                        brideMotherName: mother,
                        brideParentNames: parentNamesCombined,
                        brideParentRelationText: relation
                      }
                    })
                  }}
                  onFocus={() => setActiveSection('hero')}
                />
                <FieldDescription>신부와의 관계를 입력해주세요. (예: 의 딸, 의 차녀)</FieldDescription>
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Wedding Date & Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">예식 일시</CardTitle>
          <CardDescription>결혼식 날짜와 시간을 선택해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>예식일</FieldLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !currentInvitation?.weddingDate && 'text-muted-foreground'
                      )}
                      onFocus={() => setActiveSection('calendar')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {currentInvitation?.weddingDate ? (
                        format(new Date(currentInvitation.weddingDate + 'T00:00:00'), 'PPP', { locale: ko })
                      ) : (
                        '날짜를 선택하세요'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={currentInvitation?.weddingDate ? new Date(currentInvitation.weddingDate + 'T00:00:00') : undefined}
                      onSelect={(date) => date && updateCurrentInvitation({ weddingDate: format(date, 'yyyy-MM-dd') })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </Field>
              <Field>
                <FieldLabel htmlFor="weddingTime">예식 시간</FieldLabel>
                <Select
                  value={currentInvitation?.weddingTime || ''}
                  onValueChange={(value) => updateCurrentInvitation({ weddingTime: value })}
                >
                  <SelectTrigger onFocus={() => setActiveSection('calendar')}>
                    <SelectValue placeholder="시간을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Venue Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">예식 장소</CardTitle>
          <CardDescription>결혼식이 진행될 장소 정보를 입력해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="venueName">예식장명</FieldLabel>
                <Input
                  id="venueName"
                  placeholder="그랜드 하얏트 서울"
                  value={currentInvitation?.venueName || ''}
                  onChange={(e) => updateCurrentInvitation({ venueName: e.target.value })}
                  onFocus={() => setActiveSection('location')}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="venueHall">층/홀 이름</FieldLabel>
                <Input
                  id="venueHall"
                  placeholder="그랜드볼룸"
                  value={currentInvitation?.venueHall || ''}
                  onChange={(e) => updateCurrentInvitation({ venueHall: e.target.value })}
                  onFocus={() => setActiveSection('location')}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="venueAddress">주소</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="venueAddress"
                  placeholder="서울특별시 용산구 소월로 322"
                  value={currentInvitation?.venueAddress || ''}
                  onChange={(e) => updateCurrentInvitation({ venueAddress: e.target.value })}
                  onFocus={() => setActiveSection('location')}
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  type="button"
                  onClick={() => {
                    const executePostcode = () => {
                      new (window as any).daum.Postcode({
                        oncomplete: (data: any) => {
                          let fullAddress = data.address;
                          let extraAddress = '';

                          if (data.addressType === 'R') {
                            if (data.bname !== '') {
                              extraAddress += data.bname;
                            }
                            if (data.buildingName !== '') {
                              extraAddress += extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName;
                            }
                            fullAddress += extraAddress !== '' ? ` (${extraAddress})` : '';
                          }

                          updateCurrentInvitation({ venueAddress: fullAddress });
                        },
                      }).open();
                    };

                    if (!(window as any).daum) {
                      const script = document.createElement('script');
                      script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
                      script.onload = executePostcode;
                      document.body.appendChild(script);
                    } else {
                      executePostcode();
                    }
                  }}
                >
                  주소 검색
                </Button>
              </div>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" asChild>
          <Link href={`/editor/${invitationId}/design`}>
            <Palette className="mr-2 h-4 w-4" />
            디자인 수정하기
          </Link>
        </Button>
        <Button onClick={handleNext}>
          다음 단계
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
