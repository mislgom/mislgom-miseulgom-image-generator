/**
 * 사용자 할당량 조회 API
 */

import jwt from 'jsonwebtoken';
import { checkQuota } from '../../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export default async function handler(request) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers });
    }

    if (request.method !== 'GET') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers }
        );
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
            JSON.stringify({ error: '인증이 만료되었습니다' }),
            { status: 401, headers }
        );
    }

    try {
        const used = await checkQuota(decoded.username);

        return new Response(
            JSON.stringify({
                username: decoded.username,
                used: used,
                limit: 100,
                remaining: Math.max(0, 100 - used)
            }),
            { status: 200, headers }
        );

    } catch (error) {
        console.error('Quota API error:', error);

        return new Response(
            JSON.stringify({ error: error.message || 'Server error' }),
            { status: 500, headers }
        );
    }
}
