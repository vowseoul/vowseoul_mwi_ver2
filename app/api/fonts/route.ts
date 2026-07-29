import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return new NextResponse(`Failed to fetch font from source: ${response.statusText}`, { status: response.status })
    }

    let contentType = response.headers.get('content-type') || ''
    const lowercaseUrl = url.toLowerCase()
    let detectedType = 'font/ttf'

    if (lowercaseUrl.includes('.woff2')) {
      detectedType = 'font/woff2'
    } else if (lowercaseUrl.includes('.woff')) {
      detectedType = 'font/woff'
    } else if (lowercaseUrl.includes('.otf')) {
      detectedType = 'font/otf'
    } else if (lowercaseUrl.includes('.ttf')) {
      detectedType = 'font/ttf'
    } else if (lowercaseUrl.includes('.eot')) {
      detectedType = 'application/vnd.ms-fontobject'
    }

    // iOS Safari / 카카오톡 인앱 웹뷰는 MIME이 폰트 타입이 아니면 파싱을 거부한다.
    // Supabase Storage가 text/plain 을 내려주는 경우가 있어 octet-stream 뿐 아니라
    // text/plain 도 확장자 기반 타입으로 교정해야 한다.
    if (!contentType || contentType === 'application/octet-stream' || contentType === 'text/plain') {
      contentType = detectedType
    }

    const fontBuffer = await response.arrayBuffer()

    return new NextResponse(fontBuffer, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error proxying font file:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
