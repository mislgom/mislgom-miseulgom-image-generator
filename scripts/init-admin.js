/**
 * 초기 관리자 계정 생성 스크립트
 * 사용법: node scripts/init-admin.js
 */

import { createUser } from '../lib/db.js';

const ADMIN_USERNAME = 'mislgom';
const ADMIN_PASSWORD = '1q2w3e4r5t@!';

async function initAdmin() {
    console.log('🔧 초기 관리자 계정 생성 중...');

    try {
        await createUser(ADMIN_USERNAME, ADMIN_PASSWORD, 'admin');

        console.log('✅ 관리자 계정 생성 완료!');
        console.log('');
        console.log('📋 로그인 정보:');
        console.log(`   아이디: ${ADMIN_USERNAME}`);
        console.log(`   비밀번호: ${ADMIN_PASSWORD}`);
        console.log('');
        console.log('⚠️  보안을 위해 비밀번호를 변경하는 것을 권장합니다.');

    } catch (error) {
        if (error.message.includes('이미 존재')) {
            console.log('ℹ️  관리자 계정이 이미 존재합니다');
            console.log(`   아이디: ${ADMIN_USERNAME}`);
        } else {
            console.error('❌ 오류:', error.message);
            process.exit(1);
        }
    }
}

initAdmin();
