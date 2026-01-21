/**
 * 이미지 생성 API (Vertex AI 전용)
 */

import jwt from 'jsonwebtoken';
import { GoogleAuth } from 'google-auth-library';
import { getUserApiSettings, checkQuota, incrementQuota } from '../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // JWT 검증
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: '로그인이 필요합니다' });
    }

    let decoded;
    try {
        decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
    } catch {
        return res.status(401).json({ error: '인증이 만료되었습니다. 다시 로그인해주세요.' });
    }

    try {
        // 사용자 API 설정
        const apiSettings = await getUserApiSettings(decoded.username);
        console.log(`🔍 API Settings for ${decoded.username}:`, apiSettings);

        // Vertex AI Project ID 필수
        if (!apiSettings.projectId) {
            return res.status(400).json({
                error: 'Vertex AI Project ID를 먼저 설정해주세요.'
            });
        }

        // 일일 할당량 (100장)
        const quota = await checkQuota(decoded.username);
        if (quota >= 100) {
            return res.status(429).json({
                error: '오늘 사용 가능한 이미지 생성 횟수(100장)를 모두 사용했습니다.'
            });
        }

        const { prompt, aspectRatio = '1:1' } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' });
        }

        console.log(`🎨 이미지 생성 요청: ${decoded.username} (${quota + 1}/100)`);

        // Vertex AI 호출
        const imageUrl = await generateWithVertexAI(
            prompt,
            aspectRatio,
            apiSettings.projectId
        );

        await incrementQuota(decoded.username);

        return res.status(200).json({
            imageUrl,
            remainingQuota: 99 - quota,
            message: '이미지 생성 완료'
        });

    } catch (error) {
        console.error('Image generation error:', error);

        if (
            error.message.includes('429') ||
            error.message.includes('RESOURCE_EXHAUSTED')
        ) {
            return res.status(429).json({
                error: 'Google API 사용량을 초과했습니다. 잠시 후 다시 시도해주세요.'
            });
        }

        return res.status(500).json({
            error: error.message || 'Image generation failed'
        });
    }
}

/**
 * Vertex AI Imagen 4 Fast
 */
async function generateWithVertexAI(prompt, aspectRatio, projectId) {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY 환경 변수가 설정되지 않았습니다');
    }

    const credentials = JSON.parse(serviceAccountKey);

    const auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    if (!token) {
        throw new Error('OAuth 토큰 생성 실패');
    }

    const endpoint =
        `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}` +
        `/locations/us-central1/publishers/google/models/imagen-4.0-fast-generate-001:predict`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
                sampleCount: 1,
                aspectRatio
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
            throw new Error('429 RESOURCE_EXHAUSTED');
        }
        throw new Error(
            `Vertex AI API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`
        );
    }

    const data = await response.json();
    const imageData = data.predictions?.[0]?.bytesBase64Encoded;

    if (!imageData) {
        throw new Error('이미지가 생성되지 않았습니다');
    }

    return `data:image/png;base64,${imageData}`;
}
