'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  useBlockLibraryQuery, 
  useBlockVariantsQuery 
} from '@/hooks/queries/useThemes'
import { ArrowLeft, Box, LayoutGrid, Loader2, Sparkles, HelpCircle } from 'lucide-react'

export default function BlockLibraryPage() {
  const { data: blocks, isLoading: isLoadingBlocks } = useBlockLibraryQuery()
  const { data: variants, isLoading: isLoadingVariants } = useBlockVariantsQuery()

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

  const activeBlock = blocks?.find(b => b.id === selectedBlockId)
  const activeVariants = variants?.filter(v => v.block_library_id === selectedBlockId) || []

  // Default select first block
  React.useEffect(() => {
    if (blocks && blocks.length > 0 && !selectedBlockId) {
      setSelectedBlockId(blocks[0].id)
    }
  }, [blocks, selectedBlockId])

  if (isLoadingBlocks || isLoadingVariants) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm mt-4">블럭 라이브러리를 로드하고 있습니다...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/assets">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">블럭 라이브러리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            모바일 청첩장을 구성하는 컴포넌트(블럭)와 디자인 스타일 변형(Variant) 레지스트리입니다
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Side: Blocks List (4/12 width) */}
        <div className="md:col-span-4 space-y-3">
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Box className="w-4 h-4 text-primary" /> 블럭 종류 ({blocks?.length || 0}종)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {blocks?.map((block) => {
                const isActive = block.id === selectedBlockId
                const blockVariantsCount = variants?.filter(v => v.block_library_id === block.id).length || 0
                return (
                  <button
                    key={block.id}
                    onClick={() => setSelectedBlockId(block.id)}
                    className={`w-full text-left px-3.5 py-3 rounded-lg text-sm transition-colors flex items-center justify-between ${
                      isActive 
                        ? 'bg-foreground text-background font-medium' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <div>
                      <span className="block">{block.name}</span>
                      <span className={`text-[10px] font-mono block mt-0.5 ${isActive ? 'text-background/70' : 'text-muted-foreground/75'}`}>
                        {block.block_key}
                      </span>
                    </div>
                    <Badge variant={isActive ? 'secondary' : 'outline'} className="text-[10px] h-5">
                      {blockVariantsCount}개 스타일
                    </Badge>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Block Details & Variants (8/12 width) */}
        <div className="md:col-span-8 space-y-4">
          {activeBlock ? (
            <>
              {/* Block Info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{activeBlock.name}</h2>
                      <span className="text-xs text-muted-foreground font-mono mt-0.5 block">{activeBlock.block_key}</span>
                    </div>
                    <div className="flex gap-2">
                      {activeBlock.is_required && <Badge variant="default">필수 구성</Badge>}
                      {!activeBlock.allow_duplicate && <Badge variant="secondary">단일 배치</Badge>}
                    </div>
                  </div>
                  <CardDescription className="text-xs pt-1.5 leading-relaxed">
                    {activeBlock.description || '블럭에 대한 설명이 등록되지 않았습니다.'}
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Variants Grid */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5" /> 스타일 변형 (Variants) 목록
                </h3>

                {activeVariants.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground text-sm">
                    등록된 스타일 변형(Variant)이 없습니다.
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeVariants.map((variant) => (
                      <Card key={variant.id} className="overflow-hidden bg-card border-border flex flex-col justify-between">
                        <div className="p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold text-sm text-foreground">{variant.name}</h4>
                              <span className="text-[10px] font-mono text-muted-foreground mt-0.5 block">
                                key: {variant.variant_key}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-[10px] h-5">
                              React Component
                            </Badge>
                          </div>
                          
                          <p className="text-xs text-muted-foreground pt-1 leading-relaxed">
                            {variant.description || '세부 스타일 설명이 없습니다.'}
                          </p>
                        </div>
                        
                        <div className="px-4 py-3 bg-muted/20 border-t border-border flex justify-between items-center text-[10px] text-muted-foreground">
                          <span>연동 컴포넌트:</span>
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                            {variant.react_component_name}.tsx
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <Card className="p-8 text-center text-muted-foreground text-sm">
              왼쪽 목록에서 블럭을 선택하여 세부 사양을 확인하세요.
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
