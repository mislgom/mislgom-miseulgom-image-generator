/**
 * 미슬곰 이미지 자동 생성기 v2.1 - API 통신 모듈
 * 백엔드 API와 통신
 *
 * v2.0 - 에러별 재시도 정책 + 동시성 제한 + Retry-After 지원
 * v2.1 - 호출 경로 통일 + 딜레이 중복 제거 + 에러 정보 보존 + 메시지 정교화
 *
 * ✅ FIX(2026-01-22):
 * - generateImageLocal 아래에 남아있던 "중복 fetch/if(response...)" 블록 제거 (문법 오류 원인)
 * - 동시성 처리: _withConcurrency 를 단일 진입점으로 사용, _executeWithQueue 는 호환용 래퍼로 유지
 * - _retryWithBackoff: 콜백이 setter를 받을 수도/안 받을 수도 있게 유지 (기존 호출 호환)
 * - minRequestInterval: 10000 (429 방지 강화, 분당 6건 이내)
 */

const API = {
    // API 기본 URL (Vercel 배포 환경에서는 빈 문자열 사용)
    baseURL: '',

    // 이미지 생성 API 설정 (LocalStorage에서 로드)
    IMAGE_API_TYPE: 'vertex_ai',
    IMAGE_API_KEY: null,
    IMAGE_PROJECT_ID: null,

    // Rate Limit 보호 (Vertex AI) - 요청 간 최소 간격
    lastRequestTime: 0,
    minRequestInterval: 10000, // ✅ 10초 (429 방지 강화, 분당 6건 이내)

    // ✅ v2.0: 동시성 제한 (실사용)
    maxConcurrent: 1,
    currentRequests: 0,
    requestQueue: [],

    // 동시에 maxConcurrent개까지만 실행, 나머지는 큐 대기
    async _withConcurrency(taskFn) {
        if (this.currentRequests >= this.maxConcurrent) {
            await new Promise((resolve) => this.requestQueue.push(resolve));
        }

        this.currentRequests++;

        try {
            return await taskFn();
        } finally {
            this.currentRequests--;

            const next = this.requestQueue.shift();
            if (next) next();
        }
    },

    // Gemini 대본 분석 API 설정
    GEMINI_API_KEY: '',
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',

    // ========== LocalStorage 기반 API 설정 관리 ==========

    /**
     * LocalStorage에서 이미지 생성 API 설정 로드
     */
    loadImageApiSettings() {
        this.IMAGE_API_TYPE = localStorage.getItem('image_api_type');
        this.IMAGE_API_KEY = localStorage.getItem('image_api_key');
        this.IMAGE_PROJECT_ID = localStorage.getItem('image_project_id');

        console.log('📥 이미지 API 설정 로드:', {
            type: this.IMAGE_API_TYPE,
            hasKey: !!this.IMAGE_API_KEY,
            hasProjectId: !!this.IMAGE_PROJECT_ID,
        });

        return {
            apiType: this.IMAGE_API_TYPE,
            apiKey: this.IMAGE_API_KEY,
            projectId: this.IMAGE_PROJECT_ID,
        };
    },

    /**
     * 이미지 생성 API 설정 저장 (서버에 저장)
     */
    async saveImageApiSettings(apiType, apiKey, projectId = null) {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            throw new Error('로그인이 필요합니다');
        }

        const response = await fetch('/api/user/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ apiType, apiKey, projectId }),
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'API 설정 저장 실패');
        }

        console.log('💾 API 설정 저장 완료 (서버)');
        return await response.json();
    },

    /**
     * API 설정이 완료되었는지 확인
     */
    isImageApiConfigured() {
        return !!(this.IMAGE_API_TYPE && this.IMAGE_API_KEY);
    },

    // 헬스 체크
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ 백엔드 연결:', data);
                return true;
            }
            return false;
        } catch (error) {
            console.warn('⚠️ 백엔드 연결 실패:', error.message);
            return false;
        }
    },

    // 에러 처리
    handleError(error) {
        console.error('❌ API 에러:', error);

        if (error.message === 'Failed to fetch') {
            return '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
        }

        return error.message || '알 수 없는 오류가 발생했습니다.';
    },

    // 대본 분석
    async analyzeScript(scriptText) {
        try {
            const response = await fetch(`${this.baseURL}/api/analyze-script`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: scriptText }),
            });

            if (!response.ok) {
                throw new Error('대본 분석 실패');
            }

            return await response.json();
        } catch (error) {
            console.error('❌ 대본 분석 API 호출 실패:', error.message);
            throw new Error('대본 분석에 실패했습니다. Gemini API 키를 확인해주세요.');
        }
    },

