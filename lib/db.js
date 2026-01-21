/**
 * 데이터베이스 헬퍼 (Vercel KV - Redis)
 */

import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import { encrypt, decrypt } from './crypto.js';

/**
 * 사용자 생성
 * @param {string} username - 사용자명
 * @param {string} password - 비밀번호
 * @param {string} role - 역할 ('admin' 또는 'user')
 * @returns {Promise<Object>} - 생성된 사용자 정보
 */
export async function createUser(username, password, role = 'user') {
    // 중복 확인
    const existingUser = await kv.hgetall(`user:${username}`);
    if (existingUser && Object.keys(existingUser).length > 0) {
        throw new Error('이미 존재하는 사용자명입니다');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const userData = {
        username,
        passwordHash,
        role,
        apiType: 'vertex_ai', // 기본값을 Vertex AI로 설정
        apiKeyEncrypted: null,
        projectId: null,
        dailyQuota: 0,
        lastResetDate: new Date().toISOString().split('T')[0],
        createdAt: Date.now()
    };

    await kv.hset(`user:${username}`, userData);

    console.log(`✅ 사용자 생성됨: ${username} (${role})`);

    return { username, role };
}

/**
 * 사용자 인증
 * @param {string} username - 사용자명
 * @param {string} password - 비밀번호
 * @returns {Promise<Object|null>} - 사용자 정보 또는 null
 */
export async function verifyUser(username, password) {
    const user = await kv.hgetall(`user:${username}`);

    if (!user || !user.passwordHash) {
        return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
        return null;
    }

    // 비밀번호 해시는 제외하고 반환
    const { passwordHash, apiKeyEncrypted, ...safeUser } = user;

    return safeUser;
}

/**
 * 사용자 API 설정 저장
 * @param {string} username - 사용자명
 * @param {string} apiType - 'vertex_ai' (고정)
 * @param {string} apiKey - API 키 또는 'service_account' (암호화되어 저장됨)
 * @param {string} projectId - Vertex AI 프로젝트 ID
 */
export async function saveUserApiSettings(username, apiType, apiKey, projectId = null) {
    const apiKeyEncrypted = encrypt(apiKey);

    await kv.hset(`user:${username}`, {
        apiType,
        apiKeyEncrypted,
        projectId: projectId || null
    });

    console.log(`✅ API 설정 저장됨: ${username} (${apiType})`);
}

/**
 * 사용자 API 설정 가져오기 (복호화)
 * @param {string} username - 사용자명
 * @returns {Promise<Object>} - { apiType, apiKey, projectId }
 */
export async function getUserApiSettings(username) {
    const user = await kv.hgetall(`user:${username}`);

    if (!user || !user.apiKeyEncrypted) {
        return { apiType: null, apiKey: null, projectId: null };
    }

    const apiKey = decrypt(user.apiKeyEncrypted);

    return {
        apiType: user.apiType,
        apiKey,
        projectId: user.projectId
    };
}

/**
 * 일일 할당량 확인
 * @param {string} username - 사용자명
 * @returns {Promise<number>} - 오늘 사용량
 */
export async function checkQuota(username) {
    const user = await kv.hgetall(`user:${username}`);

    if (!user) {
        return 0;
    }

    const today = new Date().toISOString().split('T')[0];

    // 날짜가 바뀌면 초기화
    if (user.lastResetDate !== today) {
        await kv.hset(`user:${username}`, {
            dailyQuota: 0,
            lastResetDate: today
        });
        return 0;
    }

    return parseInt(user.dailyQuota) || 0;
}

/**
 * 할당량 증가
 * @param {string} username - 사용자명
 */
export async function incrementQuota(username) {
    await kv.hincrby(`user:${username}`, 'dailyQuota', 1);
}

/**
 * 모든 사용자 목록 가져오기 (관리자용)
 * @returns {Promise<Array>} - 사용자 목록
 */
export async function getAllUsers() {
    const keys = await kv.keys('user:*');
    const users = [];

    for (const key of keys) {
        const user = await kv.hgetall(key);
        if (user) {
            const { passwordHash, apiKeyEncrypted, ...safeUser } = user;
            users.push(safeUser);
        }
    }

    return users;
}

/**
 * 사용자 삭제
 * @param {string} username - 사용자명
 */
export async function deleteUser(username) {
    await kv.del(`user:${username}`);
    console.log(`🗑️ 사용자 삭제됨: ${username}`);
}
