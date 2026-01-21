/**
 * 이미지 생성 API (사용자별 API 키 사용)
 */

import jwt from 'jsonwebtoken';
import { GoogleAuth } from 'google-auth-library';
import { getUserApiSettings, checkQuota, incrementQuota } from '../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export default async function handler(request) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers });
    }

    if (request.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers }
        );
    }

    // JWT 토큰 검증
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
            JSON.stringify({ error: '로그인이 필요합니다' }),
            { status: 401, headers }
        );
    }

    const token = authHeader.substring(7);

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return new Response(
            JSON.stringify({ error: '인증이 만료되었습니다. 다시 로그인해주세요' }),
            { status: 401, headers }
        );
    }

    try {
        // 사용자 API 설정 가져오기
        const apiSettings = await getUserApiSettings(decoded.username);

        // Vertex AI Project ID 필수 검증
        if (!apiSettings.projectId) {
            return new Response(
                JSON.stringify({ error: 'Vertex AI Project ID를 먼저 설정해주세요. API 등록 메뉴에서 설정하세요.' }),
                { status: 400, headers }
            );
        }

        // 일일 할당량 확인 (사용자별 100장)
        const quota = await checkQuota(decoded.username);

        if (quota >= 100) {
            return new Response(
                JSON.stringify({ error: '오늘 사용 가능한 이미지 생성 횟수(100장)를 모두 사용했습니다' }),
                { status: 429, headers }
            );
        }

        // 이미지 생성 요청
        const { prompt, aspectRatio = '1:1' } = await request.json();

        if (!prompt) {
            return new Response(
                JSON.stringify({ error: 'prompt is required' }),
                { status: 400, headers }
            );
        }

        console.log(`🎨 이미지 생성 요청: ${decoded.username} (${quota + 1}/100)`);

        // Vertex AI로 이미지 생성 (Service Account 방식)
        const imageUrl = await generateWithVertexAI(
            prompt,
            aspectRatio,
            apiSettings.projectId
        );

        // 할당량 증가
        await incrementQuota(decoded.username);

        return new Response(
            JSON.stringify({
                imageUrl,
                remainingQuota: 99 - quota,
                message: '이미지 생성 완료'
            }),
            { status: 200, headers }
        );

    } catch (error) {
        console.error('Image generation error:', error);

        // 429 에러 (Rate Limit)
        if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
            return new Response(
                JSON.stringify({ error: 'Google API 일일 사용량을 초과했습니다. 내일 다시 시도해주세요.' }),
                { status: 429, headers }
            );
        }

        return new Response(
            JSON.stringify({ error: error.message || 'Image generation failed' }),
            { status: 500, headers }
        );
    }
}

// Vertex AI API 호출 (Service Account JSON 키 인증 방식)
async function generateWithVertexAI(prompt, aspectRatio, projectId) {
    if (!projectId) {
        throw new Error('Vertex AI Project ID is required');
    }

    // Service Account JSON 키 확인
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY 환경 변수가 설정되지 않았습니다');
    }

    try {
        // Service Account JSON 파싱
        const credentials = JSON.parse(serviceAccountKey);

        // GoogleAuth 인스턴스 생성
        const auth = new GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });

        // OAuth 액세스 토큰 생성
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        if (!accessToken.token) {
            throw new Error('OAuth 토큰 생성 실패');
        }

        // Vertex AI Imagen 4.0 Fast 모델 엔드포인트
        const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-4.0-fast-generate-001:predict`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken.token}`
            },
            body: JSON.stringify({
                instances: [{ prompt }],
                parameters: { sampleCount: 1, aspectRatio }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 429) {
                throw new Error('429 RESOURCE_EXHAUSTED');
            }
            throw new Error(`Vertex AI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const imageData = data.predictions?.[0]?.bytesBase64Encoded;

        if (!imageData) {
            throw new Error('No image generated');
        }

        return `data:image/png;base64,${imageData}`;

    } catch (error) {
        console.error('Vertex AI error:', error);
        throw new Error(`Vertex AI 이미지 생성 실패: ${error.message}`);
    }
}
