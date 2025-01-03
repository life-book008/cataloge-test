document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Fetch and parse the JSON data
        const response = await fetch('t.json');
        const data = await response.json();
        const taxonomy = data.taxonomy;

        // Cache DOM elements
        const selects = {
            kingdom: document.getElementById('kingdom'),
            phylum: document.getElementById('phylum'),
            class: document.getElementById('class'),
            order: document.getElementById('order'),
            family: document.getElementById('family'),
            genus: document.getElementById('genus')
        };

        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');
        const speciesSection = document.getElementById('speciesSection');
        const speciesGrid = document.getElementById('speciesGrid');

        // Initialize search functionality (بالاعتماد على الحقول العربية فقط)
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim().toLowerCase();
            
            if (query.length < 2) {
                searchResults.classList.remove('show');
                return;
            }

            searchTimeout = setTimeout(() => {
                const results = searchTaxonomy(query, taxonomy);
                displaySearchResults(results, query);
            }, 300);
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                searchResults.classList.remove('show');
            }
        });

        // =========================================================
        // ===============      دوال البحث      ====================
        // =========================================================
        function searchTaxonomy(query, taxonomyData) {
            const results = [];
            
            taxonomyData.forEach(item => {
                const species = item.Species;
                const matchScore = calculateMatchScore(query, species);
                
                if (matchScore > 0) {
                    results.push({
                        species,
                        path: {
                            kingdom: item.Kingdom,
                            phylum: item.Phylum,
                            class: item.Class,
                            order: item.Order,
                            family: item.Family,
                            genus: item.Genus
                        },
                        score: matchScore
                    });
                }
            });

            // أعد الخمسة الأوائل حسب الأعلى في درجة التطابق
            return results.sort((a, b) => b.score - a.score).slice(0, 5);
        }

        function calculateMatchScore(query, species) {
            let score = 0;
            // البحث في جميع الحقول العربية والإنجليزية
            const searchFields = [
                species.Arabic,
                species.English,
                species.Description?.Arabic,
                species.Description?.English,
                species.Habitat?.Arabic,
                species.Habitat?.English,
                ...(species.LocalNames?.Arabic || []),
                ...(species.LocalNames?.English || []),
                ...(species.LocalNames?.Regional?.map(r => r.Name) || [])
            ];

            // تنظيف النص المدخل
            query = query.trim().toLowerCase();
            
            searchFields.forEach((field, index) => {
                if (!field) return;
                
                const fieldLower = field.toString().toLowerCase();
                
                // التطابق التام
                if (fieldLower === query) {
                    score += 10;
                }
                // البداية بالنص المدخل
                else if (fieldLower.startsWith(query)) {
                    score += 8;
                }
                // يحتوي على النص المدخل
                else if (fieldLower.includes(query)) {
                    // وزن أعلى للاسم الرئيسي (العربي والإنجليزي)
                    if (index <= 1) {
                        score += 6;
                    } else {
                        score += 4;
                    }
                }
                
                // البحث عن كلمات منفصلة
                const queryWords = query.split(/\s+/);
                if (queryWords.length > 1) {
                    const fieldWords = fieldLower.split(/\s+/);
                    queryWords.forEach(word => {
                        if (fieldWords.some(fw => fw.includes(word))) {
                            score += 2;
                        }
                    });
                }
            });

            return score;
        }

        function displaySearchResults(results, query) {
            if (results.length === 0) {
                searchResults.classList.remove('show');
                return;
            }

            const resultsHtml = results.map(result => {
                const { species, path } = result;
                const pathString = `
                  ${path.kingdom.Arabic} >
                  ${path.phylum.Arabic} >
                  ${path.class.Arabic} >
                  ${path.order.Arabic} >
                  ${path.family.Arabic} >
                  ${path.genus.Arabic}
                `;
                
                // صياغة الأسماء المحلية (عربية فقط)
                const localNamesString = formatLocalNames(species.LocalNames);

                return `
                    <div class="search-result-item"
                         data-path='${JSON.stringify(path)}'
                         data-species='${JSON.stringify(species)}'>
                        <div class="result-name-ar">
                            ${highlightText(species.Arabic, query)}
                            ${
                              localNamesString
                                ? `<span class="local-names">${highlightText(localNamesString, query)}</span>`
                                : ''
                            }
                        </div>
                        <!-- حذف/تعطيل أي عرض للاسم الإنجليزي للنوع -->
                        <!-- <div class="result-name-en"></div> -->

                        <div class="result-path">${pathString}</div>
                    </div>
                `;
            }).join('');

            searchResults.innerHTML = resultsHtml;
            searchResults.classList.add('show');

            // Add click handlers to results
            document.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const path = JSON.parse(item.dataset.path);
                    const species = JSON.parse(item.dataset.species);
                    selectTaxonomyPath(path, species);
                });
            });
        }

        function highlightText(text, query) {
            if (!query) return text;
            const regex = new RegExp(`(${query})`, 'gi');
            return text.replace(regex, '<span class="highlight">$1</span>');
        }

        // =========================================================
        // ==========   اختيار مسار التصنيف من البحث   =============
        // =========================================================
        async function selectTaxonomyPath(path, selectedSpecies) {
            // Select each level in sequence
            for (const [level, value] of Object.entries(path)) {
                const select = selects[level.toLowerCase()];
                select.value = JSON.stringify(value);
                await handleSelection(level.toLowerCase());
            }
            searchResults.classList.remove('show');
            searchInput.value = '';

            // انتظر قليلاً حتى يتم تحميل الكروت
            await new Promise(resolve => setTimeout(resolve, 100));

            // ابحث عن الكارت المطابق
            const cards = document.querySelectorAll('.species-card');
            let matchingCard = null;

            for (const card of cards) {
                const arabicName = card.querySelector('.species-name-ar')?.textContent;
                // لن نعتمد على الاسم الإنجليزي
                if (selectedSpecies && (arabicName === selectedSpecies.Arabic)) {
                    matchingCard = card;
                    break;
                }
            }

            // If we found a matching card, scroll to it and open details
            if (matchingCard) {
                matchingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                matchingCard.classList.add('highlight-species');
                setTimeout(() => {
                    matchingCard.classList.remove('highlight-species');
                }, 1500);

                // فتح التفاصيل
                const detailsBtn = matchingCard.querySelector('.show-details-btn');
                const detailsSection = matchingCard.querySelector('.species-details');
                if (detailsBtn && detailsSection) {
                    detailsSection.classList.add('show');
                    detailsBtn.innerHTML = '<i class="bi bi-x-circle"></i> إخفاء التفاصيل';
                }
            }
        }

        // =========================================================
        // =============   إنشاء الكروت وعرض المعلومات   ===========
        // =========================================================
        function formatLocalNames(localNames) {
            if (!localNames) return '';
            const parts = [];
            
            // الأسماء العربية
            if (localNames.Arabic?.length > 0) {
                parts.push(`(${localNames.Arabic.join(' - ')})`);
            }
            
            // الأسماء الإقليمية
            if (localNames.Regional?.length > 0) {
                const regionalParts = localNames.Regional.map(r => 
                    `${r.Name} (${r.Region})`
                );
                parts.push(`(${regionalParts.join(' - ')})`);
            }
            
            return parts.join(' ');
        }

        function generateClassificationString(taxonomyItem) {
            // هنا نعرض التصنيفات بالعربية والإنجليزية فقط للمستويات
            const levels = {
                Kingdom: { ar: "مملكة", en: "Kingdom" },
                Phylum: { ar: "شعبة", en: "Phylum" },
                Class: { ar: "صف", en: "Class" },
                Order: { ar: "رتبة", en: "Order" },
                Family: { ar: "فصيلة", en: "Family" },
                Genus: { ar: "جنس", en: "Genus" }
            };

            // Arabic classification
            const arabicParts = Object.entries(levels).map(([level, names]) => 
                `${names.ar} ${taxonomyItem[level].Arabic}`
            );
            const arabicString = arabicParts.join(" - ");

            // English classification
            const englishParts = Object.entries(levels).map(([level, names]) =>
                // في حال عدم وجود أي قيمة إنجليزية، استخدم فراغ بدلًا من undefined
                `${names.en} ${taxonomyItem[level].English || ''}`
            );
            const englishString = englishParts.join(" - ");

            return {
                Arabic: arabicString,
                English: englishString
            };
        }

        function createSpeciesCard(species, taxonomyItem) {
            const template = document.getElementById('speciesCardTemplate');
            const card = template.content.cloneNode(true);
            
            // الاسم العربي
            card.querySelector('.species-name-ar').textContent = species.Arabic;

            // (إن لم تعد بحاجة لعرض الاسم الإنجليزي في الكارت، احذف السطر التالي أو العنصر من الـHTML)
            // card.querySelector('.species-name-en').style.display = 'none';

            // الأسماء المحلية
            const localNamesString = formatLocalNames(species.LocalNames);
            if (localNamesString) {
                const localNamesElement = document.createElement('div');
                localNamesElement.className = 'species-local-names';
                localNamesElement.innerHTML = localNamesString;
                // ندرجها بعد الاسم العربي
                card.querySelector('.species-name-ar').after(localNamesElement);
            }
            
            // الوصف (عربي فقط)
            card.querySelector('.species-description').innerHTML = `
                ${species.Description?.Arabic || '—'}<br>
            `;
            
            // الموطن (عربي فقط)
            card.querySelector('.species-habitat').innerHTML = `
                ${species.Habitat?.Arabic || '—'}<br>
            `;
            
            // التصنيف بالعربية والإنجليزية (للمستويات فقط)
            const classification = generateClassificationString(taxonomyItem);
            card.querySelector('.species-classification').innerHTML = `
                <div class="text-end mb-2">${classification.Arabic}</div>
                <small class="text-muted">${classification.English}</small>
            `;
            
            // المراجع والوسائط
            const referencesContainer = card.querySelector('.species-references');
            
            const references = (species.References || []).map(ref => `
                <a href="${ref.URL}" 
                   target="_blank" 
                   class="${ref.Type === 'reference' ? 'reference-link' : 'image-link'}"
                   rel="noopener noreferrer">
                    <i class="bi bi-${ref.Type === 'reference' ? 'journal-text' : 'images'}"></i>
                    ${ref.Title}
                </a>
            `);

            // الوسائط (صور + فيديو) - نعرض captions بالعربية
            if (species.Media) {
                if (species.Media.Images) {
                    references.push(...species.Media.Images.map(img => `
                        <a href="${img.URL}" 
                           target="_blank" 
                           class="image-link"
                           rel="noopener noreferrer"
                           title="${img.Caption?.Arabic || ''}">
                            <i class="bi bi-image"></i>
                            ${img.Caption?.Arabic || 'صورة'}
                        </a>
                    `));
                }
                
                if (species.Media.Videos) {
                    references.push(...species.Media.Videos.map(video => `
                        <a href="${video.URL}" 
                           target="_blank" 
                           class="video-link"
                           rel="noopener noreferrer"
                           title="${video.Caption?.Arabic || ''}">
                            <i class="bi bi-play-circle"></i>
                            ${video.Caption?.Arabic || 'فيديو'}
                        </a>
                    `));
                }
            }
            
            referencesContainer.innerHTML = references.join('');
            
            // زر إظهار التفاصيل
            const detailsBtn = card.querySelector('.show-details-btn');
            const detailsSection = card.querySelector('.species-details');
            
            detailsBtn.addEventListener('click', () => {
                const isShowing = detailsSection.classList.contains('show');
                if (isShowing) {
                    detailsSection.classList.remove('show');
                    detailsBtn.innerHTML = '<i class="bi bi-info-circle"></i> مزيد من التفاصيل';
                } else {
                    detailsSection.classList.add('show');
                    detailsBtn.innerHTML = '<i class="bi bi-x-circle"></i> إخفاء التفاصيل';
                }
            });
            
            return card;
        }

        // =========================================================
        // ============= تعبئة الـ Select والفلترة =================
        // =========================================================
        function fillSelect(select, options) {
            const fragment = document.createDocumentFragment();
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'اختر... | Select...';
            fragment.appendChild(defaultOption);

            const levels = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'];
            const currentLevel = Object.entries(selects).find(([_, s]) => s === select)[0];
            const currentIndex = levels.indexOf(currentLevel);
            
            // لو المستوى السابق غير محدد، نعطله
            if (currentIndex > 0) {
                const previousSelect = selects[levels[currentIndex - 1]];
                if (!previousSelect.value) {
                    select.disabled = true;
                    select.innerHTML = '';
                    select.appendChild(defaultOption);
                    return;
                }
            }
            
            select.disabled = false;
            options.sort(englishSort);  // ترتيب حسب الاسم الإنجليزي للتصنيف

            options.forEach(option => {
                const opt = document.createElement('option');
                // نعتمد على Arabic + English في عرض التصنيف فقط
                opt.value = JSON.stringify(option);
                opt.textContent = `${option.Arabic} | ${option.English}`;
                fragment.appendChild(opt);
            });

            select.innerHTML = '';
            select.appendChild(fragment);
        }

        // ترتيب العناصر حسب الاسم الإنجليزي (للمستويات فقط)
        function englishSort(a, b) {
            return (a.English || '').localeCompare(b.English || '');
        }

        async function handleSelection(changedLevel) {
            const levels = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'];
            const currentIndex = levels.indexOf(changedLevel);
            
            // إعادة تعيين المستويات اللاحقة
            for (let i = currentIndex + 1; i < levels.length; i++) {
                const selectElement = selects[levels[i]];
                selectElement.innerHTML = '<option value="">اختر... | Select...</option>';
                selectElement.disabled = true;
                selectElement.parentElement.classList.remove('active');
            }

            // إخفاء قسم الأنواع
            speciesSection.classList.remove('show');

            // التأكد من تحديد جميع المستويات السابقة
            for (let i = 0; i < currentIndex; i++) {
                if (!selects[levels[i]].value) {
                    return;
                }
            }

            // فلترة البيانات حسب الاختيارات
            let filteredData = taxonomy;
            for (let i = 0; i <= currentIndex; i++) {
                const level = levels[i];
                const selected = selects[level].value;
                if (selected) {
                    const selectedValue = JSON.parse(selected);
                    filteredData = filteredData.filter(item => 
                        // نعتمد على اسم التصنيف بالإنجليزية
                        item[level.charAt(0).toUpperCase() + level.slice(1)].English === selectedValue.English
                    );
                }
            }

            // ملء المستوى التالي إن وُجد
            if (currentIndex < levels.length - 1) {
                const nextLevel = levels[currentIndex + 1];
                const nextLevelKey = nextLevel.charAt(0).toUpperCase() + nextLevel.slice(1);
                const uniqueOptions = new Set();
                
                filteredData.forEach(item => {
                    uniqueOptions.add(JSON.stringify(item[nextLevelKey]));
                });
                
                const nextSelect = selects[nextLevel];
                nextSelect.disabled = false;
                fillSelect(nextSelect, Array.from(uniqueOptions).map(o => JSON.parse(o)));
                nextSelect.parentElement.classList.add('active');
            }

            // عرض الأنواع (species) إن وصلنا للمستوى الأخير
            if (currentIndex === levels.length - 1 && selects[changedLevel].value) {
                speciesGrid.innerHTML = '';
                const fragment = document.createDocumentFragment();
                filteredData.forEach(item => {
                    fragment.appendChild(createSpeciesCard(item.Species, item));
                });
                speciesGrid.appendChild(fragment);
                speciesSection.classList.add('show');
            }

            return new Promise(resolve => setTimeout(resolve, 0));
        }

        // =========================================================
        // =============  تهيئة المستوى الأول + الأحداث  ==========
        // =========================================================
        const uniqueKingdoms = new Set();
        taxonomy.forEach(item => {
            uniqueKingdoms.add(JSON.stringify(item.Kingdom));
        });
        fillSelect(selects.kingdom, Array.from(uniqueKingdoms).map(k => JSON.parse(k)));
        
        // Add change event listeners to all selects
        Object.entries(selects).forEach(([level, select]) => {
            select.addEventListener('change', () => handleSelection(level));
        });

        // =========================================================
        //   دالة اختيارية لتحديث تاريخ آخر تعديل (في الفوتر)
        // =========================================================
        async function updateLastModified() {
            try {
                const response = await fetch('t.json');
                const lastModified = new Date(response.headers.get('last-modified'));
                const options = { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                };
                document.querySelector('#last-modified span').textContent = 
                    lastModified.toLocaleDateString('ar-SA', options);
            } catch (error) {
                console.error('Error getting last modified date:', error);
            }
        }

        // استدعِ الدالة إن كان لديك عنصر في الفوتر يعرض آخر تعديل
        updateLastModified();

    } catch (error) {
        console.error('Error loading taxonomy data:', error);
    }
});
