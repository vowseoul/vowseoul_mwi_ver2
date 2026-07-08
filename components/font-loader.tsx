'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function FontLoader() {
  const [customFonts, setCustomFonts] = useState<any[]>([])

  useEffect(() => {
    const loadFonts = async () => {
      try {
        const { data } = await supabase.from('settings').select('*').eq('key', 'fonts')
        if (data && data.length > 0 && data[0].value) {
          setCustomFonts(data[0].value)
        }
      } catch (err) {
        console.error('Error fetching fonts in FontLoader:', err)
      }
    }
    loadFonts()
  }, [])

  if (customFonts.length === 0) {
    const defaultGoogleFonts = `@import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300..700;1,300..700&family=Cinzel:wght@400..900&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Inter:wght@100..900&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400..700;1,400..700&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Serif+KR:wght@200..900&family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Quicksand:wght@300..700&display=swap');`;
    return <style dangerouslySetInnerHTML={{ __html: defaultGoogleFonts }} />
  }

  const defaultGoogleFonts = `@import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300..700;1,300..700&family=Cinzel:wght@400..900&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Inter:wght@100..900&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400..700;1,400..700&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Serif+KR:wght@200..900&family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Quicksand:wght@300..700&display=swap');`;

  const imports = customFonts
    .filter(f => f.type === 'embed')
    .map(f => {
      let code = f.embedCode || '';
      // Strip style tags if present
      code = code.replace(/<\/?style>/gi, '');
      return code;
    })
    .join('\n');

  const directImports = customFonts
    .filter(f => f.url)
    .map(f => `@import url('${f.url}');`)
    .join('\n');

  const fontFaces = customFonts
    .filter(f => f.type === 'file' && f.fileUrl)
    .map(f => {
      // Use local API proxy to bypass CORS restrictions on cross-origin font files
      const proxiedUrl = `/api/fonts?url=${encodeURIComponent(f.fileUrl)}`;
      return `
        @font-face {
          font-family: '${f.family}';
          src: url('${proxiedUrl}') format('truetype');
          font-display: swap;
        }
      `;
    })
    .join('\n');

  const css = `${defaultGoogleFonts}\n${imports}\n${directImports}\n${fontFaces}`;

  return (
    <style dangerouslySetInnerHTML={{ __html: css }} />
  )
}
