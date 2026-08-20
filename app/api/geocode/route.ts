import { NextResponse } from 'next/server';
import https from 'https';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * 주소 → 좌표 변환. 하객이 청첩장 지도를 열 때마다 불린다
 * (§components/invitation/islands/map-island.tsx, components/naver-map.tsx).
 *
 * 인증이 없고 있을 수도 없다 — 하객은 로그인하지 않는다. 그런데 이 라우트는 서버에
 * 보관된 네이버 클라우드 자격증명으로 유료 API 를 대신 호출한다. 주소만 바꿔가며
 * 반복 호출하면 그대로 과금과 쿼터 소진으로 이어진다.
 *
 * 방어는 두 겹이고, 순서가 중요하다:
 *
 *  1. 캐시. 진짜 문제는 호출 횟수가 아니라 "같은 주소를 매번 다시 물어본다"는 것이다.
 *     예식장 주소는 바뀌지 않으므로 한 번 얻은 좌표를 오래 재사용하면 된다. 응답에
 *     캐시 헤더를 달면 같은 주소 요청은 CDN 이 받아내고 NCP 까지 가지 않는다 —
 *     비용도 줄고 하객의 지도도 빨라진다.
 *  2. 남은 실호출(= 서로 다른 주소)에만 IP 단위 제한. 기본값 10회는 여기 쓸 수 없다.
 *     같은 통신사 NAT 뒤 하객들이 IP 를 공유하므로 정상 하객의 지도가 먼저 깨진다.
 */

const MAX_PER_WINDOW = 60      // 15분. 사람이 여는 지도로는 닿지 않고, 스크립트는 걸린다
const MAX_QUERY_LENGTH = 200   // 이보다 긴 주소는 없다 — 캐시 키를 무한히 늘리는 것도 막는다
const CACHE_HEADER = 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: 'Query is too long' }, { status: 400 });
  }

  if (!(await checkRateLimit('geocode', getClientIp(request), MAX_PER_WINDOW))) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 });
  }

  const apiKeyId = process.env.NCP_MAPS_API_KEY_ID;
  const apiKey = process.env.NCP_MAPS_API_KEY;
  if (!apiKeyId || !apiKey) {
    console.error('NCP_MAPS_API_KEY_ID / NCP_MAPS_API_KEY 환경변수가 설정되지 않았습니다.');
    return NextResponse.json({ error: 'Geocoding service not configured' }, { status: 500 });
  }

  return new Promise<Response>((resolve) => {
    const encodedQuery = encodeURIComponent(query);
    const options = {
      hostname: 'maps.apigw.ntruss.com',
      path: `/map-geocode/v2/geocode?query=${encodedQuery}`,
      method: 'GET',
      headers: {
        // NCP Maps Geocoding API가 요구하는 정확한 대문자 헤더를 전송합니다.
        'X-NCP-APIGW-API-KEY-ID': apiKeyId,
        'X-NCP-APIGW-API-KEY': apiKey,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(data);
            // 성공 응답만 캐시한다 — 실패까지 오래 붙들면 일시적 장애가 굳어버린다
            resolve(NextResponse.json(parsedData, { headers: { 'Cache-Control': CACHE_HEADER } }));
          } catch (e: any) {
            resolve(NextResponse.json({ error: 'Failed to parse JSON response', details: e.message }, { status: 500 }));
          }
        } else {
          console.error('NCP Maps Geocoding API raw error response:', {
            status: res.statusCode,
            body: data
          });
          resolve(NextResponse.json({ error: `NCP API error: ${res.statusMessage}`, details: data }, { status: res.statusCode || 500 }));
        }
      });
    });

    req.on('error', (error) => {
      console.error('NCP Maps Geocoding Connection error:', error);
      resolve(NextResponse.json({ error: 'Geocoding connection failed', details: error.message }, { status: 500 }));
    });

    req.end();
  });
}
