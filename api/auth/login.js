/**
 * 로그인 API (Vercel Serverless Functions)
 */

import jwt from 'jsonwebtoken';
import { verifyUser } from '../../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export default async function handler(req, res) {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요' });
        }

        const user = await verifyUser(username, password);

        if (!user) {
            return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' });
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

        return res.status(200).json({
            token,
            username: user.username,
            role: user.role,
            message: '로그인 성공'
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다' });
    }
}
