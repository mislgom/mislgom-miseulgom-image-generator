/**
 * 관리자 API - 사용자 관리
 */

import jwt from 'jsonwebtoken';
import { createUser, getAllUsers, deleteUser } from '../../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export default async function handler(request) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers });
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
            JSON.stringify({ error: '인증이 만료되었습니다' }),
            { status: 401, headers }
        );
    }

    // 관리자 권한 확인
    if (decoded.role !== 'admin') {
        return new Response(
            JSON.stringify({ error: '관리자 권한이 필요합니다' }),
            { status: 403, headers }
        );
    }

    try {
        // GET: 전체 사용자 목록
        if (request.method === 'GET') {
            const users = await getAllUsers();

            return new Response(
                JSON.stringify({ users }),
                { status: 200, headers }
            );
        }

        // POST: 신규 사용자 생성
        if (request.method === 'POST') {
            const { username, password, role } = await request.json();

            if (!username || !password) {
                return new Response(
                    JSON.stringify({ error: '아이디와 비밀번호를 입력해주세요' }),
                    { status: 400, headers }
                );
            }

            const user = await createUser(username, password, role || 'user');

            return new Response(
                JSON.stringify({
                    message: '사용자가 생성되었습니다',
                    user
                }),
                { status: 200, headers }
            );
        }

        // DELETE: 사용자 삭제
        if (request.method === 'DELETE') {
            const url = new URL(request.url);
            const username = url.searchParams.get('username');

            if (!username) {
                return new Response(
                    JSON.stringify({ error: 'username is required' }),
                    { status: 400, headers }
                );
            }

            // 본인 계정은 삭제 불가
            if (username === decoded.username) {
                return new Response(
                    JSON.stringify({ error: '본인 계정은 삭제할 수 없습니다' }),
                    { status: 400, headers }
                );
            }

            await deleteUser(username);

            return new Response(
                JSON.stringify({ message: '사용자가 삭제되었습니다' }),
                { status: 200, headers }
            );
        }

        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers }
        );

    } catch (error) {
        console.error('Admin API error:', error);

        return new Response(
            JSON.stringify({ error: error.message || 'Server error' }),
            { status: 500, headers }
        );
    }
}
