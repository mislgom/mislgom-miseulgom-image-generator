/**
 * 미슬곰 이미지 자동 생성기 v1.0 - 스토리보드 관리 모듈
 * 스토리보드 생성, 이미지 매핑, 대본 구간 관리
 */

const StoryboardManager = {
    // 상태 관리
    state: {
        scenes: [],
        currentPart: 'all',
        totalScenes: 0
    },

    // 초기화
    init() {
        console.log('🎬 StoryboardManager 초기화');
        this.attachEventListeners();
    },

    // 이벤트 리스너 등록
    attachEventListeners() {
        // 스토리보드 생성 버튼
        const generateBtn = document.getElementById('generate-storyboard-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateStoryboard();
            });
        }

        // 전체 다운로드 버튼
        const downloadImagesBtn = document.getElementById('download-storyboard-images-btn');
        const downloadExcelBtn = document.getElementById('download-storyboard-excel-btn');
        
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
    },

    // 스토리보드 생성
    async generateStoryboard() {
        try {
            if (!ScriptManager.isUploaded()) {
                UI.showToast('먼저 대본을 업로드하세요', 'error');
                return;
            }

            // 파트별 이미지 수 제안 받기
            const parts = ScriptManager.getAllParts();
            const sceneConfig = await this.suggestSceneCount(parts);

            UI.showToast('스토리보드 생성 중...', 'info');

            let totalScenes = 0;
            sceneConfig.forEach(config => totalScenes += config.imageCount);

            UI.showProgress('스토리보드 생성 중', 0, totalScenes);

            // 파트별 스토리보드 생성
            let sceneIndex = 0;
            for (const config of sceneConfig) {
                const part = parts.find(p => p.partNumber === config.partNumber);
                if (!part) continue;

                // 대본 구간 분할
                const segments = ScriptManager.createScriptSegments(
                    config.partNumber,
                    config.imageCount
                );

                // 각 구간마다 이미지 생성
                for (const segment of segments) {
                    try {
                        // 프롬프트 생성
                        const prompt = await this.createScenePrompt(segment);

                        // ✅ 장면에 등장하는 캐릭터 감지
                        const sceneCharacters = this.detectCharactersInSegment(segment.fullText);

                        // ✅ 시드 생성
                        const seed = Math.floor(Math.random() * 2147483647);

                        // 이미지 생성 (캐릭터 참조 이미지 전달)
                        const imageUrl = await this.generateSceneImage(prompt, {
                            characters: sceneCharacters,
                            seed: seed
                        });

                        // ✅ imageBase64 추출 (수정 요청 시 참조용)
                        const imageBase64 = imageUrl.startsWith('data:image/')
                            ? imageUrl.replace(/^data:image\/\w+;base64,/, '')
                            : null;

                        // 장면 추가 (확장된 데이터)
                        const scene = {
                            id: `scene_${Date.now()}_${sceneIndex}`,
                            partNumber: segment.partNumber,
                            segmentNumber: segment.segmentNumber,
                            imageUrl: imageUrl,
                            imageBase64: imageBase64,  // ✅ imageBase64 저장
                            promptKo: prompt.ko,
                            promptEn: prompt.en,
                            scriptText: segment.fullText,
                            startSentence: segment.startSentence,
                            endSentence: segment.endSentence,
                            characters: sceneCharacters,
                            seed: seed,  // ✅ seed 저장
                            generatedAt: Date.now(),
                            history: [{
                                version: 1,
                                imageUrl: imageUrl,
                                promptKo: prompt.ko,
                                promptEn: prompt.en,
                                seed: seed,  // ✅ 히스토리에 seed 저장
                                timestamp: Date.now()
                            }]
                        };

                        this.state.scenes.push(scene);
                        sceneIndex++;

                        // IndexedDB에 이미지 저장 (localStorage 용량 절약)
                        if (window.ImageStore && imageBase64) {
                            window.ImageStore.saveImage(scene.id, imageBase64, imageUrl)
                                .catch(err => console.warn('[Storyboard] IndexedDB 저장 실패:', err));
                        }

                        // UI 업데이트
                        this.renderScenes();
                        UI.updateProgress(sceneIndex, totalScenes);

                    } catch (error) {
                        console.error(`❌ 장면 생성 실패 [Part ${segment.partNumber}, Segment ${segment.segmentNumber}]:`, error);
                    }
                }
            }

            this.state.totalScenes = sceneIndex;

            // 파트 필터 업데이트
            this.updatePartFilter();

            UI.hideProgress();
            UI.showToast(`✅ 스토리보드 생성 완료! (${sceneIndex}개 장면)`, 'success');

            // 다운로드 버튼 활성화
            this.enableDownloadButton();

        } catch (error) {
            console.error('❌ 스토리보드 생성 오류:', error);
            UI.hideProgress();
            UI.showToast('스토리보드 생성 중 오류가 발생했습니다', 'error');
        }
    },

    // 스타일별 프롬프트 맵 가져오기
    getStylePromptMap() {
        return {
            'korean-webtoon': {
                positive: 'A digital illustration in Korean webtoon manhwa style with clean sharp outlines and vibrant colors, expressive characters with detailed features, professional digital art',
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
    },

    // 파트별 장면 수 제안
    async suggestSceneCount(parts) {
        // 간단한 알고리즘: 대본 길이에 비례
        // 실제로는 AI API로 분석
        
        const config = parts.map(part => {
            const charCount = part.content.length;
            let imageCount;

            if (charCount < 1000) {
                imageCount = 5;
            } else if (charCount < 2000) {
                imageCount = 10;
            } else if (charCount < 4000) {
                imageCount = 20;
            } else if (charCount < 6000) {
                imageCount = 30;
            } else if (charCount < 8000) {
                imageCount = 40;
            } else {
                imageCount = 50;
            }

            return {
                partNumber: part.partNumber,
                imageCount: imageCount,
                characterCount: charCount
            };
        });

        console.log('📊 파트별 이미지 수 제안:', config);
        return config;
    },

    // 장면 프롬프트 생성 - v3.0 (Gemini로 등장인물 일관성 유지)
    async createScenePrompt(segment) {
        const text = segment.fullText;
        const currentStyle = window.CharacterManager?.state?.currentStyle || 'korean-webtoon';

        // 🆕 이 장면에 등장하는 인물 감지
        const characters = this.detectCharactersInSegment(text);

        // 🆕 시대 정보 (첫 번째 등장인물의 era 또는 기본값)
        const era = characters.length > 0 && characters[0].era
            ? characters[0].era
            : 'joseon';

        // 🆕 Gemini API로 장면 프롬프트 생성 (등장인물 정보 포함)
        if (API.GEMINI_API_KEY && characters.length > 0) {
            try {
                const geminiPrompt = await API.generateScenePromptWithGemini({
                    scriptText: text,
                    characters: characters,
                    style: currentStyle,
                    era: era
                });

                if (geminiPrompt) {
                    console.log('✅ Gemini 장면 프롬프트 사용 (등장인물 일관성 유지)');

                    // 스타일 프롬프트 추가
                    const stylePromptMap = this.getStylePromptMap();
                    const stylePrompt = stylePromptMap[currentStyle] || stylePromptMap['korean-webtoon'];

                    return {
                        en: `${geminiPrompt.en}, ${stylePrompt.positive}`,
                        ko: geminiPrompt.ko,
                        negative: `${geminiPrompt.negative}, ${stylePrompt.negative}`
                    };
                }
            } catch (error) {
                console.warn('⚠️ Gemini 장면 프롬프트 생성 실패, 규칙 기반 사용:', error);
            }
        }

        // ⚠️ 규칙 기반 폴백 (Gemini 없을 때)
        console.warn('⚠️ Gemini API 없음 또는 등장인물 없음, 규칙 기반 프롬프트 사용');

        const stylePromptMap = this.getStylePromptMap();
        const stylePrompt = stylePromptMap[currentStyle] || stylePromptMap['korean-webtoon'];

        // 개선된 키워드 추출 (장소, 시간, 행동 등)
        const keywords = this.extractSceneKeywords(text);

        // 등장인물 정보 추가 (있으면)
        let characterDesc = '';
        if (characters.length > 0) {
            characterDesc = `featuring ${characters.map(c => c.nameEn).join(' and ')}`;
        }

        const promptEn = `${keywords}, ${characterDesc}, ${stylePrompt.positive}`.trim();
        const negativePrompt = stylePrompt.negative;
        const promptKo = `${text.substring(0, 100)}... 장면, ${currentStyle} 스타일`;

        return {
            en: promptEn,
            ko: promptKo,
            negative: negativePrompt
        };
    },

    // 개선된 장면 키워드 추출 (규칙 기반)
    extractSceneKeywords(text) {
        const keywords = [];

        // 시간대 감지
        if (text.includes('밤') || text.includes('저녁') || text.includes('야간')) {
            keywords.push('night time scene with dark atmosphere');
        } else if (text.includes('아침') || text.includes('새벽')) {
            keywords.push('morning scene with soft lighting');
        } else if (text.includes('낮') || text.includes('오후')) {
            keywords.push('daytime scene with bright natural lighting');
        }

        // 장소 감지
        if (text.includes('숲') || text.includes('산')) {
            keywords.push('forest or mountain setting');
        } else if (text.includes('방') || text.includes('집') || text.includes('실내')) {
            keywords.push('indoor traditional Korean room');
        } else if (text.includes('거리') || text.includes('시장')) {
            keywords.push('Korean street market scene');
        } else if (text.includes('궁궐') || text.includes('대궐')) {
            keywords.push('royal palace setting');
        }

        // 행동/장면 감지
        if (text.includes('싸우') || text.includes('전투') || text.includes('격투')) {
            keywords.push('intense action fighting scene');
        } else if (text.includes('대화') || text.includes('말하') || text.includes('이야기')) {
            keywords.push('conversation scene with characters talking');
        } else if (text.includes('걷') || text.includes('달리') || text.includes('이동')) {
            keywords.push('movement scene with characters walking');
        } else if (text.includes('앉') || text.includes('서')) {
            keywords.push('stationary scene with characters sitting or standing');
        }

        // 감정/분위기 감지
        if (text.includes('슬프') || text.includes('우') || text.includes('눈물')) {
            keywords.push('sad emotional atmosphere');
        } else if (text.includes('웃') || text.includes('즐거') || text.includes('기쁨')) {
            keywords.push('happy joyful atmosphere');
        } else if (text.includes('긴장') || text.includes('위험') || text.includes('두려')) {
            keywords.push('tense dramatic atmosphere');
        }

        // 기본 키워드 (아무것도 없으면)
        if (keywords.length === 0) {
            keywords.push('Korean historical drama scene');
        }

        return keywords.join(', ');
    },

    // 장면 이미지 생성 (referenceImages 지원)
    async generateSceneImage(prompt, options = {}) {
        try {
            const { characters = [], seed = null } = options;

            // ✅ referenceImages 구성 (등장 캐릭터의 이미지를 참조 이미지로 전달)
            let referenceImages = [];
            if (characters.length > 0) {
                referenceImages = characters
                    .filter(char => char.imageBase64)  // base64가 있는 캐릭터만
                    .map((char, index) => ({
                        referenceId: index + 1,
                        imageBase64: char.imageBase64,
                        description: char.descriptionEn || char.description || char.nameEn
                    }));

                if (referenceImages.length > 0) {
                    console.log(`📷 ${referenceImages.length}명의 캐릭터 참조 이미지 전달`);
                }
            }

            const imageUrl = await API.generateImageLocal({
                prompt: prompt.en,
                aspectRatio: window.CharacterManager?.state?.currentAspectRatio || '1:1',
                ...(seed && { seed }),
                ...(referenceImages.length > 0 && { referenceImages })
            });
            return imageUrl;
        } catch (error) {
            console.error('❌ 로컬 장면 이미지 생성 실패:', error);
            throw error;
        }
    },

    // 구간에서 등장인물 감지
    detectCharactersInSegment(text) {
        const characters = window.CharacterManager?.state?.characters || window.CharacterManager?.getCharacters?.() || [];
        const detected = [];

        characters.forEach(char => {
            if (text.includes(char.name) || text.includes(char.nameEn)) {
                detected.push(char);
            }
        });

        return detected;
    },

    // 장면 렌더링
    renderScenes() {
        const container = document.getElementById('storyboard-container');
        if (!container) return;

        // 현재 필터에 맞는 장면만 표시
        const filteredScenes = this.state.currentPart === 'all'
            ? this.state.scenes
            : this.state.scenes.filter(s => s.partNumber === parseInt(this.state.currentPart));

        if (filteredScenes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎬</div>
                    <p class="empty-title">스토리보드가 없습니다</p>
                    <p class="empty-desc">대본을 분석하고 스토리보드를 생성하세요</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        filteredScenes.forEach((scene, index) => {
            const card = this.createSceneCard(scene, index);
            container.appendChild(card);
        });
    },

    // 장면 카드 생성
    createSceneCard(scene, index) {
        const card = document.createElement('div');
        card.className = 'storyboard-card';
        card.dataset.id = scene.id;

        // 대본 구간 텍스트 (짧게)
        const scriptPreview = scene.scriptText.length > 80
            ? scene.scriptText.substring(0, 80) + '...'
            : scene.scriptText;

        // 이미지가 아직 IndexedDB에서 복원 중일 수 있음
        const imageHtml = scene.imageUrl
            ? `<img src="${scene.imageUrl}" alt="장면 ${index + 1}" class="scene-image">`
            : `<div class="scene-image" style="display:flex;align-items:center;justify-content:center;background:var(--bg-secondary,#f3f4f6);min-height:200px;"><span>🔄 불러오는 중...</span></div>`;

        card.innerHTML = `
            <div class="scene-image-wrapper">
                ${imageHtml}
                <div class="scene-overlay">
                    <span class="scene-number">장면 ${index + 1}</span>
                </div>
            </div>
            <div class="scene-info">
                <p class="scene-part">파트 ${scene.partNumber}</p>
                <p class="scene-script">${scriptPreview}</p>
            </div>
            <div class="scene-actions">
                <button class="btn-icon-small" title="재생성" data-action="regenerate">
                    🔄
                </button>
                <button class="btn-icon-small" title="다운로드" data-action="download">
                    📥
                </button>
            </div>
        `;

        // 클릭 이벤트 (장면 상세 모달)
        card.addEventListener('click', (e) => {
            if (e.target.closest('.scene-actions')) return;
            this.openSceneModal(scene, index);
        });

        // 액션 버튼 이벤트
        const regenerateBtn = card.querySelector('[data-action="regenerate"]');
        const downloadBtn = card.querySelector('[data-action="download"]');

        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.regenerateScene(scene.id);
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.downloadSceneImage(scene);
            });
        }

        return card;
    },

    // 장면 상세 모달 열기
    openSceneModal(scene, index) {
        const modal = document.getElementById('image-detail-modal');
        if (!modal) return;

        modal.dataset.type = 'scene';
        modal.dataset.id = scene.id;

        // 제목
        const title = document.getElementById('modal-title');
        if (title) {
            title.textContent = `장면 ${index + 1} - 파트 ${scene.partNumber}`;
        }

        // 이미지
        const image = document.getElementById('modal-image');
        if (image) {
            image.src = scene.imageUrl;
        }

        // 프롬프트
        const promptKo = document.getElementById('modal-prompt-ko');
        const promptEn = document.getElementById('modal-prompt-en');
        if (promptKo) promptKo.value = scene.promptKo || '';
        if (promptEn) promptEn.value = scene.promptEn || '';

        // 수정 요청 초기화
        const editRequest = document.getElementById('modal-edit-request');
        if (editRequest) editRequest.value = '';

        // 히스토리
        this.renderSceneHistory(scene);

        // 대본 구간 표시
        const scriptSection = document.getElementById('modal-script-section');
        const scriptText = document.getElementById('modal-script-text');
        if (scriptSection && scriptText) {
            scriptSection.style.display = 'block';
            scriptText.textContent = scene.scriptText;
        }

        // 모달 표시
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    // 장면 히스토리 렌더링 (복원 버튼 포함)
    renderSceneHistory(scene) {
        const historyContainer = document.getElementById('modal-history');
        if (!historyContainer) return;

        const history = scene.history || [];

        if (history.length === 0) {
            historyContainer.innerHTML = '<p class="empty-text">히스토리가 없습니다</p>';
            return;
        }

        historyContainer.innerHTML = '';
        history.forEach((item) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.dataset.version = item.version;
            historyItem.innerHTML = `
                <img src="${item.imageUrl}" alt="v${item.version}" class="history-thumbnail" style="cursor: pointer;">
                <div class="history-info">
                    <span class="history-version">v${item.version}</span>
                    <span class="history-date">${window.CharacterManager?.formatTimestamp?.(item.timestamp) || ''}</span>
                </div>
                <button class="btn-icon-small" title="이 버전으로 복원" data-version="${item.version}">
                    ↩️
                </button>
            `;

            // ✅ 썸네일 클릭 → 미리보기 업데이트 (복원 없이 미리보기만)
            const thumbnail = historyItem.querySelector('.history-thumbnail');
            if (thumbnail) {
                thumbnail.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.previewHistoryItem(item, historyContainer);
                });
            }

            // ✅ 복원 버튼 이벤트
            const restoreBtn = historyItem.querySelector('[data-version]');
            if (restoreBtn) {
                restoreBtn.addEventListener('click', () => {
                    this.restoreSceneVersion(scene, item.version);
                });
            }

            historyContainer.appendChild(historyItem);
        });
    },

    // ✅ 히스토리 아이템 미리보기 (복원 없이 미리보기만)
    previewHistoryItem(item, historyContainer) {
        // 선택 표시 업데이트
        const allItems = historyContainer.querySelectorAll('.history-item');
        allItems.forEach(el => el.classList.remove('selected'));
        const selectedItem = historyContainer.querySelector(`[data-version="${item.version}"]`);
        if (selectedItem) selectedItem.classList.add('selected');

        // 모달 이미지 업데이트
        const modalImage = document.getElementById('modal-image');
        if (modalImage) modalImage.src = item.imageUrl;

        // 프롬프트 업데이트
        const promptKo = document.getElementById('modal-prompt-ko');
        const promptEn = document.getElementById('modal-prompt-en');
        if (promptKo) promptKo.value = item.promptKo || '';
        if (promptEn) promptEn.value = item.promptEn || '';

        console.log(`👁️ 장면 히스토리 v${item.version} 미리보기`);
    },

    // ✅ 장면 버전 복원 (#9)
    restoreSceneVersion(scene, version) {
        const historyItem = scene.history.find(h => h.version === version);
        if (!historyItem) return;

        scene.imageUrl = historyItem.imageUrl;
        scene.promptKo = historyItem.promptKo;
        scene.promptEn = historyItem.promptEn;

        // ✅ seed 복원 (히스토리에 저장된 경우)
        if (historyItem.seed) {
            scene.seed = historyItem.seed;
        }

        // ✅ imageBase64 재추출
        if (historyItem.imageUrl && historyItem.imageUrl.startsWith('data:image/')) {
            scene.imageBase64 = historyItem.imageUrl.replace(/^data:image\/\w+;base64,/, '');
        }

        this.renderScenes();

        // ✅ 모달 내 이미지 및 프롬프트 실시간 업데이트
        const modalImage = document.getElementById('modal-image');
        const promptKo = document.getElementById('modal-prompt-ko');
        const promptEn = document.getElementById('modal-prompt-en');

        if (modalImage) modalImage.src = historyItem.imageUrl;
        if (promptKo) promptKo.value = historyItem.promptKo || '';
        if (promptEn) promptEn.value = historyItem.promptEn || '';

        UI.showToast(`✅ v${version}로 복원되었습니다`, 'success');
    },

    // 장면 재생성 (수정사항 없이 재생성 → 새 시드)
    async regenerateScene(sceneId, modificationText = null) {
        const scene = this.state.scenes.find(s => s.id === sceneId);
        if (!scene) return;

        try {
            UI.showToast('장면 재생성 중...', 'info');

            const segment = {
                fullText: scene.scriptText,
                partNumber: scene.partNumber
            };

            const prompt = await this.createScenePrompt(segment);

            // ✅ 장면에 등장하는 캐릭터 감지
            const sceneCharacters = scene.characters || this.detectCharactersInSegment(scene.scriptText);

            // ✅ 시드 분기 로직: 수정사항 있으면 기존 시드, 없으면 새 시드
            let seed;
            if (modificationText && modificationText.trim() !== '') {
                // 수정사항 있음 → 기존 시드 유지
                seed = scene.seed;
                console.log(`🔄 [장면] 수정 재생성: 기존 시드 유지 (${seed})`);
            } else {
                // 수정사항 없음 → 새 시드 생성
                seed = Math.floor(Math.random() * 2147483647);
                console.log(`🔄 [장면] 새 재생성: 새 시드 생성 (${seed})`);
            }

            const imageUrl = await this.generateSceneImage(prompt, {
                characters: sceneCharacters,
                seed: seed
            });

            // ✅ imageBase64 추출
            const imageBase64 = imageUrl.startsWith('data:image/')
                ? imageUrl.replace(/^data:image\/\w+;base64,/, '')
                : null;

            // 히스토리에 추가
            const version = (scene.history?.length || 0) + 1;
            if (!scene.history) scene.history = [];
            scene.history.push({
                version: version,
                imageUrl: imageUrl,
                promptKo: prompt.ko,
                promptEn: prompt.en,
                seed: seed,  // ✅ 히스토리에 seed 저장
                timestamp: Date.now()
            });

            scene.imageUrl = imageUrl;
            scene.imageBase64 = imageBase64;  // ✅ imageBase64 업데이트
            scene.promptKo = prompt.ko;
            scene.promptEn = prompt.en;
            scene.seed = seed;  // ✅ seed 업데이트

            // IndexedDB에 이미지 저장
            if (window.ImageStore && imageBase64) {
                window.ImageStore.saveImage(scene.id, imageBase64, imageUrl)
                    .catch(err => console.warn('[Storyboard] IndexedDB 저장 실패:', err));
            }

            this.renderScenes();
            UI.showToast('✅ 장면 재생성 완료!', 'success');

        } catch (error) {
            console.error('❌ 재생성 오류:', error);
            UI.showToast('재생성 중 오류가 발생했습니다', 'error');
        }
    },

    // 장면 이미지 다운로드
    downloadSceneImage(scene) {
        const link = document.createElement('a');
        link.href = scene.imageUrl;
        link.download = `scene_part${scene.partNumber}_${scene.segmentNumber}.png`;
        link.click();
    },

    // 전체 장면 다운로드
    async downloadAllScenes() {
        try {
            UI.showToast('스토리보드 엑셀 파일 생성 중...', 'info');

            await ExcelExport.exportStoryboard(this.state.scenes);

            UI.showToast('✅ 다운로드 완료!', 'success');

        } catch (error) {
            console.error('❌ 다운로드 오류:', error);
            UI.showToast('다운로드 중 오류가 발생했습니다', 'error');
        }
    },

    // 사진만 다운로드 (ZIP)
    async downloadAllImages() {
        try {
            UI.showToast('스토리보드 이미지 ZIP 생성 중...', 'info');

            await ExcelExport.downloadStoryboardImagesOnly(this.state.scenes);

            UI.showToast('✅ 사진 다운로드 완료!', 'success');

        } catch (error) {
            console.error('❌ 다운로드 오류:', error);
            UI.showToast('다운로드 중 오류가 발생했습니다', 'error');
        }
    },

    // 엑셀만 다운로드
    async downloadExcel() {
        try {
            UI.showToast('스토리보드 엑셀 파일 생성 중...', 'info');

            await ExcelExport.exportStoryboardExcelOnly(this.state.scenes);

            UI.showToast('✅ 엑셀 다운로드 완료!', 'success');

        } catch (error) {
            console.error('❌ 다운로드 오류:', error);
            UI.showToast('다운로드 중 오류가 발생했습니다', 'error');
        }
    },

    // 파트 필터 업데이트
    updatePartFilter() {
        const filterContainer = document.getElementById('part-filter');
        if (!filterContainer) return;

        // 고유한 파트 번호 추출
        const partNumbers = [...new Set(this.state.scenes.map(s => s.partNumber))].sort((a, b) => a - b);

        filterContainer.innerHTML = `
            <button class="filter-btn active" data-part="all">전체</button>
            ${partNumbers.map(part => `
                <button class="filter-btn" data-part="${part}">파트 ${part}</button>
            `).join('')}
        `;

        // 필터 버튼 이벤트
        const filterBtns = filterContainer.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.currentPart = btn.dataset.part;
                this.renderScenes();
            });
        });
    },

    // 다운로드 버튼 활성화
    enableDownloadButton() {
        const downloadImagesBtn = document.getElementById('download-storyboard-images-btn');
        const downloadExcelBtn = document.getElementById('download-storyboard-excel-btn');
        
        if (downloadImagesBtn) {
            downloadImagesBtn.disabled = false;
        }
        
        if (downloadExcelBtn) {
            downloadExcelBtn.disabled = false;
        }
    },

    // 상태 저장 (imageBase64/imageUrl은 IndexedDB에 저장, localStorage에서 제외)
    saveState() {
        const strippedScenes = this.state.scenes.map(scene => {
            const { imageBase64, imageUrl, history, ...rest } = scene;

            // 히스토리에서도 imageUrl 제거 (data: URL은 용량 큼)
            const strippedHistory = (history || []).map(h => {
                const { imageUrl: hUrl, ...hRest } = h;
                return {
                    ...hRest,
                    hasImage: !!(hUrl && hUrl.startsWith('data:'))
                };
            });

            return {
                ...rest,
                hasImage: !!(imageBase64 || (imageUrl && imageUrl.startsWith('data:'))),
                imageUrl: null,
                imageBase64: null,
                history: strippedHistory
            };
        });

        return {
            scenes: strippedScenes,
            currentPart: this.state.currentPart,
            totalScenes: this.state.totalScenes
        };
    },

    // 상태 복원
    loadState(state) {
        if (state) {
            this.state = state;
            this.renderScenes();
            this.updatePartFilter();

            if (this.state.scenes.length > 0) {
                this.enableDownloadButton();
            }

            // IndexedDB에서 이미지 비동기 복원
            this.restoreImagesFromStore();
        }
    },

    // IndexedDB에서 장면 이미지 복원 (기존 데이터 마이그레이션 포함)
    async restoreImagesFromStore() {
        if (!window.ImageStore) return;

        // 1) 마이그레이션: 메모리에 imageBase64가 있지만 IndexedDB에 없는 경우 저장
        const scenesWithImages = this.state.scenes.filter(s => s.imageBase64);
        if (scenesWithImages.length > 0) {
            const items = scenesWithImages.map(s => ({
                id: s.id,
                imageBase64: s.imageBase64,
                imageUrl: s.imageUrl
            }));
            await window.ImageStore.saveMany(items);
            console.log('[Storyboard] 기존 이미지 IndexedDB 마이그레이션:', items.length, '건');
        }

        // 2) 복원: hasImage 플래그가 있지만 메모리에 이미지가 없는 경우
        const needRestore = this.state.scenes.filter(s => s.hasImage && !s.imageBase64);
        if (needRestore.length === 0) return;

        console.log('[Storyboard] IndexedDB에서 이미지 복원 시작:', needRestore.length, '건');

        const ids = needRestore.map(s => s.id);
        const imageMap = await window.ImageStore.getMany(ids);

        let restored = 0;
        for (const scene of this.state.scenes) {
            const imageData = imageMap.get(scene.id);
            if (imageData) {
                scene.imageBase64 = imageData.imageBase64;
                scene.imageUrl = imageData.imageUrl;
                restored++;
            }
        }

        if (restored > 0) {
            console.log('[Storyboard] 이미지 복원 완료:', restored, '건');
            this.renderScenes();
        }
    }
};

// 전역 함수로 노출
window.StoryboardManager = StoryboardManager;
