/**
 * 사용자 설정 API (API 키 저장/조회)
 */

import jwt from 'jsonwebtoken';
import { saveUserApiSettings, getUserApiSettings } from '../../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export default async function handler(request) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers });
    }

    // JWT 토큰 검증
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];

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
        // GET: API 설정 조회
        if (request.method === 'GET') {
            const settings = await getUserApiSettings(decoded.username);

            return new Response(
                JSON.stringify({
                    apiType: settings.apiType,
                    hasApiKey: !!settings.apiKey,
                    projectId: settings.projectId
                }),
                { status: 200, headers }
            );
        }

        // POST: API 설정 저장
        if (request.method === 'POST') {
            const { apiType, apiKey, projectId } = await request.json();

            if (!apiType) {
                return new Response(
                    JSON.stringify({ error: 'API 타입을 선택해주세요' }),
                    { status: 400, headers }
                );
            }

            // Vertex AI는 Service Account 방식이므로 projectId만 필수
            if (apiType === 'vertex_ai') {
                if (!projectId) {
                    return new Response(
                        JSON.stringify({ error: 'Vertex AI 사용 시 Project ID가 필요합니다' }),
                        { status: 400, headers }
                    );
                }
                // Service Account 방식이므로 apiKey는 'service_account' 플래그로 저장
                await saveUserApiSettings(decoded.username, apiType, 'service_account', projectId);
            } else {
                // AI Studio는 API Key 필수
                if (!apiKey) {
                    return new Response(
                        JSON.stringify({ error: 'API 키를 입력해주세요' }),
                        { status: 400, headers }
                    );
                }
                await saveUserApiSettings(decoded.username, apiType, apiKey, projectId);
            }

            return new Response(
                JSON.stringify({ message: 'API 설정이 저장되었습니다' }),
                { status: 200, headers }
            );
        }

        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers }
        );

    } catch (error) {
        console.error('Settings API error:', error);

        return new Response(
            JSON.stringify({ error: '설정 처리 중 오류가 발생했습니다' }),
            { status: 500, headers }
        );
    }
}
