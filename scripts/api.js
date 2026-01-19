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

    // 💡 [수정됨] Gemini API 설정 (안정적인 버전으로 변경)
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
            if (response.ok) return true;
            return false;
        } catch (error) {
            console.warn('⚠️ 백엔드 연결 실패:', error.message);
            return false;
        }
    },

    // 에러 처리
    handleError(error) {
        console.error('❌ API 에러:', error);
        return error.message || '알 수 없는 오류가 발생했습니다.';
    },

    // ========== 로컬 Stable Diffusion WebUI API ==========
    
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
                enableADetailer = true 
            } = params;

            // 💡 [수정됨] 선생님 컴퓨터의 정확한 파일 이름 적용
            let modelName = 'juggernautXL_ragnarokBy.safetensors';  
            
            // 애니메이션 스타일일 때만 애니메이션 모델 사용
            if (style === 'lyrical-anime' || style === 'action-anime') {
                modelName = 'animagineXL40_v4Opt.safetensors'; 
                console.log('🎌 애니메이션 모델로 전환:', modelName);
            }

            // 모델 변경 요청
            try {
                await fetch(`${this.SDWEBUI_URL}/sdapi/v1/options`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sd_model_checkpoint: modelName })
                });
                console.log('✅ 모델 설정 완료:', modelName);
            } catch (modelError) {
                console.warn('⚠️ 모델 변경 실패 (기본 모델 사용):', modelError);
            }

            // ADetailer 설정 (얼굴 보정)
            const adetailerConfig = enableADetailer ? {
                "ADetailer": {
                    "args": [
                        {
                            "ad_model": "face_yolov8n.pt",
                            "ad_prompt": "high quality, detailed face",
                            "ad_negative_prompt": "low quality, blurry face",
                            "ad_confidence": 0.3
                        }
                    ]
                }
            } : {};

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

            if (enableADetailer) {
                requestBody.alwayson_scripts = adetailerConfig;
            }

            const response = await fetch(`${this.SDWEBUI_URL}/sdapi/v1/txt2img`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`SD WebUI 응답 오류: ${response.status}`);

            const data = await response.json();
            if (!data.images || data.images.length === 0) throw new Error('이미지 생성 실패');

            return `data:image/png;base64,${data.images[0]}`;

        } catch (error) {
            console.error('❌ 로컬 SD WebUI 오류:', error);
            throw error;
        }
    },

    // ========== Gemini API (대본 분석) ==========
    
    async analyzeScriptWithGemini(scripts) {
        if (!this.GEMINI_API_KEY) {
            console.warn('⚠️ Gemini API 키 없음. 규칙 기반 분석 사용');
            return this.analyzeScriptRuleBased(scripts);
        }

        try {
            const scriptsJson = JSON.stringify(scripts, null, 2);
            
            const systemInstruction = {
                parts: [{
                    text: `당신은 영상 대본 분석 전문가입니다. 대본에서 등장인물을 추출하고, 장면(컷) 수를 계산하세요. JSON 형식으로만 응답하세요.`
                }]
            };

            console.log('🤖 Gemini API 호출 중...');

            // 💡 [확인] 수정된 URL로 호출
            const response = await fetch(`${this.GEMINI_API_URL}?key=${this.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `다음 대본을 분석하여 등장인물과 장면 수를 JSON으로 출력하세요:\n${scriptsJson}`
                        }]
                    }]
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Gemini API 응답 오류:', errorText);
                throw new Error(`Gemini API 오류: ${response.status}`);
            }

            const data = await response.json();
            
            let textResponse = data.candidates[0].content.parts[0].text;
            textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const analysisResult = JSON.parse(textResponse);
            console.log('✅ Gemini 분석 완료:', analysisResult);

            return analysisResult;

        } catch (error) {
            console.error('❌ Gemini API 오류, 규칙 기반 폴백:', error);
            return this.analyzeScriptRuleBased(scripts);
        }
    },

    // 규칙 기반 분석 (폴백)
    analyzeScriptRuleBased(scripts) {
        console.log('📝 규칙 기반 대본 분석 시작');
        
        // 장면 수 계산
        const scenes = {};
        Object.keys(scripts).forEach(part => {
            const text = scripts[part] || '';
            const charCount = text.length;
            
            scenes[part] = {
                charCount: charCount, // 💡 [수정됨] charCount가 누락되지 않도록 명시
                visualTriggers: ['글자 수 기반'],
                totalScenes: 5,
                importantScenes: 3,
                minimalScenes: 2,
                selectedCount: 3
            };
        });

        return {
            characters: [
                { name: '주인공', nameEn: 'Protagonist', descriptionKo: '검은 머리 한국인', descriptionEn: 'Korean person, black hair' }
            ],
            scenes: scenes
        };
    }
};

// 전역 함수로 노출
window.API = API;
