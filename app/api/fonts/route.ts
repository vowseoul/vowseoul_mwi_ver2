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

    let contentType = response.headers.get('content-type') || 'font/ttf'
    if (contentType === 'application/octet-stream') {
      contentType = 'font/ttf'
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
