import { NextResponse } from 'next/server';
import https from 'https';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  return new Promise<Response>((resolve) => {
    const encodedQuery = encodeURIComponent(query);
    const options = {
      hostname: 'maps.apigw.ntruss.com',
      path: `/map-geocode/v2/geocode?query=${encodedQuery}`,
      method: 'GET',
      headers: {
        // NCP Maps Geocoding API가 요구하는 정확한 대문자 헤더를 전송합니다.
        'X-NCP-APIGW-API-KEY-ID': 'od370yq3ix',
        'X-NCP-APIGW-API-KEY': 'PjdSYiZq4qw7CWQVGtIuitUJJezKhkhFOU5SzizE',
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
            resolve(NextResponse.json(parsedData));
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
