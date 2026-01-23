/**
 * 미슬곰 이미지 저장소 - IndexedDB 기반 이미지 데이터 관리
 * localStorage 용량 한계(5MB) 해결을 위해 이미지를 IndexedDB에 별도 저장
 */

const ImageStore = {
    DB_NAME: 'miseulgom_image_store',
    DB_VERSION: 1,
    STORE_NAME: 'images',
    _db: null,

    // IndexedDB 연결 (싱글턴)
    async _getDB() {
        if (this._db) return this._db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this._db = event.target.result;
                resolve(this._db);
            };

            request.onerror = (event) => {
                console.error('[ImageStore] IndexedDB 열기 실패:', event.target.error);
                reject(event.target.error);
            };
        });
    },

    /**
     * 이미지 저장
     * @param {string} id - 고유 키 (예: "char_xxxxx", "scene_xxxxx")
     * @param {string} imageBase64 - Base64 인코딩된 이미지 데이터
     * @param {string} imageUrl - data: URL (표시용)
     */
    async saveImage(id, imageBase64, imageUrl) {
        if (!id || (!imageBase64 && !imageUrl)) return;

        try {
            const db = await this._getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                const store = tx.objectStore(this.STORE_NAME);

                store.put({
                    id: id,
                    imageBase64: imageBase64 || null,
                    imageUrl: imageUrl || null,
                    savedAt: Date.now()
                });

                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => {
                    console.error('[ImageStore] 저장 실패:', id, e.target.error);
                    reject(e.target.error);
                };
            });
        } catch (error) {
            console.error('[ImageStore] saveImage 오류:', error);
        }
    },

    /**
     * 이미지 조회
     * @param {string} id - 고유 키
     * @returns {Promise<{imageBase64, imageUrl} | null>}
     */
    async getImage(id) {
        if (!id) return null;

        try {
            const db = await this._getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE_NAME, 'readonly');
                const store = tx.objectStore(this.STORE_NAME);
                const request = store.get(id);

                request.onsuccess = () => {
                    resolve(request.result || null);
                };
                request.onerror = (e) => {
                    console.error('[ImageStore] 조회 실패:', id, e.target.error);
                    resolve(null);
                };
            });
        } catch (error) {
            console.error('[ImageStore] getImage 오류:', error);
            return null;
        }
    },

    /**
     * 이미지 삭제
     * @param {string} id - 고유 키
     */
    async deleteImage(id) {
        if (!id) return;

        try {
            const db = await this._getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                const store = tx.objectStore(this.STORE_NAME);
                store.delete(id);

                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => reject(e.target.error);
            });
        } catch (error) {
            console.error('[ImageStore] deleteImage 오류:', error);
        }
    },

    /**
     * 여러 이미지 일괄 저장
     * @param {Array<{id, imageBase64, imageUrl}>} items
     */
    async saveMany(items) {
        if (!items || items.length === 0) return;

        try {
            const db = await this._getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                const store = tx.objectStore(this.STORE_NAME);

                for (const item of items) {
                    if (item.id && (item.imageBase64 || item.imageUrl)) {
                        store.put({
                            id: item.id,
                            imageBase64: item.imageBase64 || null,
                            imageUrl: item.imageUrl || null,
                            savedAt: Date.now()
                        });
                    }
                }

                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => {
                    console.error('[ImageStore] 일괄 저장 실패:', e.target.error);
                    reject(e.target.error);
                };
            });
        } catch (error) {
            console.error('[ImageStore] saveMany 오류:', error);
        }
    },

    /**
     * 여러 이미지 일괄 조회
     * @param {string[]} ids - 조회할 키 배열
     * @returns {Promise<Map<string, {imageBase64, imageUrl}>>}
     */
    async getMany(ids) {
        const result = new Map();
        if (!ids || ids.length === 0) return result;

        try {
            const db = await this._getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE_NAME, 'readonly');
                const store = tx.objectStore(this.STORE_NAME);

                let completed = 0;
                for (const id of ids) {
                    const request = store.get(id);
                    request.onsuccess = () => {
                        if (request.result) {
                            result.set(id, request.result);
                        }
                        completed++;
                        if (completed === ids.length) {
                            resolve(result);
                        }
                    };
                    request.onerror = () => {
                        completed++;
                        if (completed === ids.length) {
                            resolve(result);
                        }
                    };
                }

                if (ids.length === 0) resolve(result);
            });
        } catch (error) {
            console.error('[ImageStore] getMany 오류:', error);
            return result;
        }
    },

    /**
     * 전체 삭제
     */
    async clear() {
        try {
            const db = await this._getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                const store = tx.objectStore(this.STORE_NAME);
                store.clear();

                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => reject(e.target.error);
            });
        } catch (error) {
            console.error('[ImageStore] clear 오류:', error);
        }
    }
};

// 전역 함수로 노출
window.ImageStore = ImageStore;
