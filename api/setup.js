/**
 * 초기 관리자 생성 API (한 번만 사용)
 */

import { createUser } from '../lib/db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = await createUser('mislgom', '1q2w3e4r5t@!', 'admin');
        
        return res.status(200).json({ 
            message: '관리자 계정 생성 완료!',
            username: user.username 
        });

    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}