/**
 * 사용자 설정 API (API 키 저장/조회)
 */

import jwt from 'jsonwebtoken';
import { saveUserApiSettings, getUserApiSettings } from '../../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export default async function handler(req, res) {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
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
        // GET: API 설정 조회
        if (req.method === 'GET') {
            const settings = await getUserApiSettings(decoded.username);

            return res.status(200).json({
                apiType: settings.apiType,
                hasApiKey: !!settings.apiKey,
                projectId: settings.projectId
            });
        }

        // POST: API 설정 저장 (Vertex AI 전용)
        if (request.method === 'POST') {
            const { projectId } = await request.json();

            if (!projectId) {
                return new Response(
                    JSON.stringify({ error: 'Vertex AI Project ID를 입력해주세요' }),
                    { status: 400, headers }
                );
            }

            // Vertex AI Service Account 방식으로 고정
            await saveUserApiSettings(decoded.username, 'vertex_ai', 'service_account', projectId);

            return new Response(
                JSON.stringify({ message: 'Vertex AI 설정이 저장되었습니다' }),
                { status: 200, headers }
            );
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Settings API error:', error);
        return res.status(500).json({ error: '설정 처리 중 오류가 발생했습니다' });
    }
}
