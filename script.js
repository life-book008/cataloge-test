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

        // Initialize search functionality
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

        function searchTaxonomy(query, taxonomy) {
            const results = [];
            
            taxonomy.forEach(item => {
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

            return results.sort((a, b) => b.score - a.score).slice(0, 5);
        }

        function calculateMatchScore(query, species) {
            let score = 0;
            const searchFields = [
                species.Arabic,
                species.English,
                species.Description.Arabic,
                species.Description.English,
                ...(species.LocalNames?.Arabic || []),
                ...(species.LocalNames?.English || []),
                ...(species.LocalNames?.Regional?.map(r => r.Name) || [])
            ];

            searchFields.forEach((field, index) => {
                if (!field) return;
                const fieldLower = field.toLowerCase();
                if (fieldLower.includes(query)) {
                    // Give higher score for matches in name vs description
                    score += index < 2 ? 4 : // Official names
                            index < 4 ? 2 : // Descriptions
                            3; // Local names
                    // Bonus for exact matches
                    if (fieldLower === query) score += 5;
                    // Bonus for starts with
                    if (fieldLower.startsWith(query)) score += 2;
                }
            });

            return score;
        }

        function formatLocalNames(localNames) {
            if (!localNames) return '';
            
            const parts = [];
            
            // Add Arabic local names
            if (localNames.Arabic?.length > 0) {
                parts.push(`(${localNames.Arabic.join(' - ')})`);
            }
            
            // Add English local names
            if (localNames.English?.length > 0) {
                parts.push(`(${localNames.English.join(' - ')})`);
            }
            
            // Add Regional names with their regions
            if (localNames.Regional?.length > 0) {
                const regionalParts = localNames.Regional.map(r => 
                    `${r.Name} (${r.Region})`
                );
                parts.push(`(${regionalParts.join(' - ')})`);
            }
            
            return parts.join(' ');
        }

        function displaySearchResults(results, query) {
            if (results.length === 0) {
                searchResults.classList.remove('show');
                return;
            }

            const resultsHtml = results.map(result => {
                const { species, path } = result;
                const pathString = `${path.kingdom.Arabic} > ${path.phylum.Arabic} > ${path.class.Arabic} > ${path.order.Arabic} > ${path.family.Arabic} > ${path.genus.Arabic}`;
                const localNamesString = formatLocalNames(species.LocalNames);
                
                return `
                    <div class="search-result-item" data-path='${JSON.stringify(path)}' data-species='${JSON.stringify(species)}'>
                        <div class="result-name-ar">
                            ${highlightText(species.Arabic, query)}
                            ${localNamesString ? `<span class="local-names">${highlightText(localNamesString, query)}</span>` : ''}
                        </div>
                        <div class="result-name-en">
                            ${highlightText(species.English, query)}
                        </div>
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

        async function selectTaxonomyPath(path, selectedSpecies) {
            // Select each level in sequence
            for (const [level, value] of Object.entries(path)) {
                const select = selects[level.toLowerCase()];
                select.value = JSON.stringify(value);
                await handleSelection(level.toLowerCase());
            }
            searchResults.classList.remove('show');
            searchInput.value = '';

            // Wait a bit for the content to be rendered
            await new Promise(resolve => setTimeout(resolve, 100));

            // Find all species cards
            const cards = document.querySelectorAll('.species-card');
            let matchingCard = null;

            // Find the card that matches the selected species
            for (const card of cards) {
                const arabicName = card.querySelector('.species-name-ar')?.textContent;
                const englishName = card.querySelector('.species-name-en')?.textContent;
                
                if (selectedSpecies && (
                    arabicName === selectedSpecies.Arabic ||
                    englishName === selectedSpecies.English
                )) {
                    matchingCard = card;
                    break;
                }
            }

            // If we found a matching card, scroll to it and open details
            if (matchingCard) {
                // Scroll into view
                matchingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Add highlight effect
                matchingCard.classList.add('highlight-species');
                setTimeout(() => {
                    matchingCard.classList.remove('highlight-species');
                }, 1500);
                
                // Find and click the details button to open it
                const detailsBtn = matchingCard.querySelector('.show-details-btn');
                const detailsSection = matchingCard.querySelector('.species-details');
                if (detailsBtn && detailsSection) {
                    detailsSection.classList.add('show');
                    detailsBtn.innerHTML = '<i class="bi bi-x-circle"></i> إخفاء التفاصيل';
                }
            }
        }

        function generateClassificationString(taxonomyItem) {
            const levels = {
                Kingdom: { ar: "مملكة", en: "Kingdom" },
                Phylum: { ar: "شعبة", en: "Phylum" },
                Class: { ar: "صف", en: "Class" },
                Order: { ar: "رتبة", en: "Order" },
                Family: { ar: "فصيلة", en: "Family" },
                Genus: { ar: "جنس", en: "Genus" }
            };

            // Generate Arabic classification
            const arabicParts = Object.entries(levels).map(([level, names]) => 
                `${names.ar} ${taxonomyItem[level].Arabic}`
            );
            const arabicString = arabicParts.join(" - ");

            // Generate English classification
            const englishParts = Object.entries(levels).map(([level, names]) => 
                `${names.en} ${taxonomyItem[level].English}`
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
            
            // Set basic information
            card.querySelector('.species-name-ar').textContent = species.Arabic;
            card.querySelector('.species-name-en').textContent = species.English;
            
            // Add local names if available
            const localNamesString = formatLocalNames(species.LocalNames);
            if (localNamesString) {
                const localNamesElement = document.createElement('div');
                localNamesElement.className = 'species-local-names';
                localNamesElement.innerHTML = localNamesString;
                card.querySelector('.species-name-en').after(localNamesElement);
            }
            
            // Set detailed information
            card.querySelector('.species-description').innerHTML = `
                ${species.Description.Arabic}<br>
                <small class="text-muted">${species.Description.English}</small>
            `;
            
            card.querySelector('.species-habitat').innerHTML = `
                ${species.Habitat.Arabic}<br>
                <small class="text-muted">${species.Habitat.English}</small>
            `;
            
            // Generate and set classification string
            const classification = generateClassificationString(taxonomyItem);
            card.querySelector('.species-classification').innerHTML = `
                <div class="text-end mb-2">${classification.Arabic}</div>
                <small class="text-muted">${classification.English}</small>
            `;
            
            // Set references and media
            const referencesContainer = card.querySelector('.species-references');
            
            // Add references
            const references = species.References.map(ref => `
                <a href="${ref.URL}" 
                   target="_blank" 
                   class="${ref.Type === 'reference' ? 'reference-link' : 'image-link'}"
                   rel="noopener noreferrer">
                    <i class="bi bi-${ref.Type === 'reference' ? 'journal-text' : 'images'}"></i>
                    ${ref.Title}
                </a>
            `);

            // Add media if available
            if (species.Media) {
                if (species.Media.Images) {
                    references.push(...species.Media.Images.map(img => `
                        <a href="${img.URL}" 
                           target="_blank" 
                           class="image-link"
                           rel="noopener noreferrer"
                           title="${img.Caption.Arabic} | ${img.Caption.English}">
                            <i class="bi bi-image"></i>
                            ${img.Caption.Arabic}
                        </a>
                    `));
                }
                
                if (species.Media.Videos) {
                    references.push(...species.Media.Videos.map(video => `
                        <a href="${video.URL}" 
                           target="_blank" 
                           class="video-link"
                           rel="noopener noreferrer"
                           title="${video.Caption.Arabic} | ${video.Caption.English}">
                            <i class="bi bi-play-circle"></i>
                            ${video.Caption.Arabic}
                        </a>
                    `));
                }
            }
            
            referencesContainer.innerHTML = references.join('');
            
            // Add toggle functionality
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

        function fillSelect(select, options) {
            const fragment = document.createDocumentFragment();
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'اختر... | Select...';
            fragment.appendChild(defaultOption);

            // التحقق من أن المستوى السابق محدد
            const levels = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'];
            const currentLevel = Object.entries(selects).find(([_, s]) => s === select)[0];
            const currentIndex = levels.indexOf(currentLevel);
            
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
            options.sort(englishSort);
            
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = JSON.stringify(option);
                opt.textContent = `${option.Arabic} | ${option.English}`;
                fragment.appendChild(opt);
            });

            select.innerHTML = '';
            select.appendChild(fragment);
        }

        async function handleSelection(changedLevel) {
            const levels = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'];
            const currentIndex = levels.indexOf(changedLevel);
            
            // Reset subsequent selections
            for (let i = currentIndex + 1; i < levels.length; i++) {
                const selectElement = selects[levels[i]];
                selectElement.innerHTML = '<option value="">اختر... | Select...</option>';
                selectElement.disabled = true; // تعطيل المستويات التالية
                selectElement.parentElement.classList.remove('active');
            }

            // Hide species section
            speciesSection.classList.remove('show');

            // التحقق من أن جميع المستويات السابقة محددة
            for (let i = 0; i < currentIndex; i++) {
                if (!selects[levels[i]].value) {
                    return; // الخروج إذا كان أي مستوى سابق غير محدد
                }
            }

            // Filter data based on current selections
            let filteredData = taxonomy;
            for (let i = 0; i <= currentIndex; i++) {
                const level = levels[i];
                const selected = selects[level].value;
                if (selected) {
                    const selectedValue = JSON.parse(selected);
                    filteredData = filteredData.filter(item => 
                        item[level.charAt(0).toUpperCase() + level.slice(1)].English === selectedValue.English
                    );
                }
            }

            // Populate next level if available
            if (currentIndex < levels.length - 1) {
                const nextLevel = levels[currentIndex + 1];
                const nextLevelKey = nextLevel.charAt(0).toUpperCase() + nextLevel.slice(1);
                const uniqueOptions = new Set();
                
                filteredData.forEach(item => {
                    uniqueOptions.add(JSON.stringify(item[nextLevelKey]));
                });
                
                const nextSelect = selects[nextLevel];
                nextSelect.disabled = false; // تفعيل المستوى التالي فقط
                fillSelect(nextSelect, Array.from(uniqueOptions).map(o => JSON.parse(o)));
                nextSelect.parentElement.classList.add('active');
            }

            // Show species if all levels are selected
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

        // Initialize the first select (Kingdom)
        const uniqueKingdoms = new Set();
        taxonomy.forEach(item => {
            uniqueKingdoms.add(JSON.stringify(item.Kingdom));
        });
        fillSelect(selects.kingdom, Array.from(uniqueKingdoms).map(k => JSON.parse(k)));
        
        // Add change event listeners to all selects
        Object.entries(selects).forEach(([level, select]) => {
            select.addEventListener('change', () => handleSelection(level));
        });

        // دالة للترتيب بناءً على الاسم الإنجليزي
        function englishSort(a, b) {
            return (a.English || '').localeCompare(b.English || '');
        }

        function displaySpecies(speciesList) {
            const container = document.getElementById('species-container');
            container.innerHTML = '';
            
            if (!speciesList || speciesList.length === 0) {
                container.innerHTML = '<div class="no-species">لا توجد أنواع متاحة</div>';
                return;
            }

            // ترتيب الأنواع أبجدياً بناءً على الاسم الإنجليزي
            speciesList.sort(englishSort);

            const speciesHtml = speciesList.map(species => {
                return `
                    <div class="species-card">
                        <div class="species-name-ar">${species.Arabic}</div>
                        <div class="species-name-en">${species.English}</div>
                    </div>
                `;
            }).join('');

            container.innerHTML = speciesHtml;
        }

        // Update last modified date in footer
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

        // Call on page load
        updateLastModified();
    } catch (error) {
        console.error('Error loading taxonomy data:', error);
    }
});
