/**
 * 로그인 API
 */

import jwt from 'jsonwebtoken';
import { verifyUser } from '../../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export default async function handler(request) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
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

    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return new Response(
                JSON.stringify({ error: '아이디와 비밀번호를 입력해주세요' }),
                { status: 400, headers }
            );
        }

        const user = await verifyUser(username, password);

        if (!user) {
            return new Response(
                JSON.stringify({ error: '아이디 또는 비밀번호가 올바르지 않습니다' }),
                { status: 401, headers }
            );
        }

        // JWT 토큰 생성 (7일 유효)
        const token = jwt.sign(
            {
                username: user.username,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return new Response(
            JSON.stringify({
                token,
                username: user.username,
                role: user.role,
                message: '로그인 성공'
            }),
            { status: 200, headers }
        );

    } catch (error) {
        console.error('Login error:', error);

        return new Response(
            JSON.stringify({ error: '로그인 처리 중 오류가 발생했습니다' }),
            { status: 500, headers }
        );
    }
}
