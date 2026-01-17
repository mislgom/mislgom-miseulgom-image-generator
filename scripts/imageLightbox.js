/**
 * 이미지 라이트박스 기능 - 배너 스타일
 */

const ImageLightbox = {
    init() {
        console.log('🖼️ ImageLightbox 초기화');
        
        // 모든 스타일 썸네일에 클릭 이벤트 추가
        document.querySelectorAll('.style-thumbnail').forEach(thumbnail => {
            thumbnail.addEventListener('click', (e) => {
                e.stopPropagation();  // 라디오 버튼 선택 방지
                this.open(thumbnail.src, thumbnail.alt);
            });
        });

        // 라이트박스 닫기
        const lightbox = document.getElementById('image-lightbox');
        const overlay = document.getElementById('lightbox-overlay');
        const closeBtn = document.getElementById('lightbox-close');

        // 오버레이 클릭 시 닫기
        if (overlay) {
            overlay.addEventListener('click', () => {
                this.close();
            });
        }

        // 라이트박스 배경 클릭 시 닫기 (혹시 오버레이가 없을 경우 대비)
        if (lightbox) {
            lightbox.addEventListener('click', (e) => {
                // 라이트박스 자체를 클릭한 경우에만 닫기 (이미지나 버튼 제외)
                if (e.target === lightbox) {
                    this.close();
                }
            });

            // 이미지 클릭 시 닫기 방지
            const lightboxImage = document.getElementById('lightbox-image');
            if (lightboxImage) {
                lightboxImage.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }

        // 닫기 버튼
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });
    },

    open(src, alt) {
        const lightbox = document.getElementById('image-lightbox');
        const overlay = document.getElementById('lightbox-overlay');
        const image = document.getElementById('lightbox-image');

        if (lightbox && image) {
            image.src = src;
            image.alt = alt;
            lightbox.classList.add('active');
            if (overlay) {
                overlay.classList.add('active');
            }
            document.body.style.overflow = 'hidden';
            
            console.log('🖼️ 라이트박스 열림:', alt);
        }
    },

    close() {
        const lightbox = document.getElementById('image-lightbox');
        const overlay = document.getElementById('lightbox-overlay');

        if (lightbox) {
            lightbox.classList.remove('active');
            if (overlay) {
                overlay.classList.remove('active');
            }
            document.body.style.overflow = '';
            
            console.log('🖼️ 라이트박스 닫힘');
        }
    }
};

// 전역 함수로 노출
window.ImageLightbox = ImageLightbox;
