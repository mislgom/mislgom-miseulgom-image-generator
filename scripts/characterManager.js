/**
 * 미슬곰 이미지 자동 생성기 v1.0 - 등장인물 관리 모듈
 * 등장인물 추출, 이미지 생성, 카드 UI
 */

const CharacterManager = {
    // 상태 관리
    state: {
        characters: [],
        currentEthnicity: 'korean',
        currentStyle: 'korean-webtoon',
        currentAspectRatio: '16:9'
    },

    // 초기화
    init() {
        console.log('👥 CharacterManager 초기화');
        this.attachEventListeners();
    },

    // 비율에 따른 해상도 계산
    getResolutionFromAspectRatio(aspectRatio) {
        const resolutions = {
            '1:1': { width: 1024, height: 1024 },
            '16:9': { width: 1344, height: 768 },
            '9:16': { width: 768, height: 1344 }
        };
        return resolutions[aspectRatio] || resolutions['1:1'];
    },

    // 이벤트 리스너 등록
    attachEventListeners() {
        // 등장인물 생성 버튼
        const generateBtn = document.getElementById('generate-characters-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateCharacters();
            });
        }

        // 전체 다운로드 버튼
        const downloadImagesBtn = document.getElementById('download-characters-images-btn');
        const downloadExcelBtn = document.getElementById('download-characters-excel-btn');
        
        if (downloadImagesBtn) {
            downloadImagesBtn.addEventListener('click', () => {
                this.downloadAllImages();
            });
        }

        if (downloadExcelBtn) {
            downloadExcelBtn.addEventListener('click', () => {
                this.downloadExcel();
            });
        }

        // 인종 선택
        const ethnicityRadios = document.querySelectorAll('input[name="ethnicity"]');
        ethnicityRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.state.currentEthnicity = e.target.value;
                console.log('👤 인종 변경:', this.state.currentEthnicity);
            });
        });

        // 스타일 선택
        const styleRadios = document.querySelectorAll('input[name="style"]');
        styleRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.state.currentStyle = e.target.value;
                console.log('🎨 스타일 변경:', this.state.currentStyle);
            });
        });

        // 비율 선택
        const aspectRatioSelect = document.getElementById('aspect-ratio');
        if (aspectRatioSelect) {
            aspectRatioSelect.addEventListener('change', (e) => {
                this.state.currentAspectRatio = e.target.value;
                console.log('📐 비율 변경:', this.state.currentAspectRatio);
            });
        }
    },

    // 등장인물 생성
    async generateCharacters() {
        try {
            if (!ScriptManager.isUploaded()) {
                UI.showToast('먼저 대본을 업로드하세요', 'error');
                return;
            }

            // 먼저 대본 분석 필요 확인
            if (this.state.characters.length === 0) {
                UI.showToast('먼저 대본을 분석하여 등장인물을 추출하세요', 'error');
                return;
            }

            UI.showToast('등장인물 이미지 생성 중...', 'info');
            UI.showProgress('등장인물 생성 중', 0, this.state.characters.length);

            // 각 등장인물 이미지 생성
            for (let i = 0; i < this.state.characters.length; i++) {
                const character = this.state.characters[i];

                // ✅ 현재 선택된 스타일과 인종을 캐릭터에 적용
                character.ethnicity = this.state.currentEthnicity;
                character.style = this.state.currentStyle;

                try {
                    // 프롬프트 생성
                    const prompt = await this.createCharacterPrompt(character);

                    // ✅ 디버깅: 스타일이 prompt.en에 실제로 들어가는지 확인
                    console.log(`🎨 [${character.name}] 스타일: ${character.style}, 인종: ${character.ethnicity}, 프롬프트:`, prompt.en.substring(0, 200));

                    // ✅ 시드 생성 (캐릭터 일관성을 위해)
                    const seed = Math.floor(Math.random() * 2147483647);

                    // 이미지 생성 (API 호출) - seed 전달
                    const imageUrl = await this.generateCharacterImage(prompt, seed);

                    // ✅ imageBase64 추출 (data:image/png;base64, 접두사 제거)
                    const imageBase64 = imageUrl.startsWith('data:image/')
                        ? imageUrl.replace(/^data:image\/\w+;base64,/, '')
                        : null;

                    // 캐릭터 업데이트 (확장된 데이터)
                    character.imageUrl = imageUrl;
                    character.imageBase64 = imageBase64;  // ✅ referenceImages용
                    character.promptKo = prompt.ko;
                    character.promptEn = prompt.en;
                    character.descriptionEn = character.descriptionEn || prompt.en;  // ✅ 장면 생성용
                    character.seed = seed;  // ✅ 일관성 유지용
                    character.generatedAt = Date.now();
                    character.history = [{
                        version: 1,
                        imageUrl: imageUrl,
                        promptKo: prompt.ko,
                        promptEn: prompt.en,
                        seed: seed,  // ✅ 히스토리에 seed 저장
                        timestamp: Date.now()
                    }];
                    
                    // UI 업데이트
                    this.renderCharacters();
                    
                    // 진행률 업데이트
                    UI.updateProgress(i + 1, this.state.characters.length);
                    
                } catch (error) {
                    console.error(`❌ 등장인물 생성 실패 [${character.name}]:`, error);
                    character.error = error.message;
                }
            }

            UI.hideProgress();
            UI.showToast(`✅ 등장인물 생성 완료! (${this.state.characters.length}명)`, 'success');

            // 다운로드 버튼 활성화
            this.enableDownloadButton();

            // 스토리보드 생성 버튼 활성화
            this.enableStoryboardButton();

        } catch (error) {
            console.error('❌ 등장인물 생성 오류:', error);
            UI.hideProgress();
            UI.showToast('등장인물 생성 중 오류가 발생했습니다', 'error');
        }
    },

    // 등장인물 프롬프트 생성 - v3.0 (era 동적 처리)
    async createCharacterPrompt(character) {
        const { name, nameEn, description, descriptionKo, descriptionEn, era } = character;

        // ✅ 현재 상태에서 스타일과 인종 가져오기 (캐릭터에 없으면 현재 상태 사용)
        const ethnicity = character.ethnicity || this.state.currentEthnicity;
        const style = character.style || this.state.currentStyle;

        // 🆕 한글/영문 설명 우선 사용 (없으면 기존 description 사용)
        const koDesc = descriptionKo || description;
        const enDesc = descriptionEn || description;

        // 🆕 시대 정보 (Gemini가 제공하거나 기본값 joseon)
        const characterEra = era || 'joseon';
        
        // 인종별 설명
        const ethnicityMap = {
            korean: 'Korean person',
            japanese: 'Japanese person',
            western: 'Western person (Caucasian)',
            black: 'Black person (African descent)'
        };

        // 🆕 FLUX.1 Dev용 자연스러운 문장형 프롬프트 (시대 정보는 동적으로 추가됨)
        const stylePromptMap = {
            'korean-webtoon': {
                positive: 'A digital illustration in Korean webtoon manhwa style with clean sharp outlines and vibrant colors, expressive character with detailed features, professional digital art',
                negative: 'photorealistic, 3d render, sketch, ugly face, distorted anatomy, Chinese style, Japanese anime, modern architecture, cars, western clothing, glasses, suit, neon lights, text, watermark'
            },
            'folklore-illustration': {
                positive: 'A Korean folklore storybook illustration with warm pastel tones and soft edges, hand-drawn texture with whimsical emotional atmosphere, watercolor fairy tale aesthetic',
                negative: '3d render, photorealistic, cyberpunk, horror, dark mood, Chinese painting, Japanese ukiyo-e, modern architecture, cars, electricity, western clothing, suit, text, watermark'
            },
            'traditional-ink': {
                positive: 'A Korean traditional ink wash painting in sumi-e style on Hanji paper, artistic brush strokes with ethereal atmosphere and muted colors, oriental painting aesthetic',
                negative: 'anime, cartoon, 3d render, bright neon colors, modern style, Chinese gongbi, Japanese sumi-e, modern buildings, cars, robots, spaceships, western clothing, glasses, text, watermark'
            },
            'simple-2d-cartoon': {
                positive: 'A simple 2D cartoon illustration in Korean manhwa style with flat colors and thick outlines, clean vector art with minimal shading and cute character design',
                negative: 'realistic, 3d, detailed shading, oil painting, complex rendering, Chinese donghua, Japanese anime, modern architecture, cars, sci-fi elements, text, watermark'
            },
            'lyrical-anime': {
                positive: 'Makoto Shinkai style, anime still, breathtaking scenery, beautiful lighting, lens flare, volumetric fog, highly detailed cloud and sky, sentimental atmosphere, vibrant colors, masterpiece, best quality, 8k, highres',
                negative: 'low quality, worst quality, sketch, ugly face, distorted, bad anatomy, monochrome, grayscale, real photo, photorealistic, 3d render, Chinese donghua'
            },
            'action-anime': {
                positive: 'Ufotable anime style, high contrast, dynamic angle, bold lines, intense atmosphere, cel shading, visual effects, highly detailed, masterpiece, best quality, action scene, 4k',
                negative: 'soft, pastel, blurry, sketch, low quality, ugly, distorted, bad anatomy, watercolor, minimalist, photorealistic, real photo, Chinese donghua'
            },
            'documentary-photo': {
                positive: 'A documentary photography in Korean slice of life style, candid shot with natural lighting, realistic skin texture and pores visible, cinematic lighting with shallow depth of field, shot on 35mm film',
                negative: 'anime, cartoon, illustration, painting, 3d render, airbrushed skin, heavy makeup, plastic look, fake, Chinese photography style, Japanese photography style, text, watermark'
            },
            'cinematic-movie': {
                positive: 'A cinematic movie scene with blockbuster production quality, dramatic lighting with professional color grading, shallow depth of field with highly detailed textures, photorealistic cinematography',
                negative: 'anime, cartoon, sketch, drawing, 3d render, ugly composition, distorted perspective, amateur photography, Chinese cinema style, text, watermark'
            },
            'scifi-fantasy': {
                positive: 'A sci-fi cyberpunk or high fantasy scene with futuristic elements, neon lights and advanced technology, intricate details with cinematic lighting, digital art rendering',
                negative: 'sketch, drawing, simple background, ugly design, distorted anatomy, flat composition, Chinese sci-fi style, Japanese mecha style, text, watermark'
            }
        };

        const ethnicityDesc = ethnicityMap[ethnicity] || ethnicityMap.korean;
        const stylePrompt = stylePromptMap[style] || stylePromptMap['korean-webtoon'];

        // 🆕 시대별 프롬프트 (조선시대/현대/미래/판타지)
        const eraPromptMap = {
            joseon: {
                positive: 'set in Joseon dynasty era Korea, traditional historical setting with Korean cultural elements',
                negative: 'modern architecture, cars, skyscrapers, contemporary clothing, glasses, suit, tie, sneakers, smartphones, modern technology'
            },
            modern: {
                positive: 'set in modern contemporary Korea, present-day setting with urban elements',
                negative: 'traditional hanbok, gat, historical clothing, sangtu hairstyle, joseon era, ancient architecture'
            },
            future: {
                positive: 'set in futuristic Korea, sci-fi cyberpunk setting with advanced technology and neon lights',
                negative: 'traditional hanbok, historical clothing, ancient architecture, rustic elements'
            },
            fantasy: {
                positive: 'set in high fantasy world with magical elements, mystical atmosphere',
                negative: 'modern technology, cars, smartphones, contemporary clothing'
            }
        };

        const eraPrompt = eraPromptMap[characterEra] || eraPromptMap.joseon;

        // 영문 프롬프트 (인물 + 시대 + 스타일)
        const promptEn = `Portrait of ${nameEn || name}, ${ethnicityDesc}, ${enDesc}, ${eraPrompt.positive}, ${stylePrompt.positive}`;

        // 네거티브 프롬프트 (시대별 + 스타일별)
        const negativePrompt = `${eraPrompt.negative}, ${stylePrompt.negative}`;

        // 한글 프롬프트
        const styleNameMap = {
            'korean-webtoon': '고퀄리티 웹툰',
            'folklore-illustration': '동화 일러스트',
            'traditional-ink': '전통 수묵화',
            'simple-2d-cartoon': '심플 2D 만화',
            'lyrical-anime': '감성 애니메이션',
            'action-anime': '극화체 애니메이션',
            'documentary-photo': '다큐멘터리 포토',
            'cinematic-movie': '영화 실사',
            'scifi-fantasy': '판타지/SF'
        };
        const styleName = styleNameMap[style] || '웹툰';
        const promptKo = `${name}의 초상화, ${koDesc}, ${styleName} 스타일`;

        return {
            en: promptEn,
            ko: promptKo,
            negative: negativePrompt
        };
    },

    // 등장인물 이미지 생성 (API 호출)
    async generateCharacterImage(prompt, seed = null) {
        try {
            const imageUrl = await API.generateImageLocal({
                prompt: prompt.en,
                aspectRatio: this.state.currentAspectRatio,
                ...(seed && { seed })  // ✅ seed 전달 (있을 경우만)
            });
            return imageUrl;
        } catch (error) {
            console.error('❌ 로컬 이미지 생성 실패:', error);
            throw error;
        }
    },

    // 등장인물 렌더링
    renderCharacters() {
        const container = document.getElementById('characters-container');
        if (!container) return;

        if (this.state.characters.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <p class="empty-title">등장인물이 없습니다</p>
                    <p class="empty-desc">대본을 업로드하고 분석하여 등장인물을 자동으로 추출하세요</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        this.state.characters.forEach((character, index) => {
            const card = this.createCharacterCard(character, index);
            container.appendChild(card);
        });
    },

    // 등장인물 카드 생성
    createCharacterCard(character, index) {
        const card = document.createElement('div');
        card.className = 'character-card';
        card.dataset.index = index;

        // 이미지 URL (생성 전이면 placeholder)
        const imageUrl = character.imageUrl || 'https://via.placeholder.com/300x300?text=생성+대기중';
        const isGenerated = !!character.imageUrl;

        card.innerHTML = `
            <div class="character-image-wrapper">
                <img src="${imageUrl}" alt="${character.name}" class="character-image">
                ${!isGenerated ? '<div class="character-overlay"><span>생성 대기중</span></div>' : ''}
            </div>
            <div class="character-info">
                <h3 class="character-name">${character.name}</h3>
                <p class="character-name-en">${character.nameEn || ''}</p>
                <p class="character-desc">${character.description || ''}</p>
            </div>
            ${isGenerated ? `
                <div class="character-actions">
                    <button class="btn-icon-small" title="재생성" data-action="regenerate">
                        🔄
                    </button>
                    <button class="btn-icon-small" title="다운로드" data-action="download">
                        📥
                    </button>
                </div>
            ` : ''}
        `;

        // 클릭 이벤트 (이미지 상세 모달)
        if (isGenerated) {
            card.addEventListener('click', (e) => {
                // 액션 버튼 클릭 시 제외
                if (e.target.closest('.character-actions')) return;
                
                this.openCharacterModal(character, index);
            });

            // 액션 버튼 이벤트
            const regenerateBtn = card.querySelector('[data-action="regenerate"]');
            const downloadBtn = card.querySelector('[data-action="download"]');

            if (regenerateBtn) {
                regenerateBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.regenerateCharacter(index);
                });
            }

            if (downloadBtn) {
                downloadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.downloadCharacterImage(character);
                });
            }
        }

        return card;
    },

    // 등장인물 상세 모달 열기
    openCharacterModal(character, index) {
        const modal = document.getElementById('image-detail-modal');
        if (!modal) return;

        // 모달 데이터 설정
        modal.dataset.type = 'character';
        modal.dataset.index = index;

        // 제목
        const title = document.getElementById('modal-title');
        if (title) {
            title.textContent = `${character.name} (${character.nameEn || ''})`;
        }

        // 이미지
        const image = document.getElementById('modal-image');
        if (image) {
            image.src = character.imageUrl;
            image.alt = character.name;
        }

        // 프롬프트
        const promptKo = document.getElementById('modal-prompt-ko');
        const promptEn = document.getElementById('modal-prompt-en');
        if (promptKo) promptKo.value = character.promptKo || '';
        if (promptEn) promptEn.value = character.promptEn || '';

        // 수정 요청 초기화
        const editRequest = document.getElementById('modal-edit-request');
        if (editRequest) editRequest.value = '';

        // 히스토리
        this.renderCharacterHistory(character);

        // 대본 구간 숨기기 (등장인물은 대본 구간 없음)
        const scriptSection = document.getElementById('modal-script-section');
        if (scriptSection) scriptSection.style.display = 'none';

        // 모달 표시
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    // 등장인물 히스토리 렌더링
    renderCharacterHistory(character) {
        const historyContainer = document.getElementById('modal-history');
        if (!historyContainer) return;

        const history = character.history || [];
        
        if (history.length === 0) {
            historyContainer.innerHTML = '<p class="empty-text">히스토리가 없습니다</p>';
            return;
        }

        historyContainer.innerHTML = '';
        history.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <img src="${item.imageUrl}" alt="v${item.version}" class="history-thumbnail">
                <div class="history-info">
                    <span class="history-version">v${item.version}</span>
                    <span class="history-date">${this.formatTimestamp(item.timestamp)}</span>
                </div>
                <button class="btn-icon-small" title="이 버전으로 복원" data-version="${item.version}">
                    ↩️
                </button>
            `;

            // 복원 버튼
            const restoreBtn = historyItem.querySelector('[data-version]');
            if (restoreBtn) {
                restoreBtn.addEventListener('click', () => {
                    this.restoreCharacterVersion(character, item.version);
                });
            }

            historyContainer.appendChild(historyItem);
        });
    },

    // 타임스탬프 포맷
    formatTimestamp(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}일 전`;
        if (hours > 0) return `${hours}시간 전`;
        if (minutes > 0) return `${minutes}분 전`;
        return '방금 전';
    },

    // 등장인물 재생성 (수정사항 없이 재생성 → 새 시드)
    async regenerateCharacter(index, modificationText = null) {
        const character = this.state.characters[index];
        if (!character) return;

        try {
            UI.showToast(`${character.name} 재생성 중...`, 'info');

            const prompt = await this.createCharacterPrompt(character);

            // ✅ 시드 분기 로직: 수정사항 있으면 기존 시드, 없으면 새 시드
            let seed;
            if (modificationText && modificationText.trim() !== '') {
                // 수정사항 있음 → 기존 시드 유지
                seed = character.seed;
                console.log(`🔄 [${character.name}] 수정 재생성: 기존 시드 유지 (${seed})`);
            } else {
                // 수정사항 없음 → 새 시드 생성
                seed = Math.floor(Math.random() * 2147483647);
                console.log(`🔄 [${character.name}] 새 재생성: 새 시드 생성 (${seed})`);
            }

            const imageUrl = await this.generateCharacterImage(prompt, seed);

            // ✅ imageBase64 추출
            const imageBase64 = imageUrl.startsWith('data:image/')
                ? imageUrl.replace(/^data:image\/\w+;base64,/, '')
                : null;

            // 히스토리에 추가
            const version = (character.history?.length || 0) + 1;
            if (!character.history) character.history = [];
            character.history.push({
                version: version,
                imageUrl: imageUrl,
                promptKo: prompt.ko,
                promptEn: prompt.en,
                seed: seed,  // ✅ 히스토리에 seed 저장
                timestamp: Date.now()
            });

            // 현재 이미지 업데이트
            character.imageUrl = imageUrl;
            character.imageBase64 = imageBase64;  // ✅ referenceImages용
            character.promptKo = prompt.ko;
            character.promptEn = prompt.en;
            character.seed = seed;  // ✅ 시드 업데이트

            this.renderCharacters();
            UI.showToast(`✅ ${character.name} 재생성 완료!`, 'success');

        } catch (error) {
            console.error('❌ 재생성 오류:', error);
            UI.showToast('재생성 중 오류가 발생했습니다', 'error');
        }
    },

    // 등장인물 버전 복원 - v3.0 (모달 내 실시간 업데이트)
    restoreCharacterVersion(character, version) {
        const historyItem = character.history.find(h => h.version === version);
        if (!historyItem) return;

        character.imageUrl = historyItem.imageUrl;
        character.promptKo = historyItem.promptKo;
        character.promptEn = historyItem.promptEn;

        // ✅ seed 복원 (히스토리에 저장된 경우)
        if (historyItem.seed) {
            character.seed = historyItem.seed;
        }

        // ✅ imageBase64 재추출
        if (historyItem.imageUrl && historyItem.imageUrl.startsWith('data:image/')) {
            character.imageBase64 = historyItem.imageUrl.replace(/^data:image\/\w+;base64,/, '');
        }

        this.renderCharacters();

        // ✅ 모달 내 이미지 및 프롬프트 실시간 업데이트
        const modalImage = document.getElementById('modal-image');
        const promptKo = document.getElementById('modal-prompt-ko');
        const promptEn = document.getElementById('modal-prompt-en');

        if (modalImage) modalImage.src = historyItem.imageUrl;
        if (promptKo) promptKo.value = historyItem.promptKo || '';
        if (promptEn) promptEn.value = historyItem.promptEn || '';

        UI.showToast(`✅ v${version}로 복원되었습니다`, 'success');

        // ✅ 모달은 열린 상태 유지
    },

    // 등장인물 이미지 다운로드
    downloadCharacterImage(character) {
        if (!character.imageUrl) return;

        const link = document.createElement('a');
        link.href = character.imageUrl;
        link.download = `${character.name}_${character.nameEn || 'character'}.png`;
        link.click();

        UI.showToast(`${character.name} 다운로드 중...`, 'info');
    },

    // 전체 등장인물 다운로드
    async downloadAllCharacters() {
        try {
            UI.showToast('등장인물 엑셀 파일 생성 중...', 'info');

            // ExcelExport 모듈 호출
            await ExcelExport.exportCharacters(this.state.characters);

            UI.showToast('✅ 다운로드 완료!', 'success');

        } catch (error) {
            console.error('❌ 다운로드 오류:', error);
            UI.showToast('다운로드 중 오류가 발생했습니다', 'error');
        }
    },

    // 사진만 다운로드 (ZIP)
    async downloadAllImages() {
        try {
            UI.showToast('등장인물 이미지 ZIP 생성 중...', 'info');

            await ExcelExport.downloadCharacterImagesOnly(this.state.characters);

            UI.showToast('✅ 사진 다운로드 완료!', 'success');

        } catch (error) {
            console.error('❌ 다운로드 오류:', error);
            UI.showToast('다운로드 중 오류가 발생했습니다', 'error');
        }
    },

    // 엑셀만 다운로드
    async downloadExcel() {
        try {
            UI.showToast('등장인물 엑셀 파일 생성 중...', 'info');

            await ExcelExport.exportCharactersExcelOnly(this.state.characters);

            UI.showToast('✅ 엑셀 다운로드 완료!', 'success');

        } catch (error) {
            console.error('❌ 다운로드 오류:', error);
            UI.showToast('다운로드 중 오류가 발생했습니다', 'error');
        }
    },

    // 다운로드 버튼 활성화
    enableDownloadButton() {
        const downloadImagesBtn = document.getElementById('download-characters-images-btn');
        const downloadExcelBtn = document.getElementById('download-characters-excel-btn');
        
        if (downloadImagesBtn) {
            downloadImagesBtn.disabled = false;
        }
        
        if (downloadExcelBtn) {
            downloadExcelBtn.disabled = false;
        }
    },

    // 스토리보드 버튼 활성화
    enableStoryboardButton() {
        const storyboardBtn = document.getElementById('generate-storyboard-btn');
        if (storyboardBtn) {
            storyboardBtn.disabled = false;
        }
    },

    // 대본 분석 후 등장인물 추출
    extractCharactersFromScript(scriptText) {
        // 간단한 등장인물 추출 로직
        // 실제로는 AI API로 분석
        
        const characters = [
            {
                name: '윤해린',
                nameEn: 'Yoon Haerin',
                description: '20대 초반 여성, 긴 검은 머리, 우아한 한복',
                ethnicity: this.state.currentEthnicity,
                style: this.state.currentStyle
            },
            {
                name: '백도식',
                nameEn: 'Baek Dosik',
                description: '30대 남성, 짧은 검은 머리, 전통 한복',
                ethnicity: this.state.currentEthnicity,
                style: this.state.currentStyle
            },
            {
                name: '나그네',
                nameEn: 'Traveler',
                description: '50대 남성, 회색 머리, 여행자 옷',
                ethnicity: this.state.currentEthnicity,
                style: this.state.currentStyle
            }
        ];

        this.state.characters = characters;
        this.renderCharacters();

        // 등장인물 생성 버튼 활성화
        const generateBtn = document.getElementById('generate-characters-btn');
        if (generateBtn) {
            generateBtn.disabled = false;
        }

        UI.showToast(`✅ ${characters.length}명의 등장인물 추출됨`, 'success');
    },

    // 모든 대본에서 등장인물 추출
    extractCharactersFromAllScripts(scripts) {
        // 모든 대본 합치기
        const allText = Object.values(scripts).join('\n\n');
        this.extractCharactersFromScript(allText);
    },

    // 상태 저장
    saveState() {
        return {
            characters: this.state.characters,
            currentEthnicity: this.state.currentEthnicity,
            currentStyle: this.state.currentStyle,
            currentQuality: this.state.currentQuality,
            currentAspectRatio: this.state.currentAspectRatio
        };
    },

    // 상태 복원
    loadState(state) {
        if (state) {
            this.state = state;
            this.renderCharacters();
            
            if (this.state.characters.length > 0) {
                this.enableDownloadButton();
            }
        }
    }
};

// 전역 함수로 노출
window.CharacterManager = CharacterManager;
