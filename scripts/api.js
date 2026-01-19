/**
 * 미슬곰 이미지 자동 생성기 v1.0 - API 통신 모듈
 * 백엔드 API와 통신 (데모 모드 포함)
 */

const API = {
    // API 기본 URL
    baseURL: window.location.hostname === 'localhost' 
        ? 'http://localhost:8000' 
        : 'https://miseulgom-backend.railway.app',

    // Stable Diffusion WebUI URL
    SDWEBUI_URL: 'http://127.0.0.1:7860',

    // Gemini API 설정
    GEMINI_API_KEY: '', // 사용자가 입력해야 함
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',

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

    // ========== 로컬 Stable Diffusion WebUI API ==========
    
    /**
     * 로컬 SD WebUI로 이미지 생성 (txt2img) - v2.0 ADetailer 추가
     * @param {Object} params - 생성 파라미터
     * @param {string} params.prompt - 프롬프트
     * @param {string} params.style - 스타일 (애니메이션 모델 자동 전환)
     * @param {number} params.width - 너비 (기본: 1024)
     * @param {number} params.height - 높이 (기본: 1024)
     * @param {number} params.steps - 샘플링 스텝 (기본: 30)
     * @param {number} params.cfg_scale - CFG 스케일 (기본: 7.5)
     * @param {boolean} params.enableADetailer - ADetailer 활성화 (기본: true)
     * @returns {Promise<string>} - 이미지 Data URL
     */
    async generateImageLocal(params) {
        try {
            const {
                prompt,
                style,
                width = 1024,
                height = 1024,
                steps = 30,
                cfg_scale = 7.5,
                negative_prompt = 'low quality, blurry, distorted, deformed',
                enableADetailer = true  // 🆕 ADetailer 활성화 옵션
            } = params;

         // 🎯 스타일별 모델 자동 선택
            let modelName = 'juggernautXL_ragnarokBy.safetensors';  // 기본 모델 (선생님 파일 이름)
            
            if (style === 'lyrical-anime' || style === 'action-anime') {
                modelName = 'animagineXL40_v4Opt.safetensors';  // 애니메이션 전용 (선생님 파일 이름)
                console.log('🎌 애니메이션 모델로 전환:', modelName);
            }

            // 모델 변경 (필요 시)
            try {
                await fetch(`${this.SDWEBUI_URL}/sdapi/v1/options`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sd_model_checkpoint: modelName
                    })
                });
                console.log('✅ 모델 설정 완료:', modelName);
            } catch (modelError) {
                console.warn('⚠️ 모델 변경 실패 (기본 모델 사용):', modelError);
            }

            console.log('🎨 로컬 SD WebUI 호출:', { 
                prompt, 
                width, 
                height, 
                steps, 
                cfg_scale, 
                model: modelName,
                adetailer: enableADetailer ? 'ON' : 'OFF'
            });

            // 🆕 ADetailer 설정 (SD WebUI 확장 프로그램 필요)
            const adetailerConfig = enableADetailer ? {
                "ADetailer": {
                    "args": [
                        {
                            "ad_model": "face_yolov8n.pt",
                            "ad_prompt": "high quality, detailed face",
                            "ad_negative_prompt": "low quality, blurry face",
                            "ad_denoising_strength": 0.4,
                            "ad_inpaint_only_masked": true,
                            "ad_confidence": 0.3
                        }
                    ]
                }
            } : {};

            // 🔧 ADetailer가 없을 경우를 대비한 기본 요청
            const requestBody = {
                prompt: prompt,
                negative_prompt: negative_prompt,
                width: width,
                height: height,
                steps: steps,
                cfg_scale: cfg_scale,
                sampler_name: 'DPM++ 2M Karras',
                batch_size: 1,
                n_iter: 1
            };

            // ADetailer 활성화 시에만 추가 (설치되지 않았을 때 422 에러 방지)
            if (enableADetailer && Object.keys(adetailerConfig).length > 0) {
                requestBody.alwayson_scripts = adetailerConfig;
            }

            const response = await fetch(`${this.SDWEBUI_URL}/sdapi/v1/txt2img`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`SD WebUI 응답 오류: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.images || data.images.length === 0) {
                throw new Error('SD WebUI: 이미지 생성 실패');
            }

            // Base64 이미지를 Data URL로 변환
            const imageDataUrl = `data:image/png;base64,${data.images[0]}`;
            console.log('✅ 로컬 이미지 생성 완료', enableADetailer ? '(ADetailer 얼굴 보정 적용)' : '');
            
            return imageDataUrl;

        } catch (error) {
            console.error('❌ 로컬 SD WebUI 오류:', error);
            throw error;
        }
    },

    /**
     * 로컬 SD WebUI로 이미지 수정 (img2img) - v2.0 ADetailer 추가
     * @param {string} imageUrl - 원본 이미지 URL 또는 Data URL
     * @param {string} editPrompt - 수정 프롬프트
     * @param {number} width - 너비
     * @param {number} height - 높이
     * @param {boolean} enableADetailer - ADetailer 활성화 (기본: true)
     * @returns {Promise<string>} - 수정된 이미지 Data URL
     */
    async editImageLocal(imageUrl, editPrompt, width = 1024, height = 1024, enableADetailer = true) {
        try {
            console.log('✏️ 로컬 SD WebUI img2img 호출:', { 
                editPrompt, 
                width, 
                height,
                adetailer: enableADetailer ? 'ON' : 'OFF'
            });

            // 이미지 URL을 Base64로 변환
            const base64Image = await this.imageUrlToBase64(imageUrl);

            // 🆕 ADetailer 설정
            const adetailerConfig = enableADetailer ? {
                ADetailer: {
                    args: [{
                        ad_model: "face_yolov8n.pt",
                        ad_prompt: "high quality, detailed face, clear eyes, natural skin texture",
                        ad_negative_prompt: "low quality, blurry face, distorted face, bad anatomy",
                        ad_denoising_strength: 0.35,  // img2img는 조금 약하게
                        ad_inpaint_only_masked: true,
                        ad_confidence: 0.3,
                        ad_dilate_erode: 4
                    }]
                }
            } : {};

            const response = await fetch(`${this.SDWEBUI_URL}/sdapi/v1/img2img`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    init_images: [base64Image],
                    prompt: editPrompt,
                    negative_prompt: 'low quality, blurry, distorted',
                    width: width,
                    height: height,
                    steps: 30,
                    cfg_scale: 7.5,
                    denoising_strength: 0.5,
                    sampler_name: 'DPM++ 2M Karras',
                    // 🆕 ADetailer 얼굴 보정
                    alwayson_scripts: adetailerConfig
                })
            });

            if (!response.ok) {
                throw new Error(`SD WebUI img2img 오류: ${response.status}`);
            }

            const data = await response.json();
            const editedImageDataUrl = `data:image/png;base64,${data.images[0]}`;
            
            console.log('✅ 이미지 수정 완료', enableADetailer ? '(ADetailer 얼굴 보정 적용)' : '');
            return editedImageDataUrl;

        } catch (error) {
            console.error('❌ 로컬 img2img 오류:', error);
            throw error;
        }
    },

    /**
     * 이미지 URL을 Base64로 변환
     * @param {string} url - 이미지 URL
     * @returns {Promise<string>} - Base64 문자열 (data:image/png;base64, 제외)
     */
    async imageUrlToBase64(url) {
        try {
            // Data URL인 경우 Base64 부분만 추출
            if (url.startsWith('data:image')) {
                return url.split(',')[1];
            }

            // 일반 URL인 경우 fetch로 가져오기
            const response = await fetch(url);
            const blob = await response.blob();
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

        } catch (error) {
            console.error('❌ Base64 변환 실패:', error);
            throw error;
        }
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
            const error = new Error('Gemini API 키가 설정되지 않았습니다.');
            console.error('❌ Gemini API 키 누락:', error);
            throw error;
        }
        try {
            const scriptsJson = JSON.stringify(scripts, null, 2);

            // 🆕 System Instruction 정의
            const systemInstruction = {
                parts: [{
                    text: `당신은 영상 대본을 분석하여 컷 수를 계산하고 등장인물을 추출하는 전문가입니다.

**역할:**
1. 대본에서 등장인물을 자동으로 추출합니다.
2. 시각적 변화를 감지하여 필요한 컷(장면) 수를 계산합니다.

**등장인물 추출 규칙:**
- 대본에 등장하는 모든 주요 인물을 추출하세요.
- 한글 이름과 영문 이름을 함께 제공하세요.
- 시각적 묘사(외형, 복장, 특징)를 한글과 영문으로 작성하세요.
- 묘사는 구체적이고 이미지 생성에 적합해야 합니다.

**컷 수 계산 규칙 (Visual Trigger Rule):**
다음 4가지 시각적 변화를 감지하여 컷을 추가하세요:
1. **장소 변화**: 새로운 장소가 등장하면 컷 추가 (예: 집 → 거리 → 숲)
2. **인물 등장/퇴장**: 주요 인물이 들어오거나 나갈 때 컷 추가
3. **행동 전환**: 중요한 행동이 바뀔 때 컷 추가 (예: 걷기 → 싸움 → 대화)
4. **감정 변화**: 분위기나 감정이 크게 바뀔 때 컷 추가 (예: 평온 → 긴장 → 슬픔)

**컷 수 제한:**
- totalScenes: 전체 장면 수 (최대 50장)
- importantScenes: 중요 장면만 (최대 35장)
- minimalScenes: 최소 필수 장면 (최대 20장)

**출력 형식:**
반드시 JSON 형식으로만 출력하고, 추가 설명은 포함하지 마세요.`
                }]
            };

            // 🆕 JSON Schema 정의 (Gemini API 호환)
            const responseSchema = {
                type: "object",
                properties: {
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
                                    description: "한글 시각적 묘사 (외형, 복장, 특징)"
                                },
                                descriptionEn: {
                                    type: "string",
                                    description: "영문 시각적 묘사 (이미지 생성용)"
                                }
                            },
                            required: ["name", "nameEn", "descriptionKo", "descriptionEn"]
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
                required: ["characters", "scenes"]
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
            console.error('❌ Gemini API 오류:', error);
            throw error;
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
    }
};

// 전역 함수로 노출
window.API = API;
