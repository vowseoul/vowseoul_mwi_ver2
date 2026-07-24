'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { sampleThemes, Theme } from '@/lib/store'
import { supabase, logSupabaseError } from '@/lib/supabase'
import { resolveThemeSwatch } from '@/lib/theme-template'
import { Eye, FileText, Loader2 } from 'lucide-react'

export default function TemplatesPage() {
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null)
  const [themes, setThemes] = useState<Theme[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchThemes = async () => {
      const { data, error } = await supabase.from('themes').select('*')
      logSupabaseError('fetchThemes (templates page)', error)
      if (data && data.length > 0) {
        setThemes(data as any)
      } else {
        setThemes(sampleThemes)
      }
      setIsLoading(false)
    }
    fetchThemes()
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Page Header */}
        <section className="border-b border-border bg-muted/30 py-16">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              템플릿 갤러리
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              다양한 스타일의 프리미엄 템플릿 중에서 
              당신의 웨딩에 어울리는 디자인을 선택하세요.
            </p>
          </div>
        </section>

        {/* Template Grid */}
        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {themes.map((theme) => {
                  const { bg: defaultBg, text: defaultText, primary: defaultPrimary } = resolveThemeSwatch(theme);

                  return (
                    <div
                      key={theme.id}
                      className="group relative overflow-hidden rounded-lg border border-border bg-card"
                      onMouseEnter={() => setHoveredTheme(theme.id)}
                      onMouseLeave={() => setHoveredTheme(null)}
                    >
                      {/* Theme Thumbnail */}
                      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                        {theme.thumbnail ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={theme.thumbnail} alt={theme.name} className="w-full h-full object-cover" />
                        ) : (
                          <div 
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ backgroundColor: defaultBg }}
                          >
                            <div className="text-center" style={{ color: defaultText }}>
                              <p className="mb-2 text-xs tracking-[0.3em] opacity-60">WEDDING</p>
                              <p className="font-serif text-2xl">Your Name</p>
                              <p className="my-2 opacity-60">&amp;</p>
                              <p className="font-serif text-2xl">Partner</p>
                              <div 
                                className="mx-auto mt-6 h-24 w-20 rounded-sm"
                                style={{ backgroundColor: defaultPrimary }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Hover Overlay */}
                        <div 
                          className={`absolute inset-0 flex flex-col items-center justify-center gap-4 bg-foreground/70 transition-opacity duration-300 ${
                            hoveredTheme === theme.id ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <h3 className="text-xl font-medium text-white">{theme.name}</h3>
                          <div className="flex gap-3">
                            <Button 
                              variant="secondary" 
                              size="sm"
                              asChild
                            >
                              <Link href={`/preview/template/${theme.id}`}>
                                <Eye className="mr-1.5 h-4 w-4" />
                                샘플 미리보기
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              asChild
                            >
                              <a href="https://mkt.shopping.naver.com/link/6a20207aa4d80c5688e963db" target="_blank" rel="noopener noreferrer">
                                <FileText className="mr-1.5 h-4 w-4" />
                                이 템플릿으로 구매하기
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Theme Info */}
                      <div className="p-4">
                        <h3 className="font-medium">{theme.name}</h3>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(Array.isArray(theme.tags) ? theme.tags : []).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t border-border bg-muted/30 py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold tracking-tight">
              원하는 템플릿을 찾지 못하셨나요?
            </h2>
            <p className="mt-3 text-muted-foreground">
              스토어에서 상담을 통해 나만의 청첩장을 만들어보세요.
            </p>
            <Button size="lg" className="mt-6" asChild>
              <a href="https://mkt.shopping.naver.com/link/6a20207aa4d80c5688e963db" target="_blank" rel="noopener noreferrer">
                스토어 바로가기
              </a>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
