/**
 * 이미지 생성 API (사용자별 API 키 사용)
 */

import jwt from 'jsonwebtoken';
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

        if (!apiSettings.apiKey) {
            return new Response(
                JSON.stringify({ error: 'API 키를 먼저 설정해주세요. 설정 메뉴에서 Google API 키를 등록하세요.' }),
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

        let imageUrl;

        if (apiSettings.apiType === 'vertex_ai') {
            imageUrl = await generateWithVertexAI(
                prompt,
                aspectRatio,
                apiSettings.apiKey,
                apiSettings.projectId
            );
        } else {
            imageUrl = await generateWithAIStudio(
                prompt,
                aspectRatio,
                apiSettings.apiKey
            );
        }

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

// AI Studio API 호출
async function generateWithAIStudio(prompt, aspectRatio, apiKey) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
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

// Vertex AI API 호출
async function generateWithVertexAI(prompt, aspectRatio, apiKey, projectId) {
    if (!projectId) {
        throw new Error('Vertex AI Project ID is required');
    }

    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1, aspectRatio }
        })
    });

    if (!response.ok) {
        if (response.status === 429) {
            throw new Error('429 RESOURCE_EXHAUSTED');
        }
        throw new Error(`Vertex AI API error: ${response.status}`);
    }

    const data = await response.json();
    const imageData = data.predictions?.[0]?.bytesBase64Encoded;

    if (!imageData) {
        throw new Error('No image generated');
    }

    return `data:image/png;base64,${imageData}`;
}
