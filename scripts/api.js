/**
 * 미슬곰 이미지 자동 생성기 v1.0 - API 통신 모듈
 * 백엔드 API와 통신 (데모 모드 포함)
 */

const API = {
    // API 기본 URL (Vercel 배포 환경에서는 빈 문자열 사용)
    baseURL: '',

    // 이미지 생성 API 설정 (LocalStorage에서 로드)
    IMAGE_API_TYPE: null, // 'ai_studio' 또는 'vertex_ai'
    IMAGE_API_KEY: null,
    IMAGE_PROJECT_ID: null,

    // Rate Limit 보호 (AI Studio 기본값)
    lastRequestTime: 0,
    minDelay: 6000, // 최소 6초 (AI Studio 무료 tier: 분당 10회 제한 대응)
    maxDelay: 10000, // 최대 10초

    // Gemini 대본 분석 API 설정
    GEMINI_API_KEY: '', // 사용자가 입력해야 함
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
            hasProjectId: !!this.IMAGE_PROJECT_ID
        });

        return {
            apiType: this.IMAGE_API_TYPE,
            apiKey: this.IMAGE_API_KEY,
            projectId: this.IMAGE_PROJECT_ID
        };
    },

    /**
     * 이미지 생성 API 설정 저장 (서버에 저장)
     * @param {string} apiType - 'ai_studio' 또는 'vertex_ai'
     * @param {string} apiKey - API 키
     * @param {string} projectId - Vertex AI 프로젝트 ID (선택)
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
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ apiType, apiKey, projectId })
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
                headers: {
                    'Content-Type': 'application/json'
                }
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: scriptText })
            });

            if (!response.ok) {
                throw new Error('대본 분석 실패');
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.warn('⚠️ API 호출 실패, 데모 데이터 사용');
            
            // 데모 데이터
            return {
                characters: [
                    {
                        name: '윤해린',
                        nameEn: 'Yoon Haerin',
                        description: '20대 초반 여성, 긴 검은 머리, 우아한 한복'
                    },
                    {
                        name: '백도식',
                        nameEn: 'Baek Dosik',
                        description: '30대 남성, 짧은 검은 머리, 전통 한복'
                    }
                ],
                sceneCount: 30
            };
        }
    },

    // 이미지 생성
    async generateImage(params) {
        try {
            const response = await fetch(`${this.baseURL}/api/generate-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                throw new Error('이미지 생성 실패');
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.warn('⚠️ API 호출 실패, 데모 이미지 사용');
            
            // 데모 이미지
            const demoImages = [
                'https://images.unsplash.com/photo-1551847812-36c8db2e6936?w=800&h=450&fit=crop',
                'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800&h=450&fit=crop',
                'https://images.unsplash.com/photo-1551847812-9dcf1acbf8b4?w=800&h=450&fit=crop'
            ];

            return {
                imageUrl: demoImages[Math.floor(Math.random() * demoImages.length)]
            };
        }
    },

    // 프로젝트 생성
    async createProject(name, style) {
        try {
            const response = await fetch(`${this.baseURL}/api/projects/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name || `미슬곰_${Date.now()}`,
                    style: style || 'realistic'
                })
            });

            if (!response.ok) {
                throw new Error('프로젝트 생성 실패');
            }

            const data = await response.json();
            return data;

        } catch (error) {
            throw new Error(this.handleError(error));
        }
    },

    // ========== Google Image Generation API ==========

    /**
     * API별 딜레이 설정 가져오기
     * @param {string} apiType - 'ai_studio' 또는 'vertex_ai'
     * @returns {Object} - { min, max } 딜레이 범위 (밀리초)
     */
    getDelayForApi(apiType) {
        if (apiType === 'vertex_ai') {
            // Vertex AI: 더 관대한 Rate Limit (1-2초)
            return { min: 1000, max: 2000 };
        } else {
            // AI Studio: 엄격한 Rate Limit (6-10초, 분당 10회)
            return { min: 6000, max: 10000 };
        }
    },

    /**
     * Rate Limit 보호를 위한 딜레이 (API별 차별화)
     * @param {string} apiType - 'ai_studio' 또는 'vertex_ai'
     */
    async _waitBeforeRequest(apiType = 'ai_studio') {
        const { min, max } = this.getDelayForApi(apiType);
        const elapsed = Date.now() - this.lastRequestTime;
        const requiredDelay = Math.random() * (max - min) + min;

        if (elapsed < requiredDelay) {
            const waitTime = requiredDelay - elapsed;
            console.log(`⏳ ${apiType === 'vertex_ai' ? 'Vertex AI' : 'AI Studio'} Rate Limit 보호: ${(waitTime/1000).toFixed(1)}초 대기...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();
    },

    /**
     * Exponential Backoff 재시도 로직
     * @param {Function} func - 실행할 함수
     * @param {number} maxRetries - 최대 재시도 횟수
     */
    async _retryWithBackoff(func, maxRetries = 3) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await func();
            } catch (error) {
                const errorStr = error.toString();

                // 429 Rate Limit 에러
                if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
                    if (attempt === maxRetries - 1) {
                        throw new Error('일일 사용량을 초과했습니다. 잠시 후 다시 시도해주세요.');
                    }

                    // Exponential backoff: 5초, 10초, 20초 + jitter
                    const waitTime = Math.pow(2, attempt) * 5000 + Math.random() * 2000;
                    console.warn(`⚠️ Rate Limit 도달. ${(waitTime/1000).toFixed(1)}초 후 재시도 (${attempt + 1}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    throw error;
                }
            }
        }
    },

    /**
     * Google Image Generation API로 이미지 생성 (JWT 토큰 방식)
     * @param {Object} params - 생성 파라미터
     * @param {string} params.prompt - 프롬프트
     * @param {string} params.aspectRatio - 비율 (기본: '1:1')
     * @returns {Promise<string>} - 이미지 Data URL
     */
    async generateImageLocal(params) {
        const { prompt, aspectRatio = '1:1' } = params;

        // JWT 토큰 가져오기
        const token = localStorage.getItem('auth_token');

        if (!token) {
            throw new Error('로그인이 필요합니다');
        }

        // 선택된 API 타입 가져오기 (서버에서 설정된 것 사용)
        let selectedApiType = 'ai_studio'; // 기본값
        try {
            const settingsResponse = await fetch('/api/user/settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (settingsResponse.ok) {
                const settings = await settingsResponse.json();
                selectedApiType = settings.apiType || 'ai_studio';
            }
        } catch (error) {
            console.warn('API 타입 확인 실패, 기본값 사용:', error);
        }

        console.log('🎨 이미지 생성 요청:', {
            prompt: prompt.substring(0, 50) + '...',
            aspectRatio,
            apiType: selectedApiType
        });

        // Rate Limit 보호 및 재시도 (API별 차별화된 딜레이)
        return await this._retryWithBackoff(async () => {
            await this._waitBeforeRequest(selectedApiType);

            // Vercel 서버리스 함수 호출
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ prompt, aspectRatio })
            });

            if (response.status === 401) {
                // 토큰 만료
                localStorage.removeItem('auth_token');
                window.location.href = '/login.html';
                throw new Error('로그인이 만료되었습니다');
            }

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));

                if (response.status === 429) {
                    throw new Error('RESOURCE_EXHAUSTED');
                }

                throw new Error(data.error || `API 오류: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ 이미지 생성 완료');

            return data.imageUrl;
        });
    },


    /**
     * 이미지 수정 (img2img) - Google API는 지원하지 않음
     * @deprecated Google Gemini는 img2img를 지원하지 않습니다.
     */
    async editImageLocal(imageUrl, editPrompt) {
        console.warn('⚠️ 이미지 수정 기능은 현재 지원하지 않습니다.');

        // 새로운 이미지를 생성하는 것으로 대체
        const fullPrompt = `Based on the following description, create a new image: ${editPrompt}`;

        return await this.generateImageLocal({
            prompt: fullPrompt,
            aspectRatio: '1:1'
        });
    },

    // ========== Gemini API (대본 분석) ==========
    
    /**
     * Gemini API로 대본 분석 (v2.0 - System Instruction + 등장인물 자동 추출)
     * @param {Object} scripts - 파트별 대본 { intro: '', part1: '', ... }
     * @returns {Promise<Object>} - { characters: [...], scenes: {...} }
     */
    async analyzeScriptWithGemini(scripts) {
        if (!this.GEMINI_API_KEY) {
            console.warn('⚠️ Gemini API 키가 설정되지 않음. 규칙 기반 분석 사용');
            return this.analyzeScriptRuleBased(scripts);
        }

        try {
            const scriptsJson = JSON.stringify(scripts, null, 2);

            // 🆕 System Instruction 정의 (v3.0 - 시대 판별 + 디테일 복식)
            const systemInstruction = {
                parts: [{
                    text: `당신은 한국 드라마/이야기 대본을 분석하는 전문가입니다. 시대 배경을 정확히 판별하고, 등장인물을 추출하며, 장면 수를 계산합니다.

**역할:**
1. 대본의 시대 배경을 자동으로 판별합니다 (조선시대/현대/미래/SF)
2. 등장인물을 추출하고 시대에 맞는 복식/헤어스타일을 구체적으로 묘사합니다
3. 시각적 변화를 감지하여 필요한 장면 수를 계산합니다

**시대 판별 규칙:**
- **조선시대**: "갓", "한복", "양반", "사또", "궁궐", "초가", "기생", "상투" 등
- **현대**: "자동차", "휴대폰", "회사", "아파트", "카페", "인터넷", "양복", "청바지" 등
- **미래/SF**: "로봇", "우주", "사이버", "AI", "홀로그램", "타임머신" 등
- **판타지**: "마법", "드래곤", "이세계", "던전" 등

**등장인물 추출 규칙:**
- 대본에 등장하는 모든 주요 인물을 추출하세요
- 한글 이름과 영문 이름(로마자 표기)을 함께 제공하세요
- 시대에 맞는 복식과 헤어스타일을 **매우 구체적으로** 묘사하세요

**시대별 복식/헤어 디테일:**

조선시대 남성:
- 복식: "wearing traditional Joseon hanbok with dopo overcoat, gat (traditional Korean hat), silk belt"
- 머리: "topknot hairstyle (sangtu) with traditional Korean headband"

조선시대 여성:
- 복식: "wearing elegant Joseon hanbok with jeogori (short jacket) and chima (long skirt), daenggi hair ribbon"
- 머리: "traditional Korean braided hairstyle with daenggi ribbon, jokduri crown (for married women)"

현대 남성:
- 복식: "wearing modern business suit with tie, or casual jeans and t-shirt"
- 머리: "modern short hairstyle, clean shaven or light beard"

현대 여성:
- 복식: "wearing modern casual dress, or office blouse and skirt, contemporary Korean fashion"
- 머리: "modern hairstyle with long flowing hair or short bob cut, natural makeup"

**중요: 등장인물 설명은 반드시 다음을 포함하세요:**
1. 나이대 (20s, 30s, 40s, 50s)
2. 시대에 맞는 구체적인 복식 (조선시대: jeogori/chima/gat, 현대: suit/jeans)
3. 헤어스타일 (조선시대: sangtu/daenggi, 현대: modern hairstyle)
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

            // 🆕 JSON Schema 정의 (Gemini API 호환) - v3.0 era 추가
            const responseSchema = {
                type: "object",
                properties: {
                    era: {
                        type: "string",
                        description: "대본의 시대 배경 (joseon/modern/future/fantasy)",
                        enum: ["joseon", "modern", "future", "fantasy"]
                    },
                    characters: {
                        type: "array",
                        description: "대본에 등장하는 주요 인물 목록",
                        items: {
                            type: "object",
                            properties: {
                                name: {
                                    type: "string",
                                    description: "한글 이름"
                                },
                                nameEn: {
                                    type: "string",
                                    description: "영문 이름"
                                },
                                descriptionKo: {
                                    type: "string",
                                    description: "한글 시각적 묘사 (나이대, 외형, 복장, 헤어스타일, 특징)"
                                },
                                descriptionEn: {
                                    type: "string",
                                    description: "영문 시각적 묘사 (이미지 생성용, 매우 구체적으로)"
                                },
                                era: {
                                    type: "string",
                                    description: "이 인물의 시대 배경 (joseon/modern/future/fantasy)",
                                    enum: ["joseon", "modern", "future", "fantasy"]
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
                                partName: {
                                    type: "string",
                                    description: "파트 이름 (intro, 1, 2, 3...)"
                                },
                                charCount: {
                                    type: "integer",
                                    description: "대본 글자 수"
                                },
                                visualTriggers: {
                                    type: "array",
                                    description: "감지된 시각적 변화 목록",
                                    items: { type: "string" }
                                },
                                totalScenes: {
                                    type: "integer",
                                    description: "전체 장면 수 (최대 50)"
                                },
                                importantScenes: {
                                    type: "integer",
                                    description: "중요 장면 수 (최대 35)"
                                },
                                minimalScenes: {
                                    type: "integer",
                                    description: "최소 장면 수 (최대 20)"
                                },
                                selectedCount: {
                                    type: "integer",
                                    description: "기본 선택 장면 수"
                                }
                            },
                            required: ["partName", "charCount", "totalScenes", "importantScenes", "minimalScenes", "selectedCount"]
                        }
                    }
                },
                required: ["era", "characters", "scenes"]
            };

            console.log('🤖 Gemini API 호출 중 (System Instruction + JSON Mode)...');

            // 🆕 API 호출 (System Instruction + JSON 강제 모드)
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

            // 🆕 JSON 직접 파싱 (강제 모드이므로 안전)
            const textResponse = data.candidates[0].content.parts[0].text;
            const analysisResult = JSON.parse(textResponse);

            // 🔄 scenes 배열을 객체로 변환 (partName을 키로 사용)
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
     * 규칙 기반 대본 분석 (폴백) - v2.0 (등장인물 + 장면 수)
     * @param {Object} scripts - 파트별 대본
     * @returns {Object} - { characters: [...], scenes: {...} }
     */
    analyzeScriptRuleBased(scripts) {
        console.log('📝 규칙 기반 대본 분석 시작 (Gemini API 없음)');
        
        // 🆕 기본 등장인물 (데모용)
        const characters = [
            {
                name: '주인공',
                nameEn: 'Protagonist',
                descriptionKo: '20대 중반, 검은 머리, 평범한 옷차림',
                descriptionEn: 'young adult in mid-20s, black hair, casual clothing, determined expression'
            },
            {
                name: '조력자',
                nameEn: 'Helper',
                descriptionKo: '30대, 갈색 머리, 지혜로운 표정',
                descriptionEn: 'person in their 30s, brown hair, wise expression, traditional clothing'
            }
        ];

        // 장면 수 계산 (기존 로직)
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
                selectedCount: importantScenes // 기본값
            };
        });

        const result = { characters, scenes };
        console.log('✅ 규칙 기반 분석 완료:', result);
        console.log('⚠️ 경고: Gemini API 사용 시 더 정확한 등장인물 추출과 장면 분석이 가능합니다.');

        return result;
    },

    /**
     * Gemini로 장면별 프롬프트 생성 - v3.0 (등장인물 일관성 유지)
     * @param {Object} params - { scriptText, characters, style, era }
     * @returns {Promise<Object>} - { promptEn, promptKo, negative }
     */
    async generateScenePromptWithGemini(params) {
        if (!this.GEMINI_API_KEY) {
            console.warn('⚠️ Gemini API 키 없음, 규칙 기반 프롬프트 사용');
            return null;
        }

        try {
            const { scriptText, characters, style, era } = params;

            // 등장인물 정보 문자열로 변환
            const characterInfo = characters && characters.length > 0
                ? characters.map(c => `${c.nameEn}: ${c.descriptionEn}`).join('\n')
                : '등장인물 정보 없음';

            const systemInstruction = {
                parts: [{
                    text: `당신은 이미지 생성 프롬프트 전문가입니다. 한국 드라마/이야기 장면을 영어 프롬프트로 변환합니다.

**중요 원칙:**
1. 등장인물 정보를 **반드시** 프롬프트에 포함하여 일관성 유지
2. 장면의 시각적 요소를 구체적으로 묘사 (장소, 시간, 조명, 분위기)
3. 자연스러운 문장형 프롬프트 작성
4. "masterpiece, best quality" 같은 부스터 태그는 사용하지 않음
5. 중국풍/일본풍 요소를 피하고 한국 문화에 집중

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
**시대 배경:** ${era || 'joseon'}

**요구사항:**
- 등장인물이 있다면 정확한 설명 포함 (예: "featuring Yoon Haerin wearing elegant Joseon hanbok")
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
