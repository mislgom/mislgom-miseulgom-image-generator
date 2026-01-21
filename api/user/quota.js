/**
 * 사용자 할당량 조회 API
 */

import jwt from 'jsonwebtoken';
import { checkQuota } from '../../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export default async function handler(req, res) {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
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
        return res.status(401).json({ error: '인증이 만료되었습니다' });
    }

    try {
        const used = await checkQuota(decoded.username);

        return res.status(200).json({
            username: decoded.username,
            used: used,
            limit: 100,
            remaining: Math.max(0, 100 - used)
        });

    } catch (error) {
        console.error('Quota API error:', error);
        return res.status(500).json({ error: error.message || 'Server error' });
    }
}