// ✅ v2.1: 이미지 생성 (generateImageLocal로 위임)
async generateImage(params) {
    // ✅ 데모 분기 제거: 항상 실서버 호출
    const imageUrl = await this.generateImageLocal(params);
    return { imageUrl };
},

    // 프로젝트 생성
    async createProject(name, style) {
        try {
            const response = await fetch(`${this.baseURL}/api/projects/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name || `미슬곰_${Date.now()}`,
                    style: style || 'realistic',
                }),
            });

            if (!response.ok) {
                throw new Error('프로젝트 생성 실패');
            }

            return await response.json();
        } catch (error) {
            throw new Error(this.handleError(error));
        }
    },

    // ========== Google Image Generation API ==========

    /**
     * ✅ v2.1: 재시도 불가 에러인지 확인
     */
    _isNonRetryableError(status, errorMessage) {
        if (status === 400) {
            const msg = (errorMessage || '').toLowerCase();
            const nonRetryableKeywords = [
                'invalid endpoint',
                'validation',
                'does not exist',
                'invalid request',
                'bad request',
                'invalid argument',
            ];
            return nonRetryableKeywords.some((keyword) => msg.includes(keyword));
        }

        if (status === 401 || status === 403) {
            return true;
        }

        return false;
    },

    /**
     * ✅ v2.0: Retry-After 헤더 파싱
     */
    _parseRetryAfter(response) {
        const retryAfter = response.headers.get('retry-after');
        if (!retryAfter) return null;

        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
            console.log(`📋 Retry-After 헤더 감지: ${seconds}초`);
            return seconds * 1000;
        }

        try {
            const retryDate = new Date(retryAfter);
            const waitTime = retryDate.getTime() - Date.now();
            if (waitTime > 0) {
                console.log(`📋 Retry-After 헤더 감지 (date): ${(waitTime / 1000).toFixed(1)}초`);
                return waitTime;
            }
        } catch (e) {
            // ignore
        }

        return null;
    },

    /**
     * ✅ v2.1: status별 사용자 메시지 생성
     */
    _getFinalErrorMessage(status, originalMessage) {
        if (status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        if (status >= 500 && status < 600) return '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';

        if (
            originalMessage &&
            (originalMessage.includes('Failed to fetch') ||
                originalMessage.includes('network') ||
                originalMessage.includes('NetworkError'))
        ) {
            return '네트워크 연결을 확인해주세요.';
        }
        return originalMessage || '이미지 생성에 실패했습니다.';
    },

    /**
     * ✅ v2.1: 개선된 Exponential Backoff 재시도 로직
     * - 에러별 재시도 정책 적용
     * - Retry-After 헤더 우선
     * - 백오프: 8초 → 16초 → 32초 + 지터(±2초)
     * - 에러 정보 보존
     *
     * ⚠️ func는 아래 두 형태 모두 허용(호환):
     *  - async () => { ... }
     *  - async (setResponse) => { setResponse(response); ... }
     */
    async _retryWithBackoff(func, maxRetries = 4) {
        let lastError = null;
        let lastResponse = null;
        let lastStatus = null;
        let lastOriginalMessage = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await func((response) => {
                    lastResponse = response;
                });
            } catch (error) {
                lastError = error;
                lastStatus = error.status || lastResponse?.status;
                lastOriginalMessage = error.originalMessage || error.message;

                const errorStr = error.message || error.toString();

                if (this._isNonRetryableError(lastStatus, errorStr)) {
                    console.error(`❌ 재시도 불가 에러 (${lastStatus}): ${errorStr}`);
                    throw error;
                }

                const isRetryable =
                    lastStatus === 429 ||
                    error.code === 'RESOURCE_EXHAUSTED' ||
                    (lastStatus >= 500 && lastStatus < 600) ||
                    errorStr.includes('Failed to fetch') ||
                    errorStr.includes('network') ||
                    errorStr.includes('NetworkError');

                if (!isRetryable) throw error;

                if (attempt === maxRetries - 1) {
                    console.error(`❌ 최대 재시도 횟수(${maxRetries - 1}회) 초과`);

                    const finalError = new Error(this._getFinalErrorMessage(lastStatus, lastOriginalMessage));
                    finalError.status = lastStatus;
                    finalError.originalMessage = lastOriginalMessage;
                    finalError.code = error.code;
                    throw finalError;
                }

                let waitTime = null;
                if (lastResponse) {
                    waitTime = this._parseRetryAfter(lastResponse);
                }

                if (!waitTime) {
                    const baseDelay = 8000;
                    const exponentialDelay = Math.pow(2, attempt) * baseDelay;
                    const jitter = Math.random() * 4000 - 2000; // ±2s
                    waitTime = Math.max(exponentialDelay + jitter, baseDelay);
                }

                console.warn(
                    `⚠️ 재시도 대기. ${(waitTime / 1000).toFixed(1)}초 후 재시도 (${attempt + 1}/${maxRetries - 1})...`
                );
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
        }

        throw lastError;
    },

    /**
     * ✅ v2.0: (호환용) 큐 처리 API
     * - 기존 코드가 _executeWithQueue를 호출해도 동작하도록 유지
     * - 내부는 _withConcurrency로 단일화
     */
    async _executeWithQueue(func) {
        return await this._withConcurrency(func);
    },

    /**
     * ✅ v2.1: 연속 요청 간격 보장 (최소 4초)
     */
    async _ensureMinInterval() {
        const elapsed = Date.now() - this.lastRequestTime;
        if (elapsed < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - elapsed;
            console.log(`⏳ 요청 간격 보장: ${(waitTime / 1000).toFixed(1)}초 대기...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();
    },

    /**
     * ✅ v2.1: Google Image Generation API로 이미지 생성 (동시성/재시도 적용)
     */
    async generateImageLocal(params) {
        const { prompt, aspectRatio = '1:1', seed, referenceImages } = params;

        const token = localStorage.getItem('auth_token');
        if (!token) {
            throw new Error('로그인이 필요합니다');
        }

        console.log('🎨 이미지 생성 요청:', {
            prompt: (prompt || '').substring(0, 50) + '...',
            aspectRatio,
            apiType: 'vertex_ai',
        });

        return await this._withConcurrency(() =>
            this._retryWithBackoff(async (setResponse) => {
                await this._ensureMinInterval();

                const response = await fetch('/api/generate-image', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        prompt,
                        aspectRatio,
                        ...(seed ? { seed } : {}),
                        ...(Array.isArray(referenceImages) && referenceImages.length > 0 ? { referenceImages } : {}),
                    }),
                });

                // ✅ Retry-After 파싱용 response 보존 (타입 체크)
                if (typeof setResponse === 'function') setResponse(response);

                // 401: 로그인 만료
                if (response.status === 401) {
                    localStorage.removeItem('auth_token');
                    window.location.href = '/login.html';
                    const error = new Error('로그인이 만료되었습니다');
                    error.status = 401;
                    throw error;
                }

                if (!response.ok) {
                    const text = await response.text().catch(() => '');
                    let errorMessage = `HTTP ${response.status}`;
                    try {
                        const parsed = JSON.parse(text);
                        errorMessage = parsed.error || parsed.message || errorMessage;
                    } catch (_) {
                        if (text) errorMessage = text;
                    }
                    const error = new Error(errorMessage);
                    error.status = response.status;
                    throw error;
                }

                const data = await response.json();
                console.log('✅ 이미지 생성 완료');
                return data.imageUrl;
            })
        );
    },

    /**
     * 이미지 수정 (text-to-image 방식)
     */
    async editImageLocal(originalPrompt, editPrompt, options = {}) {
        const { aspectRatio = '1:1', seed, keepSeed, imageBase64 } = options;

        console.log(
            '🔄 이미지 수정 (text-to-image 방식):',
            editPrompt ? editPrompt.substring(0, 30) + '...' : '(프롬프트 유지)'
        );

        const fullPrompt = editPrompt ? `${originalPrompt}. Additional modification: ${editPrompt}` : originalPrompt;

        let referenceImages = [];
        if (imageBase64) {
            referenceImages = [
                {
                    referenceId: 1,
                    imageBase64: imageBase64,
                    description: 'maintain consistency with original image',
                },
            ];
            console.log('📷 기존 이미지를 참조 이미지로 전달 (일관성 유지)');
        }

        return await this.generateImageLocal({
            prompt: fullPrompt,
            aspectRatio,
            ...(keepSeed && seed ? { seed } : {}),
            ...(referenceImages.length > 0 ? { referenceImages } : {}),
        });
    },

    // ========== Gemini API (대본 분석) ==========

    /**
     * Gemini API로 대본 분석
     */
    async analyzeScriptWithGemini(scripts) {
        if (!this.GEMINI_API_KEY) {
            console.warn('⚠️ Gemini API 키가 설정되지 않음. 규칙 기반 분석 사용');
            return this.analyzeScriptRuleBased(scripts);
        }

        try {
            const scriptsJson = JSON.stringify(scripts, null, 2);

            const systemInstruction = {
                parts: [{
                    text: `당신은 한국/일본 이야기 대본을 분석하는 전문가입니다. 대본의 언어를 자동으로 감지하고, 내용을 읽고 시대 배경을 판별하며, 등장인물을 추출하고, 장면 수를 계산합니다.

**역할:**
1. 대본의 언어를 자동으로 감지합니다 (한국어/일본어)
2. 대본의 내용을 분석하여 시대를 판별합니다 (과거/현대/미래/판타지)
3. 등장인물을 추출하고 시대와 문화권에 맞는 복식/헤어스타일을 구체적으로 묘사합니다
4. 시각적 변화를 감지하여 필요한 장면 수를 계산합니다

**시대 자동 판별:**
대본의 내용과 키워드를 분석하여 시대를 감지하세요.

**한국:**
- **joseon** (조선시대): "갓", "한복", "양반", "사또", "궁궐", "초가", "기생", "상투", "대감" 등
- **modern** (현대): "자동차", "휴대폰", "회사", "아파트", "카페", "인터넷", "양복", "청바지" 등

**일본:**
- **edo** (에도시대, 1603-1868): "侍", "刀", "着物", "江戸", "大名", "町人", "ちょんまげ" 등
- **meiji** (메이지시대, 1868-1912): "文明開化", "洋服", "ガス灯", "人力車", "明治" 등
- **taisho** (다이쇼시대, 1912-1926): "大正", "モダン", "カフェー", "洋館" 등
- **showa** (쇼와시대, 1926-1989): "昭和", "戦争", "高度成長" 등
- **modern** (現代, 1989-현재): "携帯", "パソコン", "会社", "マンション", "カフェ" 등

**공통:**
- **future** (미래/SF): "로봇", "우주", "사이버", "AI", "ロボット", "宇宙" 등
- **fantasy** (판타지): "마법", "드래곤", "이세계", "魔法", "ドラゴン", "異世界" 등

**등장인물 추출 규칙:**
- 대본에 등장하는 모든 주요 인물을 추출하세요
- 일본어 이름은 로마자 표기로 변환하세요 (예: 田中太郎 → Tanaka Taro)
- 시대와 문화권에 맞는 복식과 헤어스타일을 **매우 구체적으로** 묘사하세요

**시대/문화권별 복식/헤어 디테일:**

**한국 - 조선시대 남성:**
- 복식: "wearing traditional Joseon hanbok with dopo overcoat, gat (traditional Korean hat), silk belt"
- 머리: "topknot hairstyle (sangtu) with traditional Korean headband"

**한국 - 조선시대 여성:**
- 복식: "wearing elegant Joseon hanbok with jeogori (short jacket) and chima (long skirt), daenggi hair ribbon"
- 머리: "traditional Korean braided hairstyle with daenggi ribbon, jokduri crown (for married women)"

**일본 - 에도시대 남성 (사무라이):**
- 복식: "wearing traditional samurai kimono with hakama (wide-leg pants), katana sword at waist, mon family crest"
- 머리: "chonmage topknot hairstyle with shaved forehead"

**일본 - 에도시대 남성 (일반인):**
- 복식: "wearing simple kimono with obi belt, wooden geta sandals"
- 머리: "short topknot or loose hair"

**일본 - 에도시대 여성:**
- 복식: "wearing elegant kimono with wide obi belt, tabi socks, zori sandals"
- 머리: "traditional nihongami hairstyle with kanzashi ornaments, elegant updo"

**일본 - 메이지시대 남성:**
- 복식: "wearing Western-style suit mixed with traditional hakama, or full Western clothing"
- 머리: "Western short hairstyle or traditional topknot transitioning to modern cut"

**일본 - 메이지시대 여성:**
- 복식: "wearing kimono transitioning to Western dress, or hybrid style mixing both"
- 머리: "traditional updo transitioning to Western hairstyles"

**현대 (한국/일본 공통) 남성:**
- 복식: "wearing modern business suit with tie, or casual jeans and t-shirt"
- 머리: "modern short hairstyle, clean shaven or light beard"

**현대 (한국/일본 공통) 여성:**
- 복식: "wearing modern casual dress, or office blouse and skirt, contemporary fashion"
- 머리: "modern hairstyle with long flowing hair or short bob cut, natural makeup"

**중요: 등장인물 설명은 반드시 다음을 포함하세요:**
1. 나이대 (20s, 30s, 40s, 50s)
2. 시대와 문화권에 맞는 구체적인 복식
3. 헤어스타일
4. 얼굴 특징 (kind expression, sharp eyes, gentle smile 등)

**컷 수 계산 규칙 (Visual Trigger Rule):**
다음 4가지 시각적 변화를 감지하여 컷을 추가하세요:
1. **장소 변화**: 새로운 장소가 등장하면 컷 추가
2. **인물 등장/퇴장**: 주요 인물이 들어오거나 나갈 때 컷 추가
3. **행동 전환**: 중요한 행동이 바뀔 때 컷 추가
4. **감정 변화**: 분위기나 감정이 크게 바뀔 때 컷 추가

**컷 수 제한:**
- totalScenes: 전체 장면 수 (최대 50장)
- importantScenes: 중요 장면만 (최대 35장)
- minimalScenes: 최소 필수 장면 (최대 20장)

**출력 형식:**
반드시 JSON 형식으로만 출력하고, 추가 설명은 포함하지 마세요.`
                }]
            };

            const responseSchema = {
                type: "object",
                properties: {
                    era: {
                        type: "string",
                        description: "대본의 시대 배경",
                        enum: ["joseon", "edo", "meiji", "taisho", "showa", "modern", "future", "fantasy"]
                    },
                    characters: {
                        type: "array",
                        description: "대본에 등장하는 주요 인물 목록",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string", description: "원어 이름" },
                                nameEn: { type: "string", description: "영문/로마자 이름" },
                                descriptionKo: { type: "string", description: "한글 시각적 묘사" },
                                descriptionEn: { type: "string", description: "영문 시각적 묘사" },
                                era: {
                                    type: "string",
                                    description: "이 인물의 시대 배경",
                                    enum: ["joseon", "edo", "meiji", "taisho", "showa", "modern", "future", "fantasy"]
                                }
                            },
                            required: ["name", "nameEn", "descriptionKo", "descriptionEn", "era"]
                        }
                    },
                    scenes: {
                        type: "array",
                        description: "파트별 장면 수 분석 결과 배열",
                        items: {
                            type: "object",
                            properties: {
                                partName: { type: "string", description: "파트 이름" },
                                charCount: { type: "integer", description: "대본 글자 수" },
                                visualTriggers: { type: "array", items: { type: "string" } },
                                totalScenes: { type: "integer", description: "전체 장면 수" },
                                importantScenes: { type: "integer", description: "중요 장면 수" },
                                minimalScenes: { type: "integer", description: "최소 장면 수" },
                                selectedCount: { type: "integer", description: "기본 선택 장면 수" }
                            },
                            required: ["partName", "charCount", "totalScenes", "importantScenes", "minimalScenes", "selectedCount"]
                        }
                    }
                },
                required: ["era", "characters", "scenes"]
            };

            console.log('🤖 Gemini API 호출 중 (System Instruction + JSON Mode)...');

            const response = await fetch(`${this.GEMINI_API_URL}?key=${this.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    system_instruction: systemInstruction,
                    contents: [{
                        parts: [{
                            text: `다음 대본을 분석하여 등장인물을 추출하고, 각 파트별로 필요한 장면 수를 계산해주세요.

대본:
${scriptsJson}

위 대본을 Visual Trigger Rule에 따라 분석하고, 등장인물과 장면 수를 JSON 형식으로 출력해주세요.`
                        }]
                    }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: responseSchema,
                        temperature: 0.7,
                        topP: 0.9,
                        topK: 40
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Gemini API 응답 오류:', errorText);
                throw new Error(`Gemini API 오류: ${response.status}`);
            }

            const data = await response.json();

            const textResponse = data.candidates[0].content.parts[0].text;
            const analysisResult = JSON.parse(textResponse);

            if (Array.isArray(analysisResult.scenes)) {
                const scenesObject = {};
                analysisResult.scenes.forEach(scene => {
                    const partName = scene.partName;
                    scenesObject[partName] = {
                        charCount: scene.charCount,
                        visualTriggers: scene.visualTriggers || [],
                        totalScenes: scene.totalScenes,
                        importantScenes: scene.importantScenes,
                        minimalScenes: scene.minimalScenes,
                        selectedCount: scene.selectedCount
                    };
                });
                analysisResult.scenes = scenesObject;
            }

            console.log('✅ Gemini 분석 완료:', analysisResult);
            console.log(`  - 등장인물: ${analysisResult.characters?.length || 0}명`);
            console.log(`  - 분석 파트: ${Object.keys(analysisResult.scenes || {}).length}개`);

            return analysisResult;

        } catch (error) {
            console.error('❌ Gemini API 오류, 규칙 기반 폴백:', error);
            return this.analyzeScriptRuleBased(scripts);
        }
    },

    /**
     * 규칙 기반 대본 분석 (폴백)
     */
    analyzeScriptRuleBased(scripts) {
        console.log('📝 규칙 기반 대본 분석 시작 (Gemini API 없음)');
        console.warn('⚠️ Gemini API 키가 없어 등장인물 자동 추출이 불가합니다. API 키를 등록해주세요.');

        // Gemini API 없이는 등장인물 추출 불가 - 빈 배열 반환
        const characters = [];

        const scenes = {};

        Object.keys(scripts).forEach(part => {
            const text = scripts[part] || '';
            const charCount = text.length;

            let totalScenes, importantScenes, minimalScenes;

            if (charCount < 1000) {
                totalScenes = 5;
                importantScenes = 3;
                minimalScenes = 2;
            } else if (charCount < 2000) {
                totalScenes = 10;
                importantScenes = 7;
                minimalScenes = 4;
            } else if (charCount < 4000) {
                totalScenes = 20;
                importantScenes = 14;
                minimalScenes = 8;
            } else if (charCount < 6000) {
                totalScenes = 30;
                importantScenes = 20;
                minimalScenes = 12;
            } else if (charCount < 8000) {
                totalScenes = 40;
                importantScenes = 28;
                minimalScenes = 16;
            } else {
                totalScenes = 50;
                importantScenes = 35;
                minimalScenes = 20;
            }

            scenes[part] = {
                charCount,
                visualTriggers: ['글자 수 기반 계산 (Gemini API 사용 권장)'],
                totalScenes,
                importantScenes,
                minimalScenes,
                selectedCount: importantScenes
            };
        });

        const result = { characters, scenes };
        console.log('✅ 규칙 기반 분석 완료 (장면 수만 계산됨):', result);
        console.log('⚠️ 등장인물 추출을 위해서는 Gemini API 키를 등록해주세요.');

        return result;
    },

    /**
     * Gemini로 장면별 프롬프트 생성
     */
    async generateScenePromptWithGemini(params) {
        if (!this.GEMINI_API_KEY) {
            console.warn('⚠️ Gemini API 키 없음, 규칙 기반 프롬프트 사용');
            return null;
        }

        try {
            const { scriptText, characters, style, era } = params;

            const characterInfo = characters && characters.length > 0
                ? characters.map(c => {
                    const desc = c.descriptionEn || c.description || c.promptEn || 'character';
                    return `${c.nameEn || c.name}: ${desc}`;
                }).join('\n')
                : '등장인물 정보 없음';

            const systemInstruction = {
                parts: [{
                    text: `당신은 이미지 생성 프롬프트 전문가입니다. 한국/일본 드라마/이야기/야담 장면을 정확한 영어 프롬프트로 변환합니다.

**중요 원칙:**
1. 등장인물 정보를 **반드시** 프롬프트에 포함하여 일관성 유지
2. 장면의 시각적 요소를 구체적으로 묘사 (장소, 시간, 조명, 분위기)
3. 자연스러운 문장형 프롬프트 작성
4. "masterpiece, best quality" 같은 부스터 태그는 사용하지 않음
5. 각 문화권(한국/일본)의 특성을 정확히 반영하여 묘사
6. 한국어 대본이든 일본어 대본이든 완벽하게 이해하고 영문으로 변환

**문화권별 주의사항:**
- **한국**: 조선시대(hanbok, gat, jeogori, chima), 현대 한국 패션
- **일본**: 에도시대(kimono, hakama, katana, chonmage), 메이지시대(Western-Japanese fusion), 현대 일본 패션
- 시대 배경(era)에 맞는 정확한 복식과 배경 묘사 필수

**출력 형식:**
순수 영문 프롬프트만 출력하세요. JSON 형식이나 추가 설명은 포함하지 마세요.`
                }]
            };

            const response = await fetch(`${this.GEMINI_API_URL}?key=${this.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    system_instruction: systemInstruction,
                    contents: [{
                        parts: [{
                            text: `다음 장면을 영어 이미지 프롬프트로 변환하세요:

**장면 대본:**
${scriptText}

**등장인물 정보 (반드시 포함):**
${characterInfo}

**스타일:** ${style}
**시대 배경:** ${era || 'modern'}

**요구사항:**
- 등장인물이 있다면 정확한 설명 포함
- 시대 배경(era)에 맞는 정확한 복식과 배경 묘사
- 장소, 시간대, 조명, 분위기를 구체적으로 묘사
- 자연스러운 문장형 프롬프트로 작성

영어 프롬프트만 출력하세요:`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.9,
                        topK: 40
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Gemini API 오류: ${response.status}`);
            }

            const data = await response.json();
            const promptEn = data.candidates[0].content.parts[0].text.trim();

            console.log('✅ Gemini 장면 프롬프트 생성:', promptEn.substring(0, 100) + '...');

            return {
                en: promptEn,
                ko: scriptText.substring(0, 50) + '...',
                negative: 'low quality, blurry, distorted, ugly, bad anatomy, Chinese style, Japanese anime, text, watermark'
            };

        } catch (error) {
            console.error('❌ Gemini 장면 프롬프트 생성 실패:', error);
            return null;
        }
    }
};

// 전역 함수로 노출
window.API = API;
