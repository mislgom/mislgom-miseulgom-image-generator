// scripts/characterManager.js v2.4
// v2.4: projectId 기반 seed 생성 (프로젝트별 캐릭터 외형 분리)
// 3회 재시도 실패 UX + seed 고정 + 기존 CSS 사용 (스타일 주입 제거)

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
        this.projectStyle = null;
        this.projectId = null; // 프로젝트별 캐릭터 외형 분리용
        this._isInitialRenderDone = false;
        
        // 얼굴 특징 배열 (seed 기반 조합용)
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

    init(container, options = {}) {
        this.container = container;
        this.onCharacterSelect = options.onCharacterSelect || null;
        this.onCharacterUpdate = options.onCharacterUpdate || null;
        this.projectStyle = options.projectStyle || null;
        
        // ✅ v2.3: CSS 주입 제거 (기존 main.css 사용)
        this.render();
        
        console.log('[CharacterManager] 초기화 완료 v2.3');
    }

    setProjectStyle(style) {
        this.projectStyle = style;
        console.log('[CharacterManager] 프로젝트 스타일 설정:', style);
    }

    setProjectId(projectId) {
        this.projectId = projectId;
        console.log('[CharacterManager] projectId 설정:', projectId);
    }

    _generateStableId(character, index) {
        const name = (character.name || character.nameEn || 'unknown').trim().toLowerCase();
        const role = (character.role || 'default').trim().toLowerCase();
        const baseString = `${name}_${role}_${index}`;
        return this._hashString(baseString);
    }

    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'char_' + Math.abs(hash).toString(36);
    }

    _generateSeedFromId(projectId, characterId) {
        if (!characterId) return Math.floor(Math.random() * 2147483647);

        // projectId + characterId를 결합하여 프로젝트별 고유 seed 생성
        const combined = (projectId || '') + ':' + characterId;

        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash) % 2147483647;
    }

    _generateFaceFeatures(characterId) {
        const seed = this._generateSeedFromId(this.projectId, characterId);
        
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

    _buildPromptWithFaceSpec(character, options = {}) {
        const faceSpec = character.faceSpec || this._generateFaceFeatures(character.id);
        const fixedFeatures = `${faceSpec.eyes}, ${faceSpec.face}, ${faceSpec.nose}, ${faceSpec.brows}`;
        
        const style = this.projectStyle || character.style || '';
        const era = character.era || '';
        
        const emotion = options.emotion || character.defaultEmotion || 'neutral expression';
        const pose = options.pose || 'front facing portrait';
        const lighting = options.lighting || 'soft lighting';
        
        const baseDescription = character.description || character.name;
        
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

    setCharacters(characters) {
        this.state.characters = characters.map((char, index) => {
            const stableId = char.id || this._generateStableId(char, index);
            
            return {
                ...char,
                id: stableId,
                imageUrl: char.imageUrl || null,
                imageStatus: char.imageStatus ?? 'pending',
                lastError: null,
                seed: char.seed || this._generateSeedFromId(this.projectId, stableId),
                faceSpec: char.faceSpec || null
            };
        });
        
        this.render();
        console.log('[CharacterManager] 캐릭터 설정:', this.state.characters.length, '명');
    }

    getCharacters() {
        return this.state.characters;
    }

    selectCharacter(characterId) {
        const prevSelected = this.state.selectedCharacter;
        this.state.selectedCharacter = characterId;
        
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

    async generateCharacterImage(characterId, options = {}) {
        const character = this.state.characters.find(c => c.id === characterId);

  
        if (!character) {
            console.error('[CharacterManager] 캐릭터를 찾을 수 없음:', characterId);
            return null;
        }
        
        if (character.imageStatus === 'generating') {
            console.log('[CharacterManager] 이미 생성 중:', character.name);
            return null;
        }
        
        this._updateCharacterData(characterId, {
            imageStatus: 'generating',
            lastError: null
        });
        
        try {
            const seed = character.seed;
            const prompt = this._buildPromptWithFaceSpec(character, options);
            
            console.log('[CharacterManager] 이미지 생성 시작:', character.name);
            console.log('[CharacterManager] Prompt:', prompt);
            console.log('[CharacterManager] Seed:', seed);
            
            const result = await window.API.generateImage({
                prompt: prompt,
                aspectRatio: options.aspectRatio || '1:1',
                seed: seed,
                referenceImages: options.referenceImages || null
            });
            
            if (result && result.imageUrl) {
                const imageBase64 = result.imageUrl.startsWith('data:image/')
                    ? result.imageUrl.replace(/^data:image\/\w+;base64,/, '')
                    : null;

                this._updateCharacterData(characterId, {
                    imageUrl: result.imageUrl,
                    imageBase64: imageBase64,
                    imageStatus: 'completed',
                    lastError: null
                });
                
                console.log('[CharacterManager] 이미지 생성 완료:', character.name);
                
                if (this.onCharacterUpdate) {
                    const updatedCharacter = this.state.characters.find(c => c.id === characterId);
                    if (updatedCharacter) {
                        this.onCharacterUpdate(updatedCharacter);
                    }
                }
                
                return result.imageUrl;
            } else {
                throw new Error(result?.error || '이미지 생성 실패');
            }
            
        } catch (error) {
            console.error('[CharacterManager] 이미지 생성 오류:', error);
            
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

    async retryCharacterImage(characterId) {
        await this.generateCharacterImage(characterId);
    }

    _updateCharacterData(characterId, updates) {
        const index = this.state.characters.findIndex(c => c.id === characterId);
        if (index !== -1) {
            this.state.characters[index] = {
                ...this.state.characters[index],
                ...updates
            };
            this._updateCardElement(characterId);
        }
    }

    _updateCardElement(characterId) {
        if (!this._isInitialRenderDone) return;
        
        const cardElement = this.container?.querySelector(`[data-character-id="${characterId}"]`);
        if (!cardElement) return;
        
        const character = this.state.characters.find(c => c.id === characterId);
        if (!character) return;
        
        const index = this.state.characters.findIndex(c => c.id === characterId);
        const newCardHtml = this._renderCharacterCard(character, index);
        
        const temp = document.createElement('div');
        temp.innerHTML = newCardHtml;
        const newCard = temp.firstElementChild;
        
        cardElement.replaceWith(newCard);
    }

    async generateAllImages(options = {}) {
        const pendingCharacters = this.state.characters.filter(
            c => c.imageStatus === 'pending' || c.imageStatus === 'failed'
        );
        
        if (pendingCharacters.length === 0) {
            console.log('[CharacterManager] 생성할 이미지가 없습니다.');
            if (window.UI?.showToast) {
                window.UI.showToast('생성할 이미지가 없습니다', 'info');
            }
            return;
        }
        
        console.log('[CharacterManager] 일괄 생성 시작:', pendingCharacters.length, '개');
        if (window.UI?.showToast) {
            window.UI.showToast(`${pendingCharacters.length}개 캐릭터 이미지 생성 시작`, 'info');
        }
        
        for (const character of pendingCharacters) {
            await this.generateCharacterImage(character.id, options);
        }
        
        console.log('[CharacterManager] 일괄 생성 완료');
        if (window.UI?.showToast) {
            window.UI.showToast('캐릭터 이미지 생성 완료!', 'success');
        }
    }

    /**
     * 캐릭터 카드 HTML 생성 (기존 main.css 클래스 사용)
     */
    _renderCharacterCard(character, index) {
        const isSelected = this.state.selectedCharacter === character.id;
        const isGenerating = character.imageStatus === 'generating';
        const isFailed = character.imageStatus === 'failed';
        
        // ✅ 기존 main.css 클래스 사용
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
                <div class="character-placeholder">
                    <span>⏳</span>
                    <small style="font-size: 12px; margin-top: 8px;">생성 중...</small>
                </div>
            `;
        } else if (isFailed) {
            imageContent = `
                <div class="character-placeholder" style="color: var(--error-color);">
                    <span>❌</span>
                    <small style="font-size: 12px; margin-top: 8px;">생성 실패</small>
                </div>
            `;
        } else {
            imageContent = `
                <div class="character-placeholder">
                    <span>👤</span>
                </div>
            `;
        }
        
        // 에러 메시지 (실패 시)
        let errorSection = '';
        if (isFailed && character.lastError) {
            errorSection = `
                <div style="font-size: 11px; color: var(--error-color); margin-top: 8px; padding: 8px; background: rgba(239, 68, 68, 0.1); border-radius: 4px; text-align: center;">
                    ${character.lastError}
                </div>
            `;
        }
        
        // 버튼 영역 (기존 main.css 클래스 사용)
        let actionsHtml = '';
        if (isFailed) {
            actionsHtml = `
                <div class="character-actions">
                    <button class="btn btn-small btn-secondary" style="background: var(--warning-color); color: white;" onclick="event.stopPropagation(); window.CharacterManager.retryCharacterImage('${character.id}')">
                        🔄 재시도
                    </button>
                </div>
            `;
        } else if (!isGenerating && character.imageStatus !== 'completed') {
            actionsHtml = `
                <div class="character-actions">
                    <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); window.CharacterManager.generateCharacterImage('${character.id}')">
                        ✨ 이미지 생성
                    </button>
                </div>
            `;
        } else if (character.imageStatus === 'completed') {
            actionsHtml = `
                <div class="character-actions">
                    <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); window.CharacterManager.generateCharacterImage('${character.id}')">
                        🔄 재생성
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="${cardClass}" data-character-id="${character.id}" onclick="window.CharacterManager.selectCharacter('${character.id}')">
                <div class="character-image-wrapper">
                    ${imageContent}
                </div>
                <div class="character-info">
                    <div class="character-name">${character.name || '이름 없음'}</div>
                    <div class="character-role">${character.role || ''}</div>
                </div>
                ${errorSection}
                ${actionsHtml}
            </div>
        `;
    }

    /**
     * 전체 렌더링 (기존 main.css의 .character-grid 사용)
     */
    render() {
        if (!this.container) return;
        
        if (this.state.characters.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">👥</div>
                    <h3>등장인물이 없습니다</h3>
                    <p>대본을 분석하여 등장인물을 자동으로 추출하세요</p>
                </div>
            `;
            this._isInitialRenderDone = true;
            return;
        }
        
        const cardsHtml = this.state.characters
            .map((char, index) => this._renderCharacterCard(char, index))
            .join('');
        
     // ✅ 기존 main.css의 .character-grid 사용 (가로 그리드)
        this.container.innerHTML = cardsHtml;
        this.container.classList.add('character-grid');
        
        this._isInitialRenderDone = true;
    }

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

    saveState() {
        return {
            characters: this.state.characters,
            selectedCharacter: this.state.selectedCharacter
        };
    }

    loadState(state) {
        if (!state) return;

        // 선택/생성 상태는 그대로 복원
        this.state.selectedCharacter = state.selectedCharacter || null;
        this.state.isGenerating = false;

        // ✅ 반드시 setCharacters()를 경유해 id/imageStatus/seed 등 정규화
        const chars = Array.isArray(state.characters) ? state.characters : [];
        this.setCharacters(chars);

        // setCharacters() 내부에서 render()가 호출되지만, 선택 반영/DOM 동기화 안전을 위해 한 번 더
        this.render();
        console.log('[CharacterManager] 상태 복원됨(정규화):', this.state.characters.length, '명');
    }

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
        
        if (this._isInitialRenderDone) {
            this.render();
        }
    }
}

// 전역 인스턴스 생성
window.CharacterManager = new CharacterManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterManager;
}
