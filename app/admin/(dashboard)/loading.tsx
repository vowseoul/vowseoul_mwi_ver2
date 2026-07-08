'use client'

import React from 'react'

export default function Loading() {
  return (
    <div className="w-full h-[60vh] flex flex-col items-center justify-center font-sans">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm font-light">데이터를 불러오는 중입니다...</p>
      </div>
    </div>
  )
}
