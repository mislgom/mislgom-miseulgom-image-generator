// scripts/characterManager.js v2.2
// 3회 재시도 실패 UX + seed 고정 + 부분 업데이트 최적화 + 권장 개선 반영

class CharacterManager {
    constructor() {
        this.state = {
            characters: [],
            selectedCharacter: null,
            isGenerating: false
        };
        
        this.container = null;
        this.onCharacterSelect = null;
        this.onCharacterUpdate = null;
        
        // 프로젝트 스타일 (외부에서 주입)
        this.projectStyle = null;
        
        // 초기 렌더링 완료 플래그 (권장 개선 A)
        this._isInitialRenderDone = false;
        
        // 얼굴 특징 개별 배열 (조합용)
        this.eyesOptions = [
            'sharp narrow eyes', 'gentle round eyes', 'deep-set eyes', 'almond-shaped eyes',
            'wide-set eyes', 'hooded eyes', 'monolid eyes', 'downturned eyes',
            'upturned eyes', 'close-set eyes', 'large expressive eyes', 'small intense eyes'
        ];
        this.faceOptions = [
            'angular jawline', 'oval face', 'square jaw', 'heart-shaped face',
            'round face', 'long face', 'diamond face', 'triangular face',
            'rectangular face', 'oblong face', 'soft jawline', 'prominent cheekbones'
        ];
        this.noseOptions = [
            'straight nose', 'small nose', 'prominent nose', 'button nose',
            'aquiline nose', 'upturned nose', 'flat nose', 'roman nose',
            'narrow nose', 'wide nose', 'hooked nose', 'snub nose'
        ];
        this.browsOptions = [
            'thick eyebrows', 'thin arched eyebrows', 'bushy eyebrows', 'curved eyebrows',
            'straight eyebrows', 'feathered eyebrows', 'bold eyebrows', 'soft eyebrows',
            'angular eyebrows', 'rounded eyebrows', 'sparse eyebrows', 'defined eyebrows'
        ];
    }

    /**
     * CharacterManager 초기화
     */
    init(container, options = {}) {
        this.container = container;
        this.onCharacterSelect = options.onCharacterSelect || null;
        this.onCharacterUpdate = options.onCharacterUpdate || null;
        this.projectStyle = options.projectStyle || null;
        
        this._injectStyles();
        this.render();
        
        console.log('[CharacterManager] 초기화 완료 v2.2');
    }

    /**
     * 프로젝트 스타일 설정
     */
    setProjectStyle(style) {
        this.projectStyle = style;
        console.log('[CharacterManager] 프로젝트 스타일 설정:', style);
    }

