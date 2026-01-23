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

        // UI 라디오 버튼에서 현재 스타일/민족 읽기 및 바인딩
        this._bindStyleAndEthnicity();

        this.render();

        console.log('[CharacterManager] 초기화 완료 v2.4');
    }

    /**
     * 스타일/민족 라디오 버튼 바인딩 (UI → state 동기화)
     */
    _bindStyleAndEthnicity() {
        // 현재 선택값 읽기
        const styleRadio = document.querySelector('input[name="style"]:checked');
        const ethnicityRadio = document.querySelector('input[name="ethnicity"]:checked');
        this.state.currentStyle = styleRadio?.value || 'korean-webtoon';
        this.state.currentEthnicity = ethnicityRadio?.value || 'korean';

        // 변경 이벤트 바인딩
        document.querySelectorAll('input[name="style"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.state.currentStyle = e.target.value;
                console.log('[CharacterManager] 스타일 변경:', this.state.currentStyle);
            });
        });
        document.querySelectorAll('input[name="ethnicity"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.state.currentEthnicity = e.target.value;
                console.log('[CharacterManager] 민족 변경:', this.state.currentEthnicity);
            });
        });
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

    /**
     * 스타일 키워드 → 프롬프트 프리픽스 매핑
     */
    _getStylePrefix(styleKey) {
        const styleMap = {
            'korean-webtoon': 'A digital illustration in Korean webtoon manhwa style with clean sharp outlines and vibrant colors, non-photorealistic, expressive characters with detailed features',
            'folklore-illustration': 'A Korean folklore storybook illustration with warm pastel tones and soft edges, non-photorealistic, hand-drawn texture with whimsical emotional atmosphere',
            'traditional-ink': 'A Korean traditional ink wash painting in sumi-e style on Hanji paper, non-photorealistic, artistic brush strokes with ethereal atmosphere',
            'simple-2d-cartoon': 'A simple 2D cartoon illustration in Korean manhwa style with flat colors and thick outlines, non-photorealistic, clean vector art with minimal shading',
            'lyrical-anime': 'Makoto Shinkai style anime still, non-photorealistic, beautiful lighting, lens flare, sentimental atmosphere, vibrant colors, masterpiece',
            'action-anime': 'Ufotable anime style, non-photorealistic, high contrast, dynamic angle, bold lines, intense atmosphere, cel shading, masterpiece',
            'documentary-photo': 'A documentary photography, candid shot with natural lighting, realistic skin texture, cinematic lighting with shallow depth of field, shot on 35mm film',
            'cinematic-movie': 'A cinematic movie scene with blockbuster production quality, dramatic lighting with professional color grading, shallow depth of field, photorealistic',
            'scifi-fantasy': 'A sci-fi cyberpunk or high fantasy scene with futuristic elements, neon lights and advanced technology, cinematic lighting, digital art'
        };
        return styleMap[styleKey] || styleMap['korean-webtoon'];
    }

    /**
     * 민족 키워드 → 프롬프트 텍스트
     */
    _getEthnicityPrefix(ethnicityKey) {
        const ethnicityMap = {
            'korean': 'Korean person',
            'japanese': 'Japanese person',
            'western': 'Western person',
            'black': 'Black person'
        };
        return ethnicityMap[ethnicityKey] || 'Korean person';
    }

    _buildPromptWithFaceSpec(character, options = {}) {
        const faceSpec = character.faceSpec || this._generateFaceFeatures(character.id);
        const fixedFeatures = `${faceSpec.eyes}, ${faceSpec.face}, ${faceSpec.nose}, ${faceSpec.brows}`;

        // 현재 선택된 스타일/민족 가져오기
        const styleKey = this.state.currentStyle || this.projectStyle || character.style || 'korean-webtoon';
        const ethnicityKey = this.state.currentEthnicity || character.ethnicity || 'korean';

        // 스타일 프리픽스 (프롬프트 맨 앞에 위치 → 영향력 최대화)
        const stylePrefix = this._getStylePrefix(styleKey);
        const ethnicityText = this._getEthnicityPrefix(ethnicityKey);

        const era = character.era || '';
        const emotion = options.emotion || character.defaultEmotion || 'neutral expression';
        const pose = options.pose || 'front facing portrait';
        const lighting = options.lighting || 'soft lighting';

        const baseDescription = character.description || character.name;

        const promptParts = [
            stylePrefix,                           // 1. 스타일 강제 (맨 앞)
            `${ethnicityText}, ${baseDescription}`, // 2. 민족 + 캐릭터 설명
            fixedFeatures,                         // 3. 얼굴 특성
            emotion,                               // 4. 감정
            pose,                                  // 5. 포즈
            lighting,                              // 6. 조명
            era                                    // 7. 시대
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

    /**
     * 캐릭터 이미지 상세 모달 열기
     */
    openCharacterDetail(characterId) {
        const character = this.state.characters.find(c => c.id === characterId);
        if (!character || !character.imageUrl) return;

        const index = this.state.characters.findIndex(c => c.id === characterId);
        const modal = document.getElementById('image-detail-modal');
        if (!modal) return;

        // 모달 데이터 속성 설정 (App.handleModalDownload/Regenerate/EditApply에서 사용)
        modal.dataset.type = 'character';
        modal.dataset.index = index;
        modal.dataset.id = characterId;

        // 이미지 설정
        const modalImage = document.getElementById('modal-image');
        if (modalImage) modalImage.src = character.imageUrl;

        // 타이틀
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.textContent = `캐릭터: ${character.name || '이름 없음'}`;

        // 프롬프트
        const promptKo = document.getElementById('modal-prompt-ko');
        const promptEn = document.getElementById('modal-prompt-en');
        if (promptKo) promptKo.value = character.description || '';
        if (promptEn) promptEn.value = character.promptEn || this._buildPromptWithFaceSpec(character) || '';

        // 수정 요청 초기화
        const editRequest = document.getElementById('modal-edit-request');
        if (editRequest) editRequest.value = '';

        // 히스토리 렌더링
        const historyContainer = document.getElementById('modal-history');
        if (historyContainer) {
            const history = character.history || [];
            if (history.length > 0) {
                historyContainer.innerHTML = history.map((item, i) => `
                    <div class="history-item" style="cursor:pointer; padding:8px; border-radius:4px; margin-bottom:4px; background:var(--bg-secondary,#f3f4f6);"
                         onclick="window.CharacterManager._applyHistoryItem('${characterId}', ${i})">
                        <span class="history-version">v${item.version || i + 1}</span>
                        <span class="history-date">${new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                `).join('');
            } else {
                historyContainer.innerHTML = '<div class="history-item"><span class="history-version">v1</span><span class="history-date">현재</span></div>';
            }
        }

        // 대본 구간 숨기기 (캐릭터에는 해당 없음)
        const scriptSection = document.getElementById('modal-script-section');
        if (scriptSection) scriptSection.style.display = 'none';

        // 모달 열기
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * 히스토리 항목 적용 (모달에서 클릭 시)
     */
    _applyHistoryItem(characterId, historyIndex) {
        const character = this.state.characters.find(c => c.id === characterId);
        if (!character || !character.history || !character.history[historyIndex]) return;

        const historyItem = character.history[historyIndex];
        if (historyItem.imageUrl) {
            character.imageUrl = historyItem.imageUrl;
            character.imageBase64 = historyItem.imageUrl.startsWith('data:image/')
                ? historyItem.imageUrl.replace(/^data:image\/\w+;base64,/, '')
                : character.imageBase64;

            // IndexedDB 업데이트
            if (window.ImageStore && character.imageBase64) {
                window.ImageStore.saveImage(character.id, character.imageBase64, character.imageUrl)
                    .catch(err => console.warn('[CharacterManager] 히스토리 이미지 IndexedDB 저장 실패:', err));
            }

            // 모달 이미지 업데이트
            const modalImage = document.getElementById('modal-image');
            if (modalImage) modalImage.src = character.imageUrl;

            this.render();

            if (window.UI?.showToast) {
                window.UI.showToast(`v${historyItem.version || historyIndex + 1} 이미지로 복원됨`, 'success');
            }
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

                // IndexedDB에 이미지 저장 (localStorage 용량 절약)
                if (window.ImageStore && imageBase64) {
                    window.ImageStore.saveImage(characterId, imageBase64, result.imageUrl)
                        .catch(err => console.warn('[CharacterManager] IndexedDB 이미지 저장 실패:', err));
                }

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
            imageContent = `<img src="${character.imageUrl}" alt="${character.name}" class="character-image" onclick="event.stopPropagation(); window.CharacterManager.openCharacterDetail('${character.id}')" style="cursor:pointer;" title="클릭하여 상세 보기">`;
        } else if (character.hasImage && !character.imageUrl && character.imageStatus === 'completed') {
            // IndexedDB에서 이미지 복원 중
            imageContent = `
                <div class="character-placeholder">
                    <span>🔄</span>
                    <small style="font-size: 12px; margin-top: 8px;">불러오는 중...</small>
                </div>
            `;
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
                    <button class="btn btn-primary" onclick="event.stopPropagation(); window.CharacterManager.generateCharacterImage('${character.id}')">
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
        // imageBase64와 data: URL을 제외하여 localStorage 용량 초과 방지
        const strippedCharacters = this.state.characters.map(char => {
            const { imageBase64, imageUrl, ...rest } = char;
            return {
                ...rest,
                // 이미지 존재 여부만 플래그로 저장 (실제 데이터는 IndexedDB)
                hasImage: !!(imageBase64 || (imageUrl && imageUrl.startsWith('data:'))),
                imageUrl: null,
                imageBase64: null
            };
        });

        return {
            characters: strippedCharacters,
            selectedCharacter: this.state.selectedCharacter
        };
    }

    /**
     * IndexedDB에서 캐릭터 이미지 복원 (loadState 후 호출)
     * 기존 localStorage 데이터 마이그레이션도 처리
     */
    async restoreImagesFromStore() {
        if (!window.ImageStore) return;

        // 1) 마이그레이션: 메모리에 imageBase64가 있지만 IndexedDB에 없는 경우 저장
        const charsWithImages = this.state.characters.filter(c => c.imageBase64);
        if (charsWithImages.length > 0) {
            const items = charsWithImages.map(c => ({
                id: c.id,
                imageBase64: c.imageBase64,
                imageUrl: c.imageUrl
            }));
            await window.ImageStore.saveMany(items);
            console.log('[CharacterManager] 기존 이미지 IndexedDB 마이그레이션:', items.length, '건');
        }

        // 2) 복원: hasImage 플래그가 있지만 메모리에 이미지가 없는 경우
        const needRestore = this.state.characters.filter(c => c.hasImage && !c.imageBase64);
        if (needRestore.length === 0) return;

        console.log('[CharacterManager] IndexedDB에서 이미지 복원 시작:', needRestore.length, '건');

        const ids = needRestore.map(c => c.id);
        const imageMap = await window.ImageStore.getMany(ids);

        let restored = 0;
        for (const char of this.state.characters) {
            const imageData = imageMap.get(char.id);
            if (imageData) {
                char.imageBase64 = imageData.imageBase64;
                char.imageUrl = imageData.imageUrl;
                restored++;
            }
        }

        if (restored > 0) {
            console.log('[CharacterManager] 이미지 복원 완료:', restored, '건');
            this.render();
        }
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

        // IndexedDB에서 이미지 비동기 복원
        this.restoreImagesFromStore();
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
