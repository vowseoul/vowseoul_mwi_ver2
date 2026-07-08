'use client'

import React, { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

interface NaverMapProps {
  address: string;
  venueName: string;
}

export function NaverMap({ address, venueName }: NaverMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    // 1. Load Naver Map Script if not loaded
    const windowAny = window as any;
    if (windowAny.naver && windowAny.naver.maps) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.getElementById('naver-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.id = 'naver-maps-script';
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=od370yq3ix`;
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, [])

  useEffect(() => {
    if (!scriptLoaded || !mapRef.current || !address) return

    let isMounted = true;
    let timerId: NodeJS.Timeout | null = null;

    const initMap = () => {
      const windowAny = window as any;
      const naver = windowAny.naver;

      if (!naver || !naver.maps || !naver.maps.LatLng) {
        if (isMounted) {
          timerId = setTimeout(initMap, 200); // 200ms 간격으로 네이버 지도 서비스 로드 폴링
        }
        return;
      }

      // 서버의 geocode API route 호출
      fetch(`/api/geocode?query=${encodeURIComponent(address)}`)
        .then(res => {
          if (!res.ok) {
            setMapError(true);
            return null;
          }
          return res.json();
        })
        .then(data => {
          if (!data || !isMounted) return;
          if (!data.addresses || data.addresses.length === 0) {
            setMapError(true);
            return;
          }

          const item = data.addresses[0];
          const lat = parseFloat(item.y);
          const lng = parseFloat(item.x);
          const location = new naver.maps.LatLng(lat, lng);
          setCoords({ lat, lng });
          setMapError(false);

          // 3. Create Map
          if (mapRef.current) {
            const map = new naver.maps.Map(mapRef.current, {
              center: location,
              zoom: 16,
              zoomControl: false
            });

            // 4. Create Marker
            new naver.maps.Marker({
              position: location,
              map: map,
              title: venueName
            });
          }
        })
        .catch(err => {
          console.error('Server geocoding fetch failed:', err);
          if (isMounted) {
            setMapError(true);
          }
        });
    };

    initMap();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [scriptLoaded, address, venueName])

  const handleTmapClick = () => {
    if (!coords) return;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `tmap://route?goalx=${coords.lng}&goaly=${coords.lat}&goalname=${encodeURIComponent(venueName)}`;
      setTimeout(() => {
        window.open(`https://map.naver.com/v5/search/${encodeURIComponent(address)}`, '_blank');
      }, 1500);
    } else {
      window.open(`https://map.naver.com/v5/search/${encodeURIComponent(address)}`, '_blank');
    }
  }

  return (
    <div className="w-full space-y-3">
      {/* Naver Map container */}
      {mapError ? (
        <div 
          className="w-full h-60 rounded-lg border border-black/10 bg-black/[0.02] dark:bg-white/[0.02] flex flex-col items-center justify-center p-4 text-center space-y-1.5"
          style={{ minHeight: '240px' }}
        >
          <MapPin className="w-5 h-5 opacity-40 text-muted-foreground" />
          <p className="text-xs font-semibold opacity-75">지도를 불러올 수 없습니다</p>
          <p className="text-[10px] opacity-50 max-w-[240px] truncate">{address}</p>
        </div>
      ) : (
        <div 
          ref={mapRef} 
          className="w-full h-60 rounded-lg overflow-hidden border border-black/5 shadow-inner" 
          style={{ minHeight: '240px' }}
        />
      )}

      {/* Navigation App buttons */}
      <div className="flex gap-2">
        {/* Naver Map */}
        <a 
          href={`https://map.naver.com/v5/search/${encodeURIComponent(address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-9 rounded-lg border border-black/10 bg-white flex items-center justify-center gap-1.5 text-xs font-medium text-black hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
        >
          <div className="w-4 h-4 rounded bg-[#03C75A] flex items-center justify-center text-white text-[8px] font-extrabold font-sans leading-none">N</div>
          <span>네이버</span>
        </a>

        {/* Kakao Map */}
        <a 
          href={coords ? `https://map.kakao.com/link/to/${encodeURIComponent(venueName)},${coords.lat},${coords.lng}` : `https://map.kakao.com/?q=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-9 rounded-lg border border-black/10 bg-white flex items-center justify-center gap-1.5 text-xs font-medium text-black hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
        >
          <div className="w-4 h-4 rounded bg-[#FFE600] flex items-center justify-center">
            <svg className="w-3 h-3 text-[#2C7BFA]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
          <span>카카오</span>
        </a>

        {/* T-Map */}
        <button 
          onClick={handleTmapClick}
          className="flex-1 h-9 rounded-lg border border-black/10 bg-white flex items-center justify-center gap-1.5 text-xs font-medium text-black hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
        >
          <div className="w-4 h-4 rounded bg-gradient-to-tr from-[#1E5AF3] to-[#8A3DF2] flex items-center justify-center text-white text-[9px] font-extrabold leading-none">T</div>
          <span>티맵</span>
        </button>
      </div>
    </div>
  )
}