    /**
     * 스타일 주입
     */
    _injectStyles() {
        if (document.getElementById('character-manager-styles-v2')) return;
        
        const styles = document.createElement('style');
        styles.id = 'character-manager-styles-v2';
        styles.textContent = `
            .character-card {
                position: relative;
                border: 2px solid #e0e0e0;
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 12px;
                background: #fff;
                transition: all 0.2s ease;
                cursor: pointer;
            }
            .character-card:hover {
                border-color: #667eea;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
            }
            .character-card.selected {
                border-color: #667eea;
                background: linear-gradient(135deg, #f5f7ff 0%, #fff 100%);
            }
            .character-card.generating {
                opacity: 0.7;
                pointer-events: none;
            }
            .character-card.failed {
                border-color: #e74c3c;
                background: #fdf2f2;
            }
            .character-image-container {
                width: 100%;
                aspect-ratio: 1;
                border-radius: 8px;
                overflow: hidden;
                background: #f5f5f5;
                margin-bottom: 12px;
                position: relative;
            }
            .character-image {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .character-image-placeholder {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #999;
                font-size: 14px;
                text-align: center;
                padding: 16px;
            }
            .character-image-placeholder.loading {
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite;
            }
            .character-image-placeholder.error {
                background: #fef2f2;
                color: #dc2626;
            }
            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            .character-info { text-align: center; }
            .character-name {
                font-weight: 600;
                font-size: 16px;
                color: #333;
                margin-bottom: 4px;
            }
            .character-role {
                font-size: 12px;
                color: #666;
                margin-bottom: 8px;
            }
            .character-description {
                font-size: 11px;
                color: #888;
                line-height: 1.4;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .character-actions {
                display: flex;
                gap: 8px;
                margin-top: 12px;
            }
            .character-btn {
                flex: 1;
                padding: 8px 12px;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .character-btn-primary {
                background: #667eea;
                color: white;
            }
            .character-btn-primary:hover { background: #5a6fd6; }
            .character-btn-secondary {
                background: #f0f0f0;
                color: #333;
            }
            .character-btn-secondary:hover { background: #e0e0e0; }
            .character-btn-retry {
                background: #f59e0b;
                color: white;
            }
            .character-btn-retry:hover { background: #d97706; }
            .generation-progress {
                height: 3px;
                background: #e0e0e0;
                border-radius: 2px;
                margin-top: 8px;
                overflow: hidden;
            }
            .generation-progress-bar {
                height: 100%;
                background: #667eea;
                border-radius: 2px;
                animation: progress 2s ease-in-out infinite;
            }
            @keyframes progress {
                0% { width: 0%; }
                50% { width: 70%; }
                100% { width: 100%; }
            }
            .error-message {
                font-size: 11px;
                color: #dc2626;
                margin-top: 8px;
                padding: 8px;
                background: #fef2f2;
                border-radius: 4px;
                text-align: center;
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * 안정적인 캐릭터 ID 생성 (권장 개선 C: name + role + index만 사용)
     */
    _generateStableId(character, index) {
        const name = (character.name || character.nameEn || 'unknown').trim().toLowerCase();
        const role = (character.role || 'default').trim().toLowerCase();
        
        // name + role + index만 사용 (변동성 있는 description/firstDialogue 제외)
        const baseString = `${name}_${role}_${index}`;
        return this._hashString(baseString);
    }

    /**
     * 문자열 해시 함수
     */
    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'char_' + Math.abs(hash).toString(36);
    }

    /**
     * characterId 기반 seed 생성
     */
    _generateSeedFromId(characterId) {
        if (!characterId) return Math.floor(Math.random() * 2147483647);
        
        let hash = 0;
        for (let i = 0; i < characterId.length; i++) {
            const char = characterId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash) % 2147483647;
    }

    /**
     * 캐릭터별 고유 얼굴 특징 조합 생성
     */
    _generateFaceFeatures(characterId) {
        const seed = this._generateSeedFromId(characterId);
        
        // 각 특징을 다른 인덱스로 조합
        const eyesIndex = seed % this.eyesOptions.length;
        const faceIndex = Math.floor(seed / 7) % this.faceOptions.length;
        const noseIndex = Math.floor(seed / 13) % this.noseOptions.length;
        const browsIndex = Math.floor(seed / 19) % this.browsOptions.length;
        
        return {
            eyes: this.eyesOptions[eyesIndex],
            face: this.faceOptions[faceIndex],
            nose: this.noseOptions[noseIndex],
            brows: this.browsOptions[browsIndex]
        };
    }

    /**
     * 얼굴 스펙 포함 프롬프트 생성
     */
    _buildPromptWithFaceSpec(character, options = {}) {
        // Gemini가 생성한 얼굴 스펙이 있으면 사용, 없으면 자동 생성
        const faceSpec = character.faceSpec || this._generateFaceFeatures(character.id);
        
        // 고정 요소: 얼굴 특징
        const fixedFeatures = `${faceSpec.eyes}, ${faceSpec.face}, ${faceSpec.nose}, ${faceSpec.brows}`;
        
        // 공통 요소: 프로젝트 스타일 (외부 주입 또는 neutral)
        const style = this.projectStyle || character.style || '';
        const era = character.era || '';
        
        // 가변 요소: 감정/포즈/조명
        const emotion = options.emotion || character.defaultEmotion || 'neutral expression';
        const pose = options.pose || 'front facing portrait';
        const lighting = options.lighting || 'soft lighting';
        
        // 기본 설명
        const baseDescription = character.description || character.name;
        
        // 프롬프트 조합 (빈 값 제외)
        const promptParts = [
            baseDescription,
            fixedFeatures,
            emotion,
            pose,
            lighting,
            era,
            style
        ].filter(part => part && part.trim());
        
        return promptParts.join(', ');
    }

    /**
     * 캐릭터 목록 설정
     */
    setCharacters(characters) {
        this.state.characters = characters.map((char, index) => {
            // 안정적인 ID 생성 (기존 ID가 있으면 유지)
            const stableId = char.id || this._generateStableId(char, index);
            
            return {
                ...char,
                id: stableId,
                imageUrl: char.imageUrl || null,
                imageStatus: char.imageStatus || 'pending',
                lastError: null,
                seed: char.seed || this._generateSeedFromId(stableId),
                faceSpec: char.faceSpec || null
            };
        });
        
        this.render();
        console.log('[CharacterManager] 캐릭터 설정:', this.state.characters.length, '명');
    }

    /**
     * 캐릭터 목록 반환
     */
    getCharacters() {
        return this.state.characters;
    }

    /**
     * 캐릭터 선택
     */
    selectCharacter(characterId) {
        const prevSelected = this.state.selectedCharacter;
        this.state.selectedCharacter = characterId;
        
        // 부분 업데이트: 이전 선택과 새 선택만 업데이트
        if (prevSelected && this._isInitialRenderDone) {
            this._updateCardElement(prevSelected);
        }
        if (this._isInitialRenderDone) {
            this._updateCardElement(characterId);
        }
        
        const character = this.state.characters.find(c => c.id === characterId);
        if (character && this.onCharacterSelect) {
            this.onCharacterSelect(character);
        }
    }

    /**
     * 캐릭터 이미지 생성 (재시도는 API에서 처리, 여기서는 1회 호출만)
     */
    async generateCharacterImage(characterId, options = {}) {
        const character = this.state.characters.find(c => c.id === characterId);
        if (!character) {
            console.error('[CharacterManager] 캐릭터를 찾을 수 없음:', characterId);
            return null;
        }
        
        // 이미 생성 중이면 무시
        if (character.imageStatus === 'generating') {
            console.log('[CharacterManager] 이미 생성 중:', character.name);
            return null;
        }
        
        // 상태 업데이트: 생성 중 (부분 업데이트)
        this._updateCharacterData(characterId, {
            imageStatus: 'generating',
            lastError: null
        });
        
        try {
            // seed 고정 (characterId 기반)
            const seed = character.seed;
            
            // 얼굴 스펙 포함 프롬프트 생성
            const prompt = this._buildPromptWithFaceSpec(character, options);
            
            console.log('[CharacterManager] 이미지 생성 시작:', character.name);
            console.log('[CharacterManager] Prompt:', prompt);
            console.log('[CharacterManager] Seed:', seed);
            
            // 체크포인트 1: window.API.generateImage() 호출로 통일
            // API 내부에서 3회 재시도 수행, 여기서는 1회 호출만
            const result = await window.API.generateImage({
                prompt: prompt,
                aspectRatio: options.aspectRatio || '1:1',
                seed: seed,
                referenceImages: options.referenceImages || null
            });
            
            // generateImage()는 { imageUrl } 또는 에러를 반환
            if (result && result.imageUrl) {
                // 성공: 이미지 URL 업데이트 (부분 업데이트)
                this._updateCharacterData(characterId, {
                    imageUrl: result.imageUrl,
                    imageStatus: 'completed',
                    lastError: null
                });
                
                console.log('[CharacterManager] 이미지 생성 완료:', character.name);
                
                // 권장 개선 B: find()로 최신 객체 조회하여 전달
                if (this.onCharacterUpdate) {
                    const updatedCharacter = this.state.characters.find(c => c.id === characterId);
                    if (updatedCharacter) {
                        this.onCharacterUpdate(updatedCharacter);
                    }
                }
                
                return result.imageUrl;
            } else {
                // 실패 응답
                throw new Error(result?.error || '이미지 생성 실패');
            }
            
        } catch (error) {
            console.error('[CharacterManager] 이미지 생성 오류:', error);
            
            // 체크포인트 2: 실패 시 즉시 failed 상태로 전환
            // API에서 이미 3회 재시도 완료 후 실패한 것이므로 바로 failed
            let shortError = error.message || '알 수 없는 오류';
            if (shortError.length > 50) {
                shortError = shortError.substring(0, 47) + '...';
            }
            
            this._updateCharacterData(characterId, {
                imageStatus: 'failed',
                lastError: shortError
            });
            
            return null;
        }
    }

    /**
     * 캐릭터 이미지 재시도 (사용자 버튼 클릭 시 1회만 호출)
     */
    async retryCharacterImage(characterId) {
        // 체크포인트 2: 버튼 클릭 시 generateCharacterImage 1회만 호출
        // API 내부에서 3회 재시도 수행
        await this.generateCharacterImage(characterId);
    }

    /**
     * 캐릭터 데이터 업데이트 (상태만, 렌더링은 별도)
     */
    _updateCharacterData(characterId, updates) {
        const index = this.state.characters.findIndex(c => c.id === characterId);
        if (index !== -1) {
            this.state.characters[index] = {
                ...this.state.characters[index],
                ...updates
            };
            // 체크포인트 4: 부분 업데이트
            this._updateCardElement(characterId);
        }
    }

    /**
     * 체크포인트 4 + 권장 개선 A: 개별 카드 DOM 업데이트 (부분 렌더링)
     */
    _updateCardElement(characterId) {
        // 권장 개선 A: 초기 렌더링 전이면 조용히 return
        if (!this._isInitialRenderDone) {
            return;
        }
        
        const cardElement = this.container?.querySelector(`[data-character-id="${characterId}"]`);
        if (!cardElement) {
            // 카드가 없으면 조용히 return (상위에서 render 호출 책임)
            console.warn('[CharacterManager] 카드 요소를 찾을 수 없음:', characterId);
            return;
        }
        
        const character = this.state.characters.find(c => c.id === characterId);
        if (!character) return;
        
        const index = this.state.characters.findIndex(c => c.id === characterId);
        const newCardHtml = this._renderCharacterCard(character, index);
        
        // 임시 컨테이너로 HTML 파싱
        const temp = document.createElement('div');
        temp.innerHTML = newCardHtml;
        const newCard = temp.firstElementChild;
        
        // 기존 카드 교체
        cardElement.replaceWith(newCard);
    }

    /**
     * 모든 캐릭터 이미지 일괄 생성
     */
    async generateAllImages(options = {}) {
        const pendingCharacters = this.state.characters.filter(
            c => c.imageStatus === 'pending' || c.imageStatus === 'failed'
        );
        
        if (pendingCharacters.length === 0) {
            console.log('[CharacterManager] 생성할 이미지가 없습니다.');
            return;
        }
        
        console.log('[CharacterManager] 일괄 생성 시작:', pendingCharacters.length, '개');
        
        // 순차 처리 (동시성은 api.js의 큐에서 관리)
        for (const character of pendingCharacters) {
            await this.generateCharacterImage(character.id, options);
        }
        
        console.log('[CharacterManager] 일괄 생성 완료');
    }

    /**
     * 캐릭터 카드 HTML 생성
     */
    _renderCharacterCard(character, index) {
        const isSelected = this.state.selectedCharacter === character.id;
        const isGenerating = character.imageStatus === 'generating';
        const isFailed = character.imageStatus === 'failed';
        
        let cardClass = 'character-card';
        if (isSelected) cardClass += ' selected';
        if (isGenerating) cardClass += ' generating';
        if (isFailed) cardClass += ' failed';
        
        // 이미지 영역
        let imageContent = '';
        if (character.imageUrl && character.imageStatus === 'completed') {
            imageContent = `<img src="${character.imageUrl}" alt="${character.name}" class="character-image">`;
        } else if (isGenerating) {
            imageContent = `
                <div class="character-image-placeholder loading">
                    <span>이미지 생성 중...</span>
                    <div class="generation-progress">
                        <div class="generation-progress-bar"></div>
                    </div>
                </div>
            `;
        } else if (isFailed) {
            imageContent = `
                <div class="character-image-placeholder error">
                    <span>생성 실패</span>
                </div>
            `;
        } else {
            imageContent = `
                <div class="character-image-placeholder">
                    <span>이미지 대기 중</span>
                </div>
            `;
        }
        
        // 에러 메시지 (실패 시)
        let errorSection = '';
        if (isFailed && character.lastError) {
            errorSection = `<div class="error-message">${character.lastError}</div>`;
        }
        
        // 버튼 영역
        let actionsHtml = '';
        if (isFailed) {
            // 체크포인트 2: 실패 시 재시도 버튼만 제공
            actionsHtml = `
                <div class="character-actions">
                    <button class="character-btn character-btn-retry" onclick="event.stopPropagation(); window.CharacterManager.retryCharacterImage('${character.id}')">
                        재시도
                    </button>
                </div>
            `;
        } else if (!isGenerating && character.imageStatus !== 'completed') {
            actionsHtml = `
                <div class="character-actions">
                    <button class="character-btn character-btn-primary" onclick="event.stopPropagation(); window.CharacterManager.generateCharacterImage('${character.id}')">
                        이미지 생성
                    </button>
                </div>
            `;
        } else if (character.imageStatus === 'completed') {
            actionsHtml = `
                <div class="character-actions">
                    <button class="character-btn character-btn-secondary" onclick="event.stopPropagation(); window.CharacterManager.generateCharacterImage('${character.id}')">
                        재생성
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="${cardClass}" data-character-id="${character.id}" onclick="window.CharacterManager.selectCharacter('${character.id}')">
                <div class="character-image-container">
                    ${imageContent}
                </div>
                <div class="character-info">
                    <div class="character-name">${character.name || '이름 없음'}</div>
                    <div class="character-role">${character.role || ''}</div>
                    <div class="character-description">${character.description || ''}</div>
                </div>
                ${errorSection}
                ${actionsHtml}
            </div>
        `;
    }

    /**
     * 전체 렌더링
     */
    render() {
        if (!this.container) return;
        
        if (this.state.characters.length === 0) {
            this.container.innerHTML = `
                <div class="character-empty" style="text-align: center; padding: 40px; color: #666;">
                    <p>등록된 캐릭터가 없습니다.</p>
                    <p style="font-size: 12px; color: #999;">대본을 분석하면 캐릭터가 자동으로 추출됩니다.</p>
                </div>
            `;
            this._isInitialRenderDone = true;
            return;
        }
        
        const cardsHtml = this.state.characters
            .map((char, index) => this._renderCharacterCard(char, index))
            .join('');
        
        this.container.innerHTML = `
            <div class="character-list">
                ${cardsHtml}
            </div>
            <div class="character-actions-global" style="margin-top: 16px;">
                <button class="character-btn character-btn-primary" style="width: 100%;" onclick="window.CharacterManager.generateAllImages()">
                    모든 캐릭터 이미지 생성
                </button>
            </div>
        `;
        
        // 권장 개선 A: 초기 렌더링 완료 플래그 설정
        this._isInitialRenderDone = true;
    }

    /**
     * 상태 초기화
     */
    reset() {
        this.state = {
            characters: [],
            selectedCharacter: null,
            isGenerating: false
        };
        this._isInitialRenderDone = false;
        this.render();
        console.log('[CharacterManager] 상태 초기화됨');
    }

    /**
     * Gemini 분석 결과에서 얼굴 스펙 설정
     */
    setFaceSpecsFromGemini(faceSpecs) {
        if (!Array.isArray(faceSpecs)) return;
        
        faceSpecs.forEach((spec, index) => {
            if (index < this.state.characters.length && spec) {
                const characterId = this.state.characters[index].id;
                const defaultFeatures = this._generateFaceFeatures(characterId);
                
                this.state.characters[index].faceSpec = {
                    eyes: spec.eyes || defaultFeatures.eyes,
                    face: spec.face || defaultFeatures.face,
                    nose: spec.nose || defaultFeatures.nose,
                    brows: spec.brows || defaultFeatures.brows
                };
            }
        });
        
        console.log('[CharacterManager] Gemini 얼굴 스펙 설정 완료');
        
        // 초기 렌더링 완료 후에만 전체 렌더링
        if (this._isInitialRenderDone) {
            this.render();
        }
    }
}

// 전역 인스턴스 생성
window.CharacterManager = new CharacterManager();

// 모듈 내보내기 (ES6 환경용)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterManager;
}
