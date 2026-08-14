"use client"

import { useEffect, useRef, useState } from "react"
import { soft, type SlotProps } from "./shared"

/* ------------------------------- Map --------------------------------
 * 네이버 지도(NCP Maps) 연동. iframe(별도 realm) 안에 렌더되므로
 * 지도 스크립트도 iframe 자신의 문서(mapRef.current.ownerDocument)에 로드해야
 * 그 문서의 window.naver 에서 접근할 수 있다. 지오코딩은 서버의 /api/geocode
 * 라우트(NCP 인증키를 감추는 프록시)를 통해 top realm에서 그대로 fetch한다.
 * ------------------------------------------------------------------ */
const NAVER_MAPS_SCRIPT_ID = "naver-maps-script"
const NAVER_CLIENT_ID = "od370yq3ix"

function MapIsland({ data }: SlotProps) {
  const address = data.venue_address || ""
  const venueName = data.venue_name || ""
  const mapRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    if (!address || !mapRef.current) return
    const ownerDoc = mapRef.current.ownerDocument
    const ownerWin = ownerDoc?.defaultView as (Window & { naver?: any }) | null | undefined
    if (!ownerDoc || !ownerWin) return

    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null

    const ensureScript = () => new Promise<void>((resolve) => {
      if (ownerWin.naver?.maps) { resolve(); return }
      const existing = ownerDoc.getElementById(NAVER_MAPS_SCRIPT_ID) as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener("load", () => resolve())
        return
      }
      const script = ownerDoc.createElement("script")
      script.id = NAVER_MAPS_SCRIPT_ID
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_CLIENT_ID}`
      script.async = true
      script.onload = () => resolve()
      ownerDoc.head.appendChild(script)
    })

    const waitForNaver = () => new Promise<void>((resolve) => {
      const check = () => {
        if (ownerWin.naver?.maps?.LatLng) { resolve(); return }
        pollTimer = setTimeout(check, 150)
      }
      check()
    })

    ;(async () => {
      await ensureScript()
      if (cancelled) return
      await waitForNaver()
      if (cancelled) return

      try {
        const res = await fetch(`/api/geocode?query=${encodeURIComponent(address)}`)
        if (!res.ok) { if (!cancelled) setMapError(true); return }
        const json = await res.json()
        const item = json?.addresses?.[0]
        if (!item || cancelled || !mapRef.current) { if (!cancelled) setMapError(true); return }

        const lat = parseFloat(item.y)
        const lng = parseFloat(item.x)
        const naver = ownerWin.naver
        const center = new naver.maps.LatLng(lat, lng)
        const map = new naver.maps.Map(mapRef.current, { center, zoom: 16, zoomControl: false })
        new naver.maps.Marker({ position: center, map, title: venueName })
        setCoords({ lat, lng })
        setMapError(false)
      } catch {
        if (!cancelled) setMapError(true)
      }
    })()

    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [address, venueName])

  const openNaver = () => window.open(`https://map.naver.com/v5/search/${encodeURIComponent(address)}`, "_blank")
  const openKakao = () => {
    const url = coords
      ? `https://map.kakao.com/link/to/${encodeURIComponent(venueName)},${coords.lat},${coords.lng}`
      : `https://map.kakao.com/?q=${encodeURIComponent(address)}`
    window.open(url, "_blank")
  }
  const openTmap = () => {
    if (!coords) return
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile) {
      window.location.href = `tmap://route?goalx=${coords.lng}&goaly=${coords.lat}&goalname=${encodeURIComponent(venueName)}`
      setTimeout(openNaver, 1500)
    } else {
      openNaver()
    }
  }

  const navBtn: React.CSSProperties = {
    flex: 1, padding: "9px 0", borderRadius: 6, cursor: "pointer", textAlign: "center",
    border: `1px solid ${soft(60)}`, background: "transparent", color: "inherit", fontSize: 12,
  }

  return (
    <div style={{ width: "100%", maxWidth: 320, margin: "0 auto" }}>
      {!address || mapError ? (
        <div style={{
          aspectRatio: "16/10", borderRadius: 4, overflow: "hidden",
          background: "repeating-linear-gradient(45deg, #efe7e2, #efe7e2 10px, #e7ddd6 10px, #e7ddd6 20px)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#9a8f88", fontSize: 12,
        }}>
          {address ? "지도를 불러올 수 없습니다" : "주소가 등록되지 않았습니다"}
        </div>
      ) : (
        <div ref={mapRef} style={{ width: "100%", aspectRatio: "16/10", borderRadius: 4, overflow: "hidden", background: "#eee" }} />
      )}

      {address && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button onClick={openNaver} style={navBtn}>네이버지도</button>
          <button onClick={openKakao} style={navBtn}>카카오맵</button>
          <button onClick={openTmap} style={navBtn}>티맵</button>
        </div>
      )}
    </div>
  )
}
export { MapIsland }
