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

                        // 이미지 생성
                        const imageUrl = await this.generateSceneImage(prompt);

                        // 장면 추가
                        const scene = {
                            id: `scene_${Date.now()}_${sceneIndex}`,
                            partNumber: segment.partNumber,
                            segmentNumber: segment.segmentNumber,
                            imageUrl: imageUrl,
                            promptKo: prompt.ko,
                            promptEn: prompt.en,
                            scriptText: segment.fullText,
                            startSentence: segment.startSentence,
                            endSentence: segment.endSentence,
                            characters: this.detectCharactersInSegment(segment.fullText),
                            generatedAt: Date.now(),
                            history: [{
                                version: 1,
                                imageUrl: imageUrl,
                                promptKo: prompt.ko,
                                promptEn: prompt.en,
                                timestamp: Date.now()
                            }]
                        };

                        this.state.scenes.push(scene);
                        sceneIndex++;

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

    // 장면 프롬프트 생성
    async createScenePrompt(segment) {
        const text = segment.fullText;
        const currentStyle = CharacterManager.state.currentStyle;

        // 스타일별 프롬프트
        const stylePromptMap = {
            'korean-webtoon': {
                positive: 'Korean webtoon style, manhwa, digital art, highly detailed, clean sharp outlines, vibrant colors, expressive characters, historical drama scene, masterpiece, best quality, 8k resolution, (Joseon dynasty era:1.2)',
                negative: 'photorealistic, 3d render, sketch, low quality, ugly, distorted face, bad anatomy, (modern architecture, cars, sci-fi, cyberpunk, western clothing, glasses, suit, neon lights:1.5), text, watermark'
            },
            'folklore-illustration': {
                positive: 'Korean folklore storybook illustration, warm pastel tones, soft edges, hand-drawn texture, retro aesthetic, whimsical, emotional, watercolor texture, masterpiece, fairy tale atmosphere, (Joseon dynasty era:1.2)',
                negative: '3d render, sharp focus, photorealistic, cyberpunk, horror, dark, low quality, (modern architecture, cars, sci-fi, electricity, western clothing, suit:1.5), text, watermark'
            },
            'traditional-ink': {
                positive: 'Korean traditional ink wash painting, sumi-e style, watercolor on Hanji paper, artistic brush strokes, ethereal atmosphere, muted colors, historical, oriental painting, masterpiece, (Joseon dynasty era:1.2)',
                negative: 'anime, cartoon, 3d render, bright neon colors, modern, (modern building, cars, sci-fi, robot, spaceship, western clothing, suit, glasses:1.5), low quality, ugly, text, watermark'
            },
            'simple-2d-cartoon': {
                positive: 'Simple 2d cartoon style, flat color, thick outlines, educational comic style, korean manhwa, clean vector art, minimal shading, cute character design, (Joseon dynasty era:1.2)',
                negative: 'realistic, 3d, detailed shading, oil painting, watercolor, sketch, complex, low quality, ugly, (modern architecture, cars, sci-fi:1.5), text, watermark'
            },
            'lyrical-anime': {
                positive: 'Makoto Shinkai style, anime still, breathtaking scenery, beautiful lighting, lens flare, volumetric fog, highly detailed cloud and sky, sentimental atmosphere, vibrant colors, masterpiece, best quality, 8k, highres',
                negative: 'low quality, worst quality, sketch, ugly face, distorted, bad anatomy, monochrome, grayscale, real photo, photorealistic, 3d render'
            },
            'action-anime': {
                positive: 'Ufotable anime style, high contrast, dynamic angle, bold lines, intense atmosphere, cel shading, visual effects, highly detailed, masterpiece, best quality, action scene, 4k',
                negative: 'soft, pastel, blurry, sketch, low quality, ugly, distorted, bad anatomy, watercolor, minimalist, photorealistic, real photo'
            },
            'documentary-photo': {
                positive: 'Japanese slice of life documentary photography, candid shot, raw photo, natural lighting, realistic skin texture, wrinkles, detailed pores, cinematic lighting, bokeh, shot on 35mm, masterpiece, photorealistic, 8k uhd, (Showa era atmosphere:1.1)',
                negative: 'anime, cartoon, illustration, painting, 3d render, airbrushed, smooth skin, makeup, plastic, fake, low quality, blurry, text, watermark'
            },
            'cinematic-movie': {
                positive: 'Cinematic movie scene, blockbuster look, dramatic lighting, color graded, shallow depth of field, highly detailed, photorealistic, masterpiece, best quality, 8k uhd, professional photography',
                negative: 'anime, cartoon, sketch, drawing, 3d render, low quality, ugly, distorted, bad anatomy, blurry, text, watermark'
            },
            'scifi-fantasy': {
                positive: 'Sci-fi cyberpunk world OR high fantasy world, Unreal Engine 5 render, octane render, neon lights, futuristic, intricate details, 3d digital art, cinematic lighting, masterpiece, best quality, 8k',
                negative: 'sketch, drawing, low quality, blurry, simple background, ugly, distorted, bad anatomy, 2d, flat color'
            }
        };

        const stylePrompt = stylePromptMap[currentStyle] || stylePromptMap['korean-webtoon'];

        // 간단한 키워드 추출
        const keywords = this.extractKeywords(text);

        const promptEn = `${keywords.join(', ')}, ${stylePrompt.positive}`;
        const negativePrompt = stylePrompt.negative;
        const promptKo = `${text.substring(0, 100)}... 장면, ${currentStyle} 스타일`;

        return {
            en: promptEn,
            ko: promptKo,
            negative: negativePrompt
        };
    },

    // 키워드 추출 (간단한 버전)
    extractKeywords(text) {
        // 실제로는 AI로 분석
        const keywords = ['Korean historical drama', 'traditional scene'];
        return keywords;
    },

    // 장면 이미지 생성
    async generateSceneImage(prompt) {
        // 현재 비율에 맞는 해상도 가져오기
        const resolution = CharacterManager.getResolutionFromAspectRatio(CharacterManager.state.currentAspectRatio);
        
        // 로컬 Stable Diffusion WebUI 사용
        try {
            const imageUrl = await API.generateImageLocal({
                prompt: prompt.en,
                negative_prompt: prompt.negative,
                style: CharacterManager.state.currentStyle,  // ← 스타일 전달
                width: resolution.width,
                height: resolution.height,
                steps: 30,
                cfg_scale: 7.5
            });
            return imageUrl;
        } catch (error) {
            console.error('❌ 로컬 장면 이미지 생성 실패:', error);
            
            // 폴백: 데모 이미지
            const demoImages = [
                'https://images.unsplash.com/photo-1551847812-36c8db2e6936?w=800&h=450&fit=crop',
                'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800&h=450&fit=crop',
                'https://images.unsplash.com/photo-1551847812-9dcf1acbf8b4?w=800&h=450&fit=crop'
            ];

            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
            return demoImages[Math.floor(Math.random() * demoImages.length)];
        }
    },

    // 구간에서 등장인물 감지
    detectCharactersInSegment(text) {
        const characters = CharacterManager.state.characters;
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

        card.innerHTML = `
            <div class="scene-image-wrapper">
                <img src="${scene.imageUrl}" alt="장면 ${index + 1}" class="scene-image">
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

    // 장면 히스토리 렌더링
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
            historyItem.innerHTML = `
                <img src="${item.imageUrl}" alt="v${item.version}" class="history-thumbnail">
                <div class="history-info">
                    <span class="history-version">v${item.version}</span>
                    <span class="history-date">${CharacterManager.formatTimestamp(item.timestamp)}</span>
                </div>
            `;

            historyContainer.appendChild(historyItem);
        });
    },

    // 장면 재생성
    async regenerateScene(sceneId) {
        const scene = this.state.scenes.find(s => s.id === sceneId);
        if (!scene) return;

        try {
            UI.showToast('장면 재생성 중...', 'info');

            const segment = {
                fullText: scene.scriptText,
                partNumber: scene.partNumber
            };

            const prompt = await this.createScenePrompt(segment);
            const imageUrl = await this.generateSceneImage(prompt);

            // 히스토리에 추가
            const version = (scene.history?.length || 0) + 1;
            if (!scene.history) scene.history = [];
            scene.history.push({
                version: version,
                imageUrl: imageUrl,
                promptKo: prompt.ko,
                promptEn: prompt.en,
                timestamp: Date.now()
            });

            scene.imageUrl = imageUrl;
            scene.promptKo = prompt.ko;
            scene.promptEn = prompt.en;

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

    // 상태 저장
    saveState() {
        return {
            scenes: this.state.scenes,
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
        }
    }
};

// 전역 함수로 노출
window.StoryboardManager = StoryboardManager;
