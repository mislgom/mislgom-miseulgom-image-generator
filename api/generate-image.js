/**
 * 이미지 생성 API (사용자별 API 키 사용)
 */

import jwt from 'jsonwebtoken';
import { GoogleAuth } from 'google-auth-library';
import { getUserApiSettings, checkQuota, incrementQuota } from '../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export default async function handler(req, res) {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // JWT 토큰 검증
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: '로그인이 필요합니다' });
    }

    const token = authHeader.substring(7);

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ error: '인증이 만료되었습니다. 다시 로그인해주세요' });
    }

    try {
        // 사용자 API 설정 가져오기
        const apiSettings = await getUserApiSettings(decoded.username);

        // AI Studio는 API Key 필수, Vertex AI는 Service Account 방식이므로 검증 생략
        if (apiSettings.apiType === 'ai_studio' && !apiSettings.apiKey) {
            return res.status(400).json({ error: 'API 키를 먼저 설정해주세요. 설정 메뉴에서 Google API 키를 등록하세요.' });
        }

        if (apiSettings.apiType === 'vertex_ai' && !apiSettings.projectId) {
            return res.status(400).json({ error: 'Vertex AI Project ID를 먼저 설정해주세요.' });
        }

        // 일일 할당량 확인 (사용자별 100장)
        const quota = await checkQuota(decoded.username);

        if (quota >= 100) {
            return res.status(429).json({ error: '오늘 사용 가능한 이미지 생성 횟수(100장)를 모두 사용했습니다' });
        }

        // 이미지 생성 요청
        const { prompt, aspectRatio = '1:1' } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' });
        }

        console.log(`🎨 이미지 생성 요청: ${decoded.username} (${quota + 1}/100)`);

        let imageUrl;

        if (apiSettings.apiType === 'vertex_ai') {
            // Vertex AI는 Service Account 방식
            imageUrl = await generateWithVertexAI(
                prompt,
                aspectRatio,
                apiSettings.projectId
            );
        } else {
            // AI Studio는 API Key 방식
            imageUrl = await generateWithAIStudio(
                prompt,
                aspectRatio,
                apiSettings.apiKey
            );
        }

        // 할당량 증가
        await incrementQuota(decoded.username);

        return res.status(200).json({
            imageUrl,
            remainingQuota: 99 - quota,
            message: '이미지 생성 완료'
        });

    } catch (error) {
        console.error('Image generation error:', error);

        // 429 에러 (Rate Limit)
        if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
            return res.status(429).json({ error: 'Google API 일일 사용량을 초과했습니다. 내일 다시 시도해주세요.' });
        }

        return res.status(500).json({ error: error.message || 'Image generation failed' });
    }
}

// AI Studio API 호출 (최신 안정화 이미지 모델)
async function generateWithAIStudio(prompt, aspectRatio, apiKey) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseModalities: ['image'],
                    imageAspectRatio: aspectRatio
                }
            })
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
            throw new Error('API 키가 올바르지 않습니다. 설정에서 확인해주세요.');
        } else if (response.status === 429) {
            throw new Error('429 RESOURCE_EXHAUSTED');
        } else if (errorData.error?.message?.includes('content')) {
            throw new Error('이미지를 생성할 수 없는 내용입니다. 프롬프트를 수정해주세요.');
        }
        throw new Error(`AI Studio API error: ${response.status}`);
    }

    const data = await response.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (!imagePart?.inlineData) {
        throw new Error('No image generated');
    }

    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
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
