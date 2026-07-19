'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Sparkles, 
  ArrowRight, 
  FileText, 
  Palette, 
  Layers, 
  LineChart, 
  CheckCircle2, 
  ShieldCheck,
  ChevronRight,
  ClipboardList
} from 'lucide-react'
import { Logo } from '@/components/logo'

export default function LuxuryLandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const systemPillars = [
    {
      title: '맞춤형 정보 수집 폼 빌더',
      description: '지류 청첩장 종류별 필요 정보를 체계적으로 수집하는 폼 빌더 시스템입니다. 드래그 앤 드롭으로 문구를 구성하고, 고객별 고유 입력 링크를 만료 기한과 함께 손쉽게 생성합니다.',
      icon: ClipboardList,
      badge: 'Sprint 3',
      features: ['라인업별 기본 템플릿 로드', '다단계(Progressive) 입력 스텝', '입력 만료일 및 패스워드 설정', '관리자 입력 강제 수정']
    },
    {
      title: '디자인 토큰 & 블록 어셈블리',
      description: '피그마에서 디자인한 HTML/CSS 파일을 업로드하여 모바일 테마로 등록합니다. 스타일 값(컬러, 폰트, 간격)을 JSON 기반 디자인 토큰으로 분리하여 웹 화면에서 코드 없이 실시간 교체합니다.',
      icon: Palette,
      badge: 'Sprint 4',
      features: ['피그마 HTML/CSS 매핑 연동', '10종 핵심 블록 조립식 설계', '디자인 토큰 JSON 가져오기/내보내기', '하객용 실시간 테마 렌더러']
    },
    {
      title: '청첩장 초안 자동 생성 & 편집기',
      description: '수집된 데이터를 매핑 테이블과 결합하여 단 1초 만에 청첩장 초안을 완성합니다. 직관적인 3단 패널 편집기를 통해 텍스트 내용 수정, 사진 크롭 및 10대 블록 배치를 자유롭게 변경합니다.',
      icon: Layers,
      badge: 'Sprint 5',
      features: ['실시간 프리뷰 사이드 패널', '블록 순서 드래그 앤 드롭 관리', '인라인 텍스트 및 이미지 편집', '자동 저장 및 변경 이력 추적']
    },
    {
      title: '고객 전용 분석 대시보드',
      description: '최종 발행된 청첩장의 하객 RSVP 참석 여부, 식사 정보 및 셔틀 이용 상태를 실시간 분석하고 통계를 제공합니다. 하객 방명록 차단/공개 관리와 일별 방문 카운트 차트를 조회합니다.',
      icon: LineChart,
      badge: 'Sprint 7',
      features: ['연락처 뒷 4자리 패스워드 인증', '참석 정보 실시간 통계 차트', '방명록 유해 콘텐츠 비공개 전환', '예식 14일 후 하객 정보 자동 파기']
    }
  ]

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#3d3d3d] font-sans selection:bg-[#c4a574] selection:text-white flex flex-col">
      
      {/* 1. Translucent Luxury Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
        scrolled 
          ? 'bg-[#faf9f7]/95 backdrop-blur-md border-[#c4a574]/20 py-4' 
          : 'bg-transparent border-transparent py-6'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-6 w-auto text-[#3d3d3d]" />
          </Link>
          
          <nav className="hidden md:flex items-center gap-8 text-[10px] font-bold tracking-widest text-[#3d3d3d]/70 uppercase">
            <a href="#about" className="hover:text-[#c4a574] transition-colors">소개</a>
            <a href="#pillars" className="hover:text-[#c4a574] transition-colors">핵심기능</a>
            <a href="#timeline" className="hover:text-[#c4a574] transition-colors">프로세스</a>
            <Link href="/admin" className="hover:text-[#c4a574] transition-colors">관리자 포털</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="border-[#c4a574]/40 text-[#c4a574] hover:bg-[#c4a574]/5 text-[10px] font-bold rounded-none tracking-widest h-8 px-4" asChild>
              <Link href="/admin/login">로그인</Link>
            </Button>
            <Button size="sm" className="bg-[#c4a574] hover:bg-[#b29363] text-white text-[10px] font-bold rounded-none tracking-widest h-8 px-4" asChild>
              <Link href="/admin/invitations">청첩장 관리</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-24">
        
        {/* 2. Editorial Hero Section */}
        <section id="about" className="py-20 md:py-32 relative overflow-hidden">
          {/* Subtle Background Glow Elements */}
          <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#c4a574]/5 rounded-full filter blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 left-10 w-80 h-80 bg-[#b29363]/5 rounded-full filter blur-2xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-12 gap-12 items-center">
            
            {/* Hero text */}
            <div className="md:col-span-7 space-y-8">
              <div className="inline-flex items-center gap-2 border border-[#c4a574]/30 px-3 py-1 bg-white/50">
                <Sparkles className="w-3.5 h-3.5 text-[#c4a574]" />
                <span className="text-[10px] font-bold tracking-widest text-[#c4a574] uppercase">VOW SEOUL MWI Version 2.0</span>
              </div>
              
              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal leading-[1.1] tracking-tight font-serif text-[#3d3d3d]">
                  Where your <br />
                  <span className="italic text-[#c4a574]">Eternal Vow</span> begins.
                </h1>
                <p className="text-sm sm:text-base text-[#3d3d3d]/70 max-w-xl leading-relaxed font-sans">
                  바우서울의 고급 지류 감성과 모바일의 똑똑한 편의성을 유기적으로 연결하는 신개념 지류-모바일 통합형 청첩장 제작 프로세스 관리 엔진입니다.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <Button size="lg" className="bg-[#3d3d3d] hover:bg-[#525252] text-white rounded-none tracking-widest text-xs font-semibold h-12 px-8" asChild>
                  <Link href="/admin/invitations">
                    청첩장 초안 제작 개시 <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-[#3d3d3d] text-[#3d3d3d] hover:bg-[#3d3d3d]/5 rounded-none tracking-widest text-xs font-semibold h-12 px-8" asChild>
                  <a href="#pillars">기능 다이어그램</a>
                </Button>
              </div>

              {/* Sub-badges for verify */}
              <div className="pt-6 border-t border-[#c4a574]/20 grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#c4a574]" />
                  <span className="text-xs font-semibold text-[#3d3d3d]/80">정보 수집 자동화</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#c4a574]" />
                  <span className="text-xs font-semibold text-[#3d3d3d]/80">피그마 토큰 매핑</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#c4a574]" />
                  <span className="text-xs font-semibold text-[#3d3d3d]/80">실시간 RSVP 통계</span>
                </div>
              </div>
            </div>

            {/* Premium Mockup Graphic (CSS Editor layout mockup) */}
            <div className="md:col-span-5 relative">
              <div className="border border-[#c4a574]/30 bg-white p-6 relative z-10">
                <div className="flex justify-between items-center border-b border-[#faf9f7] pb-4 mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">vowseoul_editor.exe</span>
                </div>
                
                {/* Visual mockup of the 3-panel editor */}
                <div className="space-y-3 font-mono text-[10px]">
                  <div className="bg-[#faf9f7] p-2 border border-[#c4a574]/15">
                    <span className="text-[#c4a574]">const</span> designTokens = &#123;
                    <div className="pl-3 text-muted-foreground">
                      "primary": <span className="text-green-600">"#c4a574"</span>,<br />
                      "fontFamily": <span className="text-green-600">"Playfair Display"</span>,<br />
                      "spacing": <span className="text-green-600">"48px"</span>
                    </div>
                    &#125;
                  </div>
                  <div className="bg-[#faf9f7] p-2 border border-[#c4a574]/15 space-y-1.5">
                    <div className="flex justify-between items-center text-[#3d3d3d] font-semibold">
                      <span>✓ 데이터 바인딩 상태</span>
                      <span className="text-[9px] text-[#c4a574] bg-[#c4a574]/10 px-1">CONNECTED</span>
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      • groom_name ↔ '이민수'<br />
                      • wedding_date ↔ '2026. 10. 24'
                    </div>
                  </div>
                  <div className="bg-[#c4a574] text-white p-3 text-center uppercase tracking-widest text-[9px] font-bold">
                    실시간 3단 프리뷰 동기화
                  </div>
                </div>
              </div>
              
              {/* Backing Accent Frame */}
              <div className="absolute -inset-2 border border-[#c4a574]/20 -z-10 translate-x-3 translate-y-3" />
            </div>

          </div>
        </section>

        {/* 3. Core System Pillars Section */}
        <section id="pillars" className="py-20 border-t border-[#c4a574]/20 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            
            <div className="max-w-2xl mb-16 space-y-2">
              <span className="text-[10px] font-bold tracking-widest text-[#c4a574] uppercase">Architecture & Features</span>
              <h2 className="text-3xl font-serif text-[#3d3d3d]">프로젝트 핵심 아키텍처 4대 기둥</h2>
              <p className="text-xs text-muted-foreground">구글 폼 취합과 소스코드 병목 현상을 해결하는 체계적인 4단 워크플로우 솔루션입니다.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {systemPillars.map((p, index) => {
                const IconComponent = p.icon
                return (
                  <div 
                    key={index} 
                    className="border border-[#c4a574]/20 hover:border-[#c4a574]/60 p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 bg-[#faf9f7]/40"
                  >
                    <div className="space-y-6">
                      <div className="flex justify-between items-start">
                        <div className="p-3 bg-[#faf9f7] border border-[#c4a574]/20">
                          <IconComponent className="w-5 h-5 text-[#c4a574]" />
                        </div>
                        <span className="text-[9px] font-mono bg-white px-2 py-0.5 border border-[#c4a574]/20 text-muted-foreground uppercase">{p.badge}</span>
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm text-[#3d3d3d] font-serif">{p.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                      </div>
                    </div>

                    <div className="pt-6 mt-6 border-t border-[#c4a574]/10 space-y-1.5">
                      {p.features.map((feat, fIndex) => (
                        <div key={fIndex} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="w-1 h-1 rounded-full bg-[#c4a574]" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

          </div>
        </section>

        {/* 4. Timeline / How It Works */}
        <section id="timeline" className="py-20 border-t border-[#c4a574]/20">
          <div className="max-w-7xl mx-auto px-6">
            
            <div className="text-center max-w-xl mx-auto mb-16 space-y-2">
              <span className="text-[10px] font-bold tracking-widest text-[#c4a574] uppercase">Workflow Timeline</span>
              <h2 className="text-3xl font-serif text-[#3d3d3d]">청첩장 제작 자동화 시나리오</h2>
              <p className="text-xs text-muted-foreground">정보 수집부터 최종 하객 배포 및 RSVP 접수 통계까지의 5단계 일련의 과정입니다.</p>
            </div>

            <div className="grid md:grid-cols-5 gap-6 relative">
              
              <div className="space-y-4 text-center border border-[#c4a574]/15 bg-white p-6 relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#3d3d3d] text-white flex items-center justify-center font-mono text-xs font-bold">1</span>
                <div className="pt-2 text-xs font-serif font-semibold text-[#3d3d3d]">고객 정보 수집</div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  라인업에 맞는 맞춤형 폼 링크 생성 후 비밀번호와 함께 카카오톡으로 고객에게 전송합니다.
                </p>
              </div>

              <div className="space-y-4 text-center border border-[#c4a574]/15 bg-white p-6 relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#3d3d3d] text-white flex items-center justify-center font-mono text-xs font-bold">2</span>
                <div className="pt-2 text-xs font-serif font-semibold text-[#3d3d3d]">데이터 자동 바인딩</div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  고객이 입력을 완료하면 미리 연동된 매핑 데이터 키에 맞춰 모바일 초안이 자동 완성됩니다.
                </p>
              </div>

              <div className="space-y-4 text-center border border-[#c4a574]/15 bg-white p-6 relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#3d3d3d] text-white flex items-center justify-center font-mono text-xs font-bold">3</span>
                <div className="pt-2 text-xs font-serif font-semibold text-[#3d3d3d]">비주얼 편집 & 교정</div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  3단 편집기를 통해 디자이너가 업로드한 블록의 노출 여부, 순서, 색상 테마를 세밀하게 가다듬습니다.
                </p>
              </div>

              <div className="space-y-4 text-center border border-[#c4a574]/15 bg-white p-6 relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#3d3d3d] text-white flex items-center justify-center font-mono text-xs font-bold">4</span>
                <div className="pt-2 text-xs font-serif font-semibold text-[#3d3d3d]">단축 링크 발행</div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  완성된 청첩장을 `/w/[slug]` 형태의 영구 숏링크로 단독 퍼블리싱 및 QR코드로 내려받습니다.
                </p>
              </div>

              <div className="space-y-4 text-center border border-[#c4a574]/15 bg-white p-6 relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#3d3d3d] text-white flex items-center justify-center font-mono text-xs font-bold">5</span>
                <div className="pt-2 text-xs font-serif font-semibold text-[#3d3d3d]">실시간 피드백 관리</div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  신랑신부는 대시보드에서 하객의 RSVP 여부와 축하글 목록을 실시간 제어 및 데이터 백업합니다.
                </p>
              </div>

            </div>

          </div>
        </section>

        {/* 5. Dual Call To Action Segment */}
        <section className="py-20 bg-[#3d3d3d] text-white border-t border-[#c4a574]/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#c4a574]/10 rounded-full filter blur-3xl pointer-events-none" />
          
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12">
            
            {/* Admin Block */}
            <div className="border border-[#c4a574]/30 p-8 space-y-6 bg-white/5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-1.5 text-[#c4a574] text-xs font-bold uppercase tracking-widest">
                  <ShieldCheck className="w-4 h-4" /> VOW SEOUL STAFF PORTAL
                </div>
                <h3 className="text-xl font-serif text-white">운영 및 디자이너 전용 포털</h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  신규 고객 생성, 지류 청첩장별 정보수집 폼 커스터마이징, 테마 디자인 업로드 및 매핑 바인딩 설정을 진행할 수 있습니다.
                </p>
              </div>
              <Button className="bg-[#c4a574] hover:bg-[#b29363] text-white w-full rounded-none tracking-widest text-xs font-semibold h-10 mt-4" asChild>
                <Link href="/admin/login">관리 콘솔 로그인</Link>
              </Button>
            </div>

            {/* Customer Block */}
            <div className="border border-[#c4a574]/30 p-8 space-y-6 bg-white/5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-1.5 text-[#c4a574] text-xs font-bold uppercase tracking-widest">
                  <Layers className="w-4 h-4" /> BRIDE & GROOM DASHBOARD
                </div>
                <h3 className="text-xl font-serif text-white">신랑신부 통계 대시보드 진입</h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  발행된 청첩장의 하객 참석 여부 및 피드백 방명록 통계를 실시간으로 체크하고 관리하기 위한 입구입니다. (전용 비밀번호 확인 필요)
                </p>
              </div>
              
              {/* Form redirect to dashboard verify */}
              <div className="flex gap-2 mt-4">
                <input 
                  type="text"
                  placeholder="신랑신부 숏링크 주소 (예: minsu-wedding)" 
                  className="flex-1 bg-white/10 border border-[#c4a574]/30 px-3 text-xs focus:outline-none focus:border-[#c4a574] text-white placeholder-white/40"
                  id="slugInput"
                />
                <Button 
                  onClick={() => {
                    const val = (document.getElementById('slugInput') as HTMLInputElement)?.value;
                    if (val && val.trim()) {
                      window.location.href = `/dashboard/${val.trim()}`;
                    } else {
                      alert('숏링크 주소를 입력해주세요.');
                    }
                  }}
                  className="bg-white hover:bg-neutral-200 text-[#3d3d3d] rounded-none tracking-widest text-xs font-semibold h-10 px-4"
                >
                  진입 <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* 6. Minimal Luxury Footer */}
      <footer className="bg-[#faf9f7] border-t border-[#c4a574]/20 py-12 text-[#3d3d3d]/50 text-xs font-sans">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Logo className="h-4 w-auto text-[#3d3d3d]/40" />
            <span className="tracking-widest">MWI SYSTEM VER 2.0</span>
          </div>
          <div className="flex gap-8">
            <a href="mailto:support@vowseoul.com" className="hover:text-[#c4a574] transition-colors">고객 지원</a>
          </div>
          <div>
            © 2026 VOW SEOUL. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  )
}
