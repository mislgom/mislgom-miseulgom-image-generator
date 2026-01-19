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

    // 💡 [수정됨] 오류 없는 정식 버전 주소로 변경
    GEMINI_API_KEY: '', // 사용자가 입력해야 함
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',

    // 헬스 체크
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
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

    // ========== 로컬 Stable Diffusion WebUI API (화풍 문제 해결) ==========
    
    async generateImageLocal(params) {
        try {
            const {
                prompt, style, width = 1024, height = 1024,
                steps = 30, cfg_scale = 7.5,
                negative_prompt = 'low quality, blurry, distorted, deformed',
                enableADetailer = true 
            } = params;

            // 🎯 선생님 컴퓨터 파일 이름 적용 (중국풍 해결)
            let modelName = 'juggernautXL_ragnarokBy.safetensors';  
            
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

            const requestBody = {
                prompt, negative_prompt, width, height, steps, cfg_scale,
                sampler_name: 'DPM++ 2M Karras', batch_size: 1, n_iter: 1
            };
            
            // ADetailer (얼굴 보정)
            if (enableADetailer) {
                requestBody.alwayson_scripts = {
                    "ADetailer": {
                        "args": [{
                            "ad_model": "face_yolov8n.pt",
                            "ad_prompt": "high quality, detailed face",
                            "ad_confidence": 0.3
                        }]
                    }
                };
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

    // ========== Gemini API (대본 분석 - 404 오류 해결) ==========
    
    async analyzeScriptWithGemini(scripts) {
        // API 키 없으면 바로 규칙 기반으로 이동
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

            console.log('🤖 Gemini API 호출 중 (수정된 주소)...');

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

    // 규칙 기반 분석 (폴백 - TypeError 해결)
    analyzeScriptRuleBased(scripts) {
        console.log('📝 규칙 기반 대본 분석 시작');
        
        const scenes = {};
        Object.keys(scripts).forEach(part => {
            const text = scripts[part] || '';
            const charCount = text.length; // 💡 여기서 글자 수를 셉니다
            
            scenes[part] = {
                charCount: charCount, // 💡 [중요] 이 값이 있어야 에러가 안 납니다
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
    },
    
    // 로컬 이미지 수정 (img2img)
    async editImageLocal(imageUrl, editPrompt, width = 1024, height = 1024, enableADetailer = true) {
        // 기존 코드와 동일 (생략 시 오류 나므로 포함)
         try {
            const base64Image = await this.imageUrlToBase64(imageUrl);
            const adetailerConfig = enableADetailer ? {
                ADetailer: { args: [{ ad_model: "face_yolov8n.pt", ad_prompt: "detailed face", ad_confidence: 0.3 }] }
            } : {};

            const response = await fetch(`${this.SDWEBUI_URL}/sdapi/v1/img2img`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    init_images: [base64Image], prompt: editPrompt, width, height, steps: 30,
                    cfg_scale: 7.5, denoising_strength: 0.5, sampler_name: 'DPM++ 2M Karras',
                    alwayson_scripts: adetailerConfig
                })
            });

            if (!response.ok) throw new Error(`SD WebUI img2img 오류: ${response.status}`);
            const data = await response.json();
            return `data:image/png;base64,${data.images[0]}`;
        } catch (error) {
            console.error('❌ 로컬 img2img 오류:', error);
            throw error;
        }
    },

    async imageUrlToBase64(url) {
        if (url.startsWith('data:image')) return url.split(',')[1];
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
        });
    }
};

// 전역 함수로 노출
window.API = API;
