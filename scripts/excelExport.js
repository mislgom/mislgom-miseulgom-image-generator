/**
 * 미슬곰 이미지 자동 생성기 v1.0 - 엑셀 내보내기 모듈
 * SheetJS를 사용한 엑셀 파일 생성 및 이미지 삽입
 */

const ExcelExport = {
    // 등장인물 이미지만 다운로드 (ZIP)
    async downloadCharacterImagesOnly(characters) {
        try {
            console.log('📊 등장인물 이미지 ZIP 생성 중...');

            const zip = new JSZip();
            const folder = zip.folder('characters');

            // 이미지 다운로드 및 ZIP에 추가
            for (const char of characters) {
                if (char.imageUrl) {
                    try {
                        const response = await fetch(char.imageUrl);
                        const blob = await response.blob();
                        const filename = `${char.name}_${char.nameEn || 'character'}.png`;
                        folder.file(filename, blob);
                    } catch (error) {
                        console.error(`이미지 다운로드 실패: ${char.name}`, error);
                    }
                }
            }

            // ZIP 생성 및 다운로드
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `등장인물_이미지_${this.getTimestamp()}.zip`);

        } catch (error) {
            console.error('❌ ZIP 생성 오류:', error);
            throw error;
        }
    },

    // 등장인물 엑셀만 다운로드
    async exportCharactersExcelOnly(characters) {
        try {
            console.log('📊 등장인물 엑셀 생성 중...');

            // 워크북 생성
            const wb = XLSX.utils.book_new();

            // 데이터 준비 (이미지 URL 포함)
            const data = [
                ['이미지 URL', '이름', '영문 이름', '설명', '한글 프롬프트', '영문 프롬프트']
            ];

            characters.forEach((char) => {
                data.push([
                    char.imageUrl || '',
                    char.name,
                    char.nameEn || '',
                    char.description || '',
                    char.promptKo || '',
                    char.promptEn || ''
                ]);
            });

            // 워크시트 생성
            const ws = XLSX.utils.aoa_to_sheet(data);

            // 열 너비 설정
            ws['!cols'] = [
                { wch: 50 },  // 이미지 URL
                { wch: 15 },  // 이름
                { wch: 20 },  // 영문 이름
                { wch: 40 },  // 설명
                { wch: 60 },  // 한글 프롬프트
                { wch: 60 }   // 영문 프롬프트
            ];

            // 행 높이 설정
            ws['!rows'] = [{ hpt: 25 }]; // 헤더
            for (let i = 0; i < characters.length; i++) {
                ws['!rows'].push({ hpt: 120 }); // 데이터 행 높이
            }

            // 스타일 적용 (가운데 정렬, 자동 줄바꿈)
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!ws[cellAddress]) continue;

                    // 셀 스타일 설정
                    ws[cellAddress].s = {
                        alignment: {
                            horizontal: 'center',
                            vertical: 'center',
                            wrapText: true
                        },
                        font: {
                            name: '맑은 고딕',
                            sz: 11
                        }
                    };

                    // 헤더 스타일
                    if (R === 0) {
                        ws[cellAddress].s.font.bold = true;
                        ws[cellAddress].s.fill = {
                            fgColor: { rgb: 'E0E0E0' }
                        };
                    }
                }
            }

            // 워크시트 추가
            XLSX.utils.book_append_sheet(wb, ws, '등장인물');

            // 엑셀 파일 생성
            const excelBuffer = XLSX.write(wb, { 
                bookType: 'xlsx', 
                type: 'array',
                cellStyles: true
            });
            const excelBlob = new Blob([excelBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // 다운로드
            saveAs(excelBlob, `등장인물_${this.getTimestamp()}.xlsx`);

        } catch (error) {
            console.error('❌ 엑셀 생성 오류:', error);
            throw error;
        }
    },

    // 등장인물 엑셀 내보내기 (기존 호환)
    async exportCharacters(characters) {
        await this.exportCharactersExcelOnly(characters);
        await this.downloadCharacterImagesOnly(characters);
    },

    // 스토리보드 이미지만 다운로드 (ZIP)
    async downloadStoryboardImagesOnly(scenes) {
        try {
            const zip = new JSZip();

            // 파트별로 폴더 생성
            const partNumbers = [...new Set(scenes.map(s => s.partNumber))].sort((a, b) => a - b);

            for (const partNumber of partNumbers) {
                const partScenes = scenes.filter(s => s.partNumber === partNumber);
                const folder = zip.folder(`part${partNumber}`);

                // 이미지 다운로드 및 ZIP에 추가
                for (let i = 0; i < partScenes.length; i++) {
                    const scene = partScenes[i];
                    if (scene.imageUrl) {
                        try {
                            const response = await fetch(scene.imageUrl);
                            const blob = await response.blob();
                            const filename = `scene_${String(i + 1).padStart(3, '0')}.png`;
                            folder.file(filename, blob);
                        } catch (error) {
                            console.error(`이미지 다운로드 실패: 장면 ${i + 1}`, error);
                        }
                    }
                }
            }

            // ZIP 생성 및 다운로드
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `스토리보드_이미지_${this.getTimestamp()}.zip`);

        } catch (error) {
            console.error('❌ ZIP 생성 오류:', error);
            throw error;
        }
    },

    // 스토리보드 엑셀만 다운로드
    async exportStoryboardExcelOnly(scenes) {
        try {
            console.log('📊 스토리보드 엑셀 생성 중...');

            // 워크북 생성
            const wb = XLSX.utils.book_new();

            // 파트별로 분리
            const partNumbers = [...new Set(scenes.map(s => s.partNumber))].sort((a, b) => a - b);

            for (const partNumber of partNumbers) {
                const partScenes = scenes.filter(s => s.partNumber === partNumber);

                // 데이터 준비
                const data = [
                    ['이미지 URL', '장면 번호', '대본 구간', '한글 프롬프트', '영문 프롬프트']
                ];

                partScenes.forEach((scene, index) => {
                    data.push([
                        scene.imageUrl || '',
                        `장면 ${index + 1}`,
                        scene.scriptText || '',
                        scene.promptKo || '',
                        scene.promptEn || ''
                    ]);
                });

                // 워크시트 생성
                const ws = XLSX.utils.aoa_to_sheet(data);

                // 열 너비 설정
                ws['!cols'] = [
                    { wch: 50 },  // 이미지 URL
                    { wch: 12 },  // 장면 번호
                    { wch: 60 },  // 대본 구간
                    { wch: 60 },  // 한글 프롬프트
                    { wch: 60 }   // 영문 프롬프트
                ];

                // 행 높이 설정
                ws['!rows'] = [{ hpt: 25 }]; // 헤더
                for (let i = 0; i < partScenes.length; i++) {
                    ws['!rows'].push({ hpt: 120 }); // 데이터 행
                }

                // 스타일 적용
                const range = XLSX.utils.decode_range(ws['!ref']);
                for (let R = range.s.r; R <= range.e.r; ++R) {
                    for (let C = range.s.c; C <= range.e.c; ++C) {
                        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                        if (!ws[cellAddress]) continue;

                        ws[cellAddress].s = {
                            alignment: {
                                horizontal: 'center',
                                vertical: 'center',
                                wrapText: true
                            },
                            font: {
                                name: '맑은 고딕',
                                sz: 11
                            }
                        };

                        // 헤더 스타일
                        if (R === 0) {
                            ws[cellAddress].s.font.bold = true;
                            ws[cellAddress].s.fill = {
                                fgColor: { rgb: 'E0E0E0' }
                            };
                        }
                    }
                }

                // 워크시트 추가
                XLSX.utils.book_append_sheet(wb, ws, `파트 ${partNumber}`);
            }

            // 엑셀 파일 생성
            const excelBuffer = XLSX.write(wb, { 
                bookType: 'xlsx', 
                type: 'array',
                cellStyles: true
            });
            const excelBlob = new Blob([excelBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // 다운로드
            saveAs(excelBlob, `스토리보드_${this.getTimestamp()}.xlsx`);

        } catch (error) {
            console.error('❌ 엑셀 생성 오류:', error);
            throw error;
        }
    },

    // 스토리보드 엑셀 내보내기 (기존 호환)
    async exportStoryboard(scenes) {
        await this.exportStoryboardExcelOnly(scenes);
        await this.downloadStoryboardImagesOnly(scenes);
    },

    // 타임스탬프 생성
    getTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        return `${year}${month}${day}_${hours}${minutes}`;
    }
};

// 전역 함수로 노출
window.ExcelExport = ExcelExport;
