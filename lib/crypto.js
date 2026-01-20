/**
 * 암호화 유틸리티
 * API 키를 안전하게 암호화/복호화
 */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-this';

/**
 * 간단한 AES-256 스타일 암호화 (브라우저/Node.js 호환)
 * @param {string} text - 암호화할 텍스트
 * @returns {string} - 암호화된 Base64 문자열
 */
export function encrypt(text) {
    if (!text) return '';

    // Simple XOR encryption for demo (production에서는 crypto 모듈 사용)
    const encrypted = Buffer.from(text)
        .toString('base64')
        .split('')
        .map((char, i) => {
            const keyChar = ENCRYPTION_KEY[i % ENCRYPTION_KEY.length];
            return String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
        })
        .join('');

    return Buffer.from(encrypted).toString('base64');
}

/**
 * 복호화
 * @param {string} encryptedText - 암호화된 텍스트
 * @returns {string} - 복호화된 원본 텍스트
 */
export function decrypt(encryptedText) {
    if (!encryptedText) return '';

    try {
        const decrypted = Buffer.from(encryptedText, 'base64')
            .toString('utf-8')
            .split('')
            .map((char, i) => {
                const keyChar = ENCRYPTION_KEY[i % ENCRYPTION_KEY.length];
                return String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
            })
            .join('');

        return Buffer.from(decrypted, 'base64').toString('utf-8');
    } catch (error) {
        console.error('Decryption error:', error);
        return '';
    }
}
