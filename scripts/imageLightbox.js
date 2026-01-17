/**
 * 이미지 라이트박스 기능 - 배너 스타일
 */

const ImageLightbox = {
    init() {
        console.log('🖼️ ImageLightbox 초기화 (호버 모드)');
        
        // 모든 스타일 썸네일에 마우스 오버/아웃 이벤트 추가
        document.querySelectorAll('.style-thumbnail').forEach(thumbnail => {
            // 마우스 오버 시 라이트박스 열기
            thumbnail.addEventListener('mouseenter', (e) => {
                e.stopPropagation();  // 라디오 버튼 선택 방지
                this.open(thumbnail.src, thumbnail.alt);
            });
            
            // 클릭 방지 (라디오 버튼 선택만 되도록)
            thumbnail.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });

        // 라이트박스와 썸네일 영역에서 벗어나면 닫기
        const lightbox = document.getElementById('image-lightbox');
        const styleOptions = document.querySelector('.style-options');
        
        // 라이트박스에서 마우스가 나가면 닫기
        if (lightbox) {
            lightbox.addEventListener('mouseleave', () => {
                this.close();
            });
        }
        
        // 스타일 옵션 영역에서 마우스가 나가면 닫기
        if (styleOptions) {
            styleOptions.addEventListener('mouseleave', () => {
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
        const image = document.getElementById('lightbox-image');

        if (lightbox && image) {
            image.src = src;
            image.alt = alt;
            lightbox.classList.add('active');
            // 호버 모드에서는 body 스크롤 유지
            
            console.log('🖼️ 라이트박스 열림 (호버):', alt);
        }
    },

    close() {
        const lightbox = document.getElementById('image-lightbox');

        if (lightbox) {
            lightbox.classList.remove('active');
            
            console.log('🖼️ 라이트박스 닫힘 (호버)');
        }
    }
};

// 전역 함수로 노출
window.ImageLightbox = ImageLightbox;
