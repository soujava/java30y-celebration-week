/**
 * SouJava 30-Year Celebration Week - Event Application
 * Optimized JavaScript with Sessionize API integration
 * FIXES: Proper session scheduling, timezone handling, and data validation
 */

// Application State
const AppState = {
    eventData: null,
    currentTimezone: 'America/Sao_Paulo',
    isLoading: true,
    error: null,
    filters: {
        day: '',
        language: '',
        speaker: '',
        type: ''
    }
};

// Configuration
const CONFIG = {
    SESSIONIZE_API: 'https://sessionize.com/api/v2/f8z6beeh/view/All',
    CACHE_KEY: 'soujava_event_data',
    CACHE_DURATION: 30 * 60 * 1000, // 30 minutes
    FALLBACK_DATA: {
        sessions: [],
        speakers: [],
        categories: [],
        rooms: []
    }
};

// Utility Functions
const Utils = {
    formatTime(timeString, date, timezone) {
        try {
            const dateTime = new Date(`${date}T${timeString}:00`);
            return new Intl.DateTimeFormat('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: timezone,
                hour12: false
            }).format(dateTime);
        } catch (error) {
            console.error('Error formatting time:', error);
            return timeString;
        }
    },

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            }).format(date);
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateString;
        }
    },

    parseSessionizeTime(isoString) {
        try {
            const date = new Date(isoString);
            return {
                date: date.toISOString().split('T')[0],
                time: date.toTimeString().split(' ')[0].substring(0, 5),
                dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
                timestamp: date.getTime()
            };
        } catch (error) {
            console.error('Error parsing time:', error);
            return null;
        }
    },

    formatDateHeader(dateString) {
        try {
            const date = new Date(dateString + 'T00:00:00'); // Add time to ensure correct parsing
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
            console.log('formatDateHeader:', dateString, '->', dayName, monthDay);
            return `${dayName}, ${monthDay}`;
        } catch (error) {
            console.error('Error formatting date header:', error);
            return dateString;
        }
    },

    getInitials(name) {
        return name.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    },

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Cache Management
const CacheManager = {
    set(key, data) {
        try {
            const cacheData = {
                data,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('Failed to cache data:', error);
        }
    },

    get(key, maxAge = CONFIG.CACHE_DURATION) {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp > maxAge) {
                localStorage.removeItem(key);
                return null;
            }
            return data;
        } catch (error) {
            console.warn('Failed to retrieve cached data:', error);
            return null;
        }
    },

    clear(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn('Failed to clear cache:', error);
        }
    }
};

// Data Loader with Sessionize API
class DataLoader {
    static async loadEventData() {
        // Clear cache to force fresh data with new endpoint
        CacheManager.clear(CONFIG.CACHE_KEY);
        
        // Try cache first
        const cachedData = CacheManager.get(CONFIG.CACHE_KEY);
        if (cachedData) {
            console.log('Using cached data');
            return this.transformSessionizeData(cachedData);
        }

        try {
            console.log('Fetching from Sessionize API...');
            const response = await fetch(CONFIG.SESSIONIZE_API);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Cache the raw data
            CacheManager.set(CONFIG.CACHE_KEY, data);
            
            return this.transformSessionizeData(data);
        } catch (error) {
            console.error('Error loading from Sessionize:', error);
            
            // Try cached data regardless of age
            const oldCache = CacheManager.get(CONFIG.CACHE_KEY, Infinity);
            if (oldCache) {
                console.log('Using stale cached data due to API failure');
                return this.transformSessionizeData(oldCache);
            }
            
            throw new Error('Unable to load schedule. Please check your connection and refresh the page.');
        }
    }

    static transformSessionizeData(sessionizeData) {
        const transformed = {
            speakers: {},
            schedule: []
        };

        console.log('Raw Sessionize data:', sessionizeData);

        // Transform speakers
        if (sessionizeData.speakers) {
            sessionizeData.speakers.forEach(speaker => {
                transformed.speakers[speaker.id] = {
                    name: speaker.fullName,
                    title: speaker.tagLine || '',
                    bio: speaker.bio || '',
                    image: speaker.profilePicture || '',
                    social: this.extractSocialLinks(speaker.links)
                };
            });
        }

        // Create categories lookup
        const categoryLookup = {};
        if (sessionizeData.categories) {
            sessionizeData.categories.forEach(category => {
                category.items.forEach(item => {
                    categoryLookup[item.id] = {
                        name: item.name,
                        category: category.title
                    };
                });
            });
        }

        // Process sessions with actual timing data
        if (sessionizeData.sessions && sessionizeData.sessions.length > 0) {
            const validSessions = sessionizeData.sessions.filter(session => 
                session.title && 
                session.startsAt &&
                (!session.status || session.status === 'Accepted')
            );

            console.log('Processing', validSessions.length, 'valid sessions with timing data');
            
            validSessions.forEach(session => {
                const timeInfo = Utils.parseSessionizeTime(session.startsAt);
                if (!timeInfo) return;
                
                const transformedSession = {
                    id: session.id.toString(),
                    time: timeInfo.time,
                    title: session.title,
                    description: session.description || '',
                    language: this.getLanguageFromCategories(session.categoryItems, categoryLookup),
                    type: this.getTypeFromCategories(session.categoryItems, categoryLookup),
                    speakers: session.speakers || [],
                    startsAt: session.startsAt,
                    endsAt: session.endsAt,
                    timestamp: timeInfo.timestamp,
                    roomId: session.roomId,
                    room: sessionizeData.rooms?.find(r => r.id === session.roomId)?.name || ''
                };

                // Find or create day in schedule
                let daySchedule = transformed.schedule.find(day => day.date === timeInfo.date);
                if (!daySchedule) {
                    daySchedule = {
                        date: timeInfo.date,
                        dayName: timeInfo.dayName,
                        sessions: []
                    };
                    transformed.schedule.push(daySchedule);
                }

                daySchedule.sessions.push(transformedSession);
            });
        }

        // Sort schedule by date and sessions by time
        transformed.schedule.sort((a, b) => new Date(a.date) - new Date(b.date));
        transformed.schedule.forEach(day => {
            day.sessions.sort((a, b) => a.timestamp - b.timestamp);
        });

        console.log('Transformed data:', transformed);
        return transformed;
    }

    static extractSocialLinks(links) {
        const social = {};
        if (!links) return social;

        links.forEach(link => {
            const url = link.url.toLowerCase();
            if (url.includes('linkedin')) {
                social.linkedin = link.url;
            } else if (url.includes('twitter') || url.includes('x.com')) {
                social.twitter = link.url;
            }
        });

        return social;
    }

    static getLanguageFromCategories(categoryItems, categoryLookup) {
        if (!categoryItems || !Array.isArray(categoryItems)) return 'English';
        
        for (const itemId of categoryItems) {
            const category = categoryLookup[itemId];
            if (category && category.category === 'Language') {
                return category.name;
            }
        }
        return 'English'; // default
    }

    static getTypeFromCategories(categoryItems, categoryLookup) {
        if (!categoryItems || !Array.isArray(categoryItems)) return 'talk';
        
        for (const itemId of categoryItems) {
            const category = categoryLookup[itemId];
            if (category && category.category === 'Type') {
                return category.name.toLowerCase().replace(/\s+/g, '');
            }
        }
        return 'talk'; // default
    }
}

// Speaker Carousel Controller
class SpeakerCarousel {
    constructor() {
        this.container = document.getElementById('speakerCarousel');
        this.track = this.container?.querySelector('.carousel-track');
    }

    populate(speakers) {
        if (!this.track || !speakers) return;

        // Get all speakers and limit for carousel
        const availableSpeakers = Object.entries(speakers)
            .slice(0, 12); // Limit to 12 speakers for smooth animation

        if (availableSpeakers.length === 0) {
            this.track.innerHTML = '<div style="color: rgba(255,255,255,0.7); text-align: center; padding: 2rem;">Speakers coming soon...</div>';
            return;
        }

        // Duplicate speakers for seamless loop (double the list)
        const duplicatedSpeakers = [...availableSpeakers, ...availableSpeakers];
        
        const speakersHTML = duplicatedSpeakers.map(([id, speaker]) => {
            return `
                <a href="#speakers" class="carousel-speaker" data-speaker-id="${id}">
                    <img 
                        src="${speaker.image}" 
                        alt="${speaker.name}"
                        class="carousel-speaker-image"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                    >
                    <div class="carousel-speaker-fallback" style="display: none;">
                        ${Utils.getInitials(speaker.name)}
                    </div>
                    <div class="carousel-speaker-info">
                        <div class="carousel-speaker-name">${Utils.sanitizeHTML(speaker.name)}</div>
                        <div class="carousel-speaker-title">${Utils.sanitizeHTML(speaker.title)}</div>
                    </div>
                </a>
            `;
        }).join('');

        this.track.innerHTML = speakersHTML;
        this.bindEvents();
    }

    bindEvents() {
        // Carousel speakers are no longer clickable
        // Removed click events for carousel speakers
    }
}

// Image Preloader
class ImagePreloader {
    constructor() {
        this.loadedImages = new Set();
        this.preloadQueue = [];
    }

    preloadImage(src) {
        return new Promise((resolve, reject) => {
            if (this.loadedImages.has(src)) {
                resolve(src);
                return;
            }

            const img = new Image();
            img.onload = () => {
                this.loadedImages.add(src);
                resolve(src);
            };
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            img.src = src;
        });
    }

    async preloadSpeakerImages(speakers) {
        const imagePromises = Object.values(speakers)
            .filter(speaker => speaker.image)
            .map(speaker => this.preloadImage(speaker.image));

        try {
            await Promise.allSettled(imagePromises);
            console.log('Speaker images preloaded');
        } catch (error) {
            console.warn('Some speaker images failed to preload:', error);
        }
    }

    isImageLoaded(src) {
        return this.loadedImages.has(src);
    }
}

// Modal Handler
class ModalHandler {
    constructor() {
        this.speakerModal = document.getElementById('speakerModal');
        this.bindEvents();
    }

    bindEvents() {
        // Close modal events
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAll());
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeAll();
            });
        });
        
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAll();
            }
        });
    }

    showSpeaker(speakerId) {
        const speaker = AppState.eventData?.speakers[speakerId];
        
        if (!speaker) {
            console.warn('Speaker not found:', speakerId);
            return;
        }

        this.populateSpeakerContent(speaker);
        this.showModal(this.speakerModal);
    }

    populateSpeakerContent(speaker) {
        const elements = {
            image: document.getElementById('modalSpeakerImage'),
            name: document.getElementById('modalSpeakerName'),
            title: document.getElementById('modalSpeakerTitle'),
            bio: document.getElementById('modalSpeakerBio'),
            socialLinks: document.getElementById('modalSocialLinks')
        };

        if (elements.image) {
            elements.image.src = speaker.image;
            elements.image.alt = `Photo of ${speaker.name}`;
            elements.image.onerror = () => {
                elements.image.style.display = 'none';
            };
        }

        if (elements.name) {
            const isJavaChampion = speaker.name.includes('Barry Burd') || 
                                  speaker.name.includes('Michael Redlich') || 
                                  speaker.name.includes('Professor Isidro');
            
            elements.name.innerHTML = Utils.sanitizeHTML(speaker.name) + 
                (isJavaChampion ? '<span class="java-champion-badge"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm19 2c0 1.11-.89 2-2 2H2c-1.11 0-2-.89-2-2v-1h24v1z"/></svg>Java Champion</span>' : '');
        }
        if (elements.title) elements.title.textContent = speaker.title;
        if (elements.bio) elements.bio.innerHTML = Utils.sanitizeHTML(speaker.bio).replace(/\n/g, '<br>');

        if (elements.socialLinks) {
            elements.socialLinks.innerHTML = '';
            if (speaker.social) {
                Object.entries(speaker.social).forEach(([platform, url]) => {
                    const link = this.createSocialLink(platform, url);
                    elements.socialLinks.appendChild(link);
                });
            }
        }
    }

    createSocialLink(platform, url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.className = 'social-link';
        link.setAttribute('aria-label', `${platform} profile`);

        const icons = {
            linkedin: '<path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>',
            twitter: '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>'
        };

        link.innerHTML = `<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">${icons[platform] || icons.linkedin}</svg>`;
        return link;
    }

    showModal(modal) {
        this.closeAll();
        modal.classList.add('active');
        modal.classList.add('loading');
        document.body.style.overflow = 'hidden';
        
        // Simulate loading state
        setTimeout(() => {
            modal.classList.remove('loading');
        }, 300);
        
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) closeBtn.focus();
    }

    closeAll() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
}

// Filter Controller
class FilterController {
    constructor(scheduleRenderer) {
        this.scheduleRenderer = scheduleRenderer;
        this.bindEvents();
    }

    initializeFilters() {
        this.populateDayFilter();
        this.populateSpeakerFilter();
    }

    populateDayFilter() {
        const dayFilter = document.getElementById('day-filter');
        if (!dayFilter || !AppState.eventData?.schedule) return;

        // Clear existing options except the first one
        const firstOption = dayFilter.firstElementChild;
        if (firstOption) {
            dayFilter.innerHTML = '';
            dayFilter.appendChild(firstOption);
        } else {
            dayFilter.innerHTML = '<option value="">All Days</option>';
        }

        AppState.eventData.schedule.forEach(day => {
            const option = document.createElement('option');
            option.value = day.date;
            // Format as "Monday, June 16" instead of just "Monday"
            const dateObj = new Date(day.date + 'T00:00:00');
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
            const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            option.textContent = `${dayName}, ${monthDay}`;
            dayFilter.appendChild(option);
        });
    }

    populateSpeakerFilter() {
        const speakerFilter = document.getElementById('speaker-filter');
        if (!speakerFilter || !AppState.eventData?.speakers) return;

        // Clear existing options except the first one
        const firstOption = speakerFilter.firstElementChild;
        if (firstOption) {
            speakerFilter.innerHTML = '';
            speakerFilter.appendChild(firstOption);
        } else {
            speakerFilter.innerHTML = '<option value="">All Speakers</option>';
        }

        // Show all speakers in filter
        const allSpeakers = Object.entries(AppState.eventData.speakers)
            .sort(([,a], [,b]) => a.name.localeCompare(b.name));

        allSpeakers.forEach(([id, speaker]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = speaker.name;
            speakerFilter.appendChild(option);
        });
    }

    bindEvents() {
        const filterSelects = ['day-filter', 'language-filter', 'speaker-filter', 'type-filter'];
        
        filterSelects.forEach(filterId => {
            const filter = document.getElementById(filterId);
            if (filter) {
                filter.addEventListener('change', () => this.applyFilters());
            }
        });

        const clearButton = document.getElementById('clear-filters');
        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearFilters());
        }
    }

    applyFilters() {
        AppState.filters = {
            day: document.getElementById('day-filter')?.value || '',
            language: document.getElementById('language-filter')?.value || '',
            speaker: document.getElementById('speaker-filter')?.value || '',
            type: document.getElementById('type-filter')?.value || ''
        };

        // Update clear button state
        const activeFilters = Object.values(AppState.filters).filter(v => v).length;
        const clearButton = document.getElementById('clear-filters');
        if (clearButton) {
            clearButton.setAttribute('data-active', activeFilters > 0);
        }

        this.scheduleRenderer.applyFilters();
    }

    clearFilters() {
        ['day-filter', 'language-filter', 'speaker-filter', 'type-filter'].forEach(filterId => {
            const filter = document.getElementById(filterId);
            if (filter) filter.value = '';
        });

        AppState.filters = { day: '', language: '', speaker: '', type: '' };
        this.scheduleRenderer.applyFilters();
    }
}

// Schedule Renderer
class ScheduleRenderer {
    constructor(modalHandler) {
        this.container = document.getElementById('schedule-container');
        this.modalHandler = modalHandler;
    }

    render() {
        if (!AppState.eventData?.schedule || AppState.eventData.schedule.length === 0) {
            this.renderError('No schedule data available');
            return;
        }

        try {
            let scheduleHTML = '';
            
            AppState.eventData.schedule.forEach((day, dayIndex) => {
                scheduleHTML += `
                    <div class="day-group" data-day="${day.date}">
                        <h3 class="day-header">${Utils.formatDateHeader(day.date)}</h3>
                `;
                
                day.sessions.forEach(session => {
                    scheduleHTML += this.renderSession(session, day.date);
                });

                scheduleHTML += '</div>';
            });

            this.container.innerHTML = scheduleHTML;
            this.bindEvents();
            this.applyFilters();
        } catch (error) {
            console.error('Error rendering schedule:', error);
            this.renderError('Error displaying schedule');
        }
    }

    renderSession(session, date) {
        const speakers = session.speakers.map(speakerId => this.renderSpeaker(speakerId)).join('');
        const formattedTime = Utils.formatTime(session.time, date, AppState.currentTimezone);
        const speakerNames = session.speakers.map(speakerId => {
            const speaker = AppState.eventData.speakers[speakerId];
            return speaker ? speaker.name : 'Speaker';
        }).join(', ');
        
        // Use CSS classes instead of JavaScript media queries for responsive layout
        return `
            <div class="session" 
                 data-session-id="${session.id}"
                 data-language="${session.language.toLowerCase()}"
                 data-speakers="${session.speakers.join(',')}"
                 data-type="${session.type}"
                 data-day="${date}"
                 tabindex="0"
                 role="button"
                 aria-expanded="false"
                 aria-label="Session: ${session.title}">
                <div class="session-header" data-session-toggle="${session.id}">
                    <!-- Mobile Layout -->
                    <div class="session-mobile-layout">
                        <div class="session-row-time">
                            <span class="session-time">${formattedTime}</span>
                            <div class="session-badges">
                                <span class="badge badge-language">${session.language}</span>
                                <span class="badge badge-type">${session.type}</span>
                            </div>
                        </div>
                        <div class="session-content">
                            <div class="session-info">
                                ${speakerNames ? `<div class="session-speaker-name">${Utils.sanitizeHTML(speakerNames)}</div>` : ''}
                                <div class="session-title">${Utils.sanitizeHTML(session.title)}</div>
                            </div>
                            <div class="session-expand-icon">
                                <span class="sr-only">Toggle details</span>
                                <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M7 10l5 5 5-5z"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Desktop Layout -->
                    <div class="session-desktop-layout">
                        <div class="session-time">${formattedTime}</div>
                        <div class="session-content">
                            <h4 class="session-title">${Utils.sanitizeHTML(session.title)}</h4>
                            <div class="session-badges">
                                <span class="badge badge-language">${session.language}</span>
                                <span class="badge badge-type">${session.type}</span>
                            </div>
                        </div>
                        <div class="speakers-list">
                            ${speakers}
                        </div>
                        <div class="session-expand-icon" data-label="Click to expand">
                            <span class="sr-only">Toggle details</span>
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M7 10l5 5 5-5z"/>
                            </svg>
                        </div>
                    </div>
                </div>
                <div class="session-details" data-session-details="${session.id}">
                    <div class="session-details-content">
                        ${session.description ? `<div class="session-description">${Utils.sanitizeHTML(session.description)}</div>` : '<div class="session-description">No description available.</div>'}
                        ${session.speakers.length > 0 ? `
                            <div class="session-speakers-info">
                                <h5>Speakers</h5>
                                <div class="session-speakers-list">
                                    ${this.renderSessionSpeakers(session.speakers, date)}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderSpeaker(speakerData) {
        // Handle null speakers
        if (!speakerData) {
            return `<div class="speaker-fallback">
                ${Utils.getInitials('TBD')}
            </div>`;
        }
        
        // Handle both ID strings and speaker objects
        const speakerId = typeof speakerData === 'string' ? speakerData : speakerData.id;
        const speaker = AppState.eventData.speakers[speakerId];
        
        // Handle missing speakers gracefully
        if (!speaker) {
            const fallbackName = typeof speakerData === 'object' && speakerData.name ? speakerData.name : 'Speaker';
            return `<div class="speaker-fallback" data-speaker-id="${speakerId}">
                ${Utils.getInitials(fallbackName)}
            </div>`;
        }

        return `
            <img 
                src="${speaker.image}" 
                alt="${speaker.name}"
                class="speaker-avatar" 
                data-speaker-id="${speakerId}"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            >
            <div class="speaker-fallback" style="display: none;" data-speaker-id="${speakerId}">
                ${Utils.getInitials(speaker.name)}
            </div>
        `;
    }

    renderSessionSpeakers(speakers, date) {
        return speakers.map(speakerData => {
            // Handle null speakers
            if (!speakerData) {
                return `
                    <div class="session-speaker-detail">
                        <div class="session-speaker-fallback">
                            ${Utils.getInitials('TBD')}
                        </div>
                        <div class="session-speaker-info">
                            <div class="session-speaker-name">To Be Determined</div>
                            <div class="session-speaker-title">Speaker</div>
                        </div>
                    </div>
                `;
            }
            
            const speakerId = typeof speakerData === 'string' ? speakerData : speakerData.id;
            const speaker = AppState.eventData.speakers[speakerId];
            
            if (!speaker) {
                // Use speaker data from session if available
                const name = typeof speakerData === 'object' && speakerData.name ? speakerData.name : 'Speaker';
                return `
                    <div class="session-speaker-detail" data-speaker-id="${speakerId}">
                        <div class="session-speaker-fallback">
                            ${Utils.getInitials(name)}
                        </div>
                        <div class="session-speaker-info">
                            <div class="session-speaker-name">${Utils.sanitizeHTML(name)}</div>
                            <div class="session-speaker-title">Speaker</div>
                        </div>
                    </div>
                `;
            }
            
            return `
                <div class="session-speaker-detail" data-speaker-id="${speakerId}">
                    <img src="${speaker.image}" 
                         alt="${speaker.name}"
                         class="session-speaker-avatar"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="session-speaker-fallback" style="display: none;">
                        ${Utils.getInitials(speaker.name)}
                    </div>
                    <div class="session-speaker-info">
                        <div class="session-speaker-name">${Utils.sanitizeHTML(speaker.name)}</div>
                        <div class="session-speaker-title">${Utils.sanitizeHTML(speaker.title)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    bindEvents() {
        // Session toggle events
        this.container.addEventListener('click', (e) => {
            const toggleElement = e.target.closest('[data-session-toggle]');
            if (toggleElement) {
                const sessionId = toggleElement.dataset.sessionToggle;
                this.toggleSessionDetails(sessionId);
                return;
            }
        });

        // Keyboard navigation for sessions
        this.container.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const session = e.target.closest('.session');
                if (session) {
                    e.preventDefault();
                    const sessionId = session.dataset.sessionId;
                    this.toggleSessionDetails(sessionId);
                }
            }
        });

        // Speaker avatar clicks
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('speaker-avatar') || e.target.classList.contains('speaker-fallback')) {
                const speakerId = e.target.dataset.speakerId;
                if (speakerId) {
                    this.modalHandler.showSpeaker(speakerId);
                }
            }
        });

        // Session speaker detail clicks
        this.container.addEventListener('click', (e) => {
            const speakerDetail = e.target.closest('.session-speaker-detail');
            if (speakerDetail) {
                const speakerId = speakerDetail.dataset.speakerId;
                if (speakerId) {
                    this.modalHandler.showSpeaker(speakerId);
                }
            }
        });
    }

    toggleSessionDetails(sessionId) {
        const sessionElement = document.querySelector(`[data-session-id="${sessionId}"]`);
        const detailsElement = document.querySelector(`[data-session-details="${sessionId}"]`);
        const expandIcon = sessionElement?.querySelector('.session-expand-icon svg');
        const expandLabel = sessionElement?.querySelector('.session-expand-icon');
        
        if (!sessionElement || !detailsElement) return;
        
        const isExpanded = sessionElement.classList.contains('expanded');
        
        if (isExpanded) {
            // Collapse
            sessionElement.classList.remove('expanded');
            sessionElement.setAttribute('aria-expanded', 'false');
            detailsElement.style.maxHeight = '0';
            if (expandIcon) {
                expandIcon.style.transform = 'rotate(0deg)';
            }
            if (expandLabel) {
                expandLabel.setAttribute('data-label', 'Click to expand');
            }
        } else {
            // Expand
            sessionElement.classList.add('expanded');
            sessionElement.setAttribute('aria-expanded', 'true');
            
            // Reset maxHeight to get accurate scrollHeight
            detailsElement.style.maxHeight = 'none';
            const height = detailsElement.scrollHeight;
            detailsElement.style.maxHeight = '0';
            
            // Trigger reflow and set the proper height
            requestAnimationFrame(() => {
                detailsElement.style.maxHeight = height + 'px';
            });
            
            if (expandIcon) {
                expandIcon.style.transform = 'rotate(180deg)';
            }
            if (expandLabel) {
                expandLabel.setAttribute('data-label', 'Click to collapse');
            }
        }
    }

    applyFilters() {
        const { day, language, speaker, type } = AppState.filters;
        
        document.querySelectorAll('.session').forEach(sessionElement => {
            let visible = true;

            if (day && sessionElement.dataset.day !== day) visible = false;
            if (language && sessionElement.dataset.language !== language.toLowerCase()) visible = false;
            if (speaker && !sessionElement.dataset.speakers.split(',').includes(speaker)) visible = false;
            if (type && sessionElement.dataset.type !== type) visible = false;

            sessionElement.style.display = visible ? 'block' : 'none';
        });

        document.querySelectorAll('.day-group').forEach(dayGroup => {
            const visibleSessions = dayGroup.querySelectorAll('.session:not([style*="display: none"])');
            dayGroup.style.display = visibleSessions.length > 0 ? 'block' : 'none';
        });
    }

    updateTimezone(timezone) {
        AppState.currentTimezone = timezone;
        this.updateSessionTimes();
    }

    updateSessionTimes() {
        document.querySelectorAll('.session').forEach(sessionElement => {
            const sessionId = sessionElement.dataset.sessionId;
            const session = this.findSessionById(sessionId);
            if (session) {
                const timeElements = sessionElement.querySelectorAll('.session-time');
                if (timeElements.length > 0) {
                    const formattedTime = Utils.formatTime(session.time, session.date, AppState.currentTimezone);
                    timeElements.forEach(el => el.textContent = formattedTime);
                }
            }
        });
    }

    findSessionById(sessionId) {
        for (const day of AppState.eventData.schedule) {
            const session = day.sessions.find(s => s.id === sessionId);
            if (session) {
                return { ...session, date: day.date, dayName: day.dayName };
            }
        }
        return null;
    }

    renderError(message) {
        this.container.innerHTML = `
            <div class="error" role="alert">
                <div class="error-icon">⚠️</div>
                <div class="error-message">${message}</div>
                <div class="error-action">
                    <button class="btn" onclick="location.reload()">
                        Refresh Page
                    </button>
                </div>
            </div>
        `;
    }

    renderLoading() {
        this.container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <span>Loading agenda...</span>
            </div>
        `;
    }
}

// Speakers Renderer with Incremental Loading
class SpeakersRenderer {
    constructor(modalHandler) {
        this.container = document.getElementById('speakers-container');
        this.modalHandler = modalHandler;
        this.loadedCount = 0;
        this.batchSize = 12; // Load 12 speakers at a time
        this.allSpeakers = [];
        this.isLoading = false;
    }

    render() {
        if (!AppState.eventData?.speakers) {
            this.renderError('No speakers data available');
            return;
        }

        try {
            // Remove hardcoded confirmed filter - show all speakers
            this.allSpeakers = Object.entries(AppState.eventData.speakers)
                .sort(([,a], [,b]) => a.name.localeCompare(b.name));

            if (this.allSpeakers.length === 0) {
                this.renderError('No speakers available');
                return;
            }

            // Reset state
            this.loadedCount = 0;
            this.container.innerHTML = '';
            
            // Load initial batch
            this.loadNextBatch();
            
            // Setup incremental loading if there are more speakers
            if (this.allSpeakers.length > this.batchSize) {
                this.setupIncrementalLoading();
            }
            
            this.bindEvents();
        } catch (error) {
            console.error('Error rendering speakers:', error);
            this.renderError('Error displaying speakers');
        }
    }

    loadNextBatch() {
        if (this.isLoading || this.loadedCount >= this.allSpeakers.length) return;
        
        this.isLoading = true;
        const nextBatch = this.allSpeakers.slice(this.loadedCount, this.loadedCount + this.batchSize);
        
        const batchHTML = nextBatch
            .map(([id, speaker]) => this.renderSpeakerCard(id, speaker))
            .join('');
        
        // Initial load: Instant rendering
        if (this.loadedCount === 0) {
            this.container.innerHTML = batchHTML;
        } else {
            // Load More: Smooth staggered animation with faster timing
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = batchHTML;
            
            Array.from(tempDiv.children).forEach((card, index) => {
                setTimeout(() => {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                    this.container.appendChild(card);
                    
                    // Trigger animation
                    requestAnimationFrame(() => {
                        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    });
                }, index * 20); // Reduced from 100ms to 20ms for faster load more
            });
        }
        
        this.loadedCount += nextBatch.length;
        this.isLoading = false;
        
        // Update or remove load more button
        this.updateLoadMoreButton();
    }
    
    setupIncrementalLoading() {
        // Add load more button
        const loadMoreButton = document.createElement('div');
        loadMoreButton.className = 'load-more-container';
        loadMoreButton.innerHTML = `
            <button class="btn btn-outline load-more-btn" id="loadMoreSpeakers">
                Load More Speakers
                <span class="speakers-count">(${this.allSpeakers.length - this.batchSize} remaining)</span>
            </button>
        `;
        
        this.container.parentNode.appendChild(loadMoreButton);
        
        // Bind load more event
        document.getElementById('loadMoreSpeakers')?.addEventListener('click', () => {
            this.loadNextBatch();
        });
        
        // Optional: Auto-load on scroll (intersection observer)
        this.setupAutoLoad(loadMoreButton);
    }
    
    setupAutoLoad(loadMoreContainer) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoading) {
                    this.loadNextBatch();
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '200px'
        });
        
        observer.observe(loadMoreContainer);
    }
    
    updateLoadMoreButton() {
        const loadMoreContainer = document.querySelector('.load-more-container');
        const loadMoreBtn = document.getElementById('loadMoreSpeakers');
        const remainingCount = this.allSpeakers.length - this.loadedCount;
        
        if (remainingCount <= 0) {
            // All speakers loaded
            if (loadMoreContainer) {
                loadMoreContainer.remove();
            }
        } else if (loadMoreBtn) {
            // Update remaining count
            const countSpan = loadMoreBtn.querySelector('.speakers-count');
            if (countSpan) {
                countSpan.textContent = `(${remainingCount} remaining)`;
            }
        }
    }

    renderSpeakerCard(speakerId, speaker) {
        const socialLinks = speaker.social ? Object.entries(speaker.social).map(([platform, url]) => {
            const iconMap = {
                linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>',
                twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
                github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>'
            };
            return `<a href="${url}" target="_blank" rel="noopener" class="speaker-social-link" aria-label="${platform}">${iconMap[platform] || iconMap.linkedin}</a>`;
        }).join('') : '';

        return `
            <div class="speaker-card" data-speaker-id="${speakerId}">
                <img 
                    src="${speaker.image}" 
                    alt="${speaker.name}"
                    class="speaker-image"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                >
                <div class="speaker-card-fallback" style="display: none;">
                    ${Utils.getInitials(speaker.name)}
                </div>
                <div class="speaker-info">
                    <h3 class="speaker-name">${Utils.sanitizeHTML(speaker.name)}</h3>
                    <p class="speaker-title">${Utils.sanitizeHTML(speaker.title)}</p>
                    ${socialLinks ? `<div class="speaker-social">${socialLinks}</div>` : ''}
                </div>
            </div>
        `;
    }

    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const speakerCard = e.target.closest('.speaker-card');
            if (speakerCard && !e.target.closest('.speaker-social')) {
                const speakerId = speakerCard.dataset.speakerId;
                if (speakerId) {
                    this.modalHandler.showSpeaker(speakerId);
                }
            }
        });
    }

    renderError(message) {
        this.container.innerHTML = `
            <div class="error">
                <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️</div>
                <div>${message}</div>
            </div>
        `;
    }

    renderLoading() {
        this.container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <span>Loading speakers...</span>
            </div>
        `;
    }
}

// Timezone Controller
class TimezoneController {
    constructor(scheduleRenderer) {
        this.scheduleRenderer = scheduleRenderer;
        this.buttons = document.querySelectorAll('.timezone-btn');
        this.bindEvents();
    }

    bindEvents() {
        this.buttons.forEach(button => {
            button.addEventListener('click', () => {
                const timezone = button.dataset.tz;
                this.setActiveTimezone(timezone);
                this.scheduleRenderer.updateTimezone(timezone);
            });
        });
    }

    setActiveTimezone(timezone) {
        this.buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tz === timezone);
        });
    }
}

// Animation Controller
class AnimationController {
    constructor() {
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            { threshold: 0.1, rootMargin: '50px' }
        );
        this.init();
    }

    init() {
        document.querySelectorAll('.fade-in').forEach(el => {
            this.observer.observe(el);
        });
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                this.observer.unobserve(entry.target);
            }
        });
    }

    observeNewElements() {
        setTimeout(() => {
            document.querySelectorAll('.fade-in:not(.visible)').forEach(el => {
                this.observer.observe(el);
            });
        }, 100);
    }
}

// Main Application
class App {
    constructor() {
        this.imagePreloader = new ImagePreloader();
        this.modalHandler = new ModalHandler();
        this.scheduleRenderer = new ScheduleRenderer(this.modalHandler);
        this.speakersRenderer = new SpeakersRenderer(this.modalHandler);
        this.speakerCarousel = new SpeakerCarousel();
        this.filterController = new FilterController(this.scheduleRenderer);
        this.timezoneController = new TimezoneController(this.scheduleRenderer);
        this.animationController = new AnimationController();
        this.initMobileNav();
    }

    initMobileNav() {
        const navToggle = document.querySelector('.nav-toggle');
        const navLinks = document.querySelector('.nav-links');
        
        if (navToggle && navLinks) {
            navToggle.addEventListener('click', () => {
                navLinks.classList.toggle('active');
            });
            
            // Close mobile nav when clicking links
            navLinks.addEventListener('click', (e) => {
                if (e.target.tagName === 'A') {
                    navLinks.classList.remove('active');
                }
            });
            
            // Close mobile nav when clicking outside
            document.addEventListener('click', (e) => {
                if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
                    navLinks.classList.remove('active');
                }
            });
        }
    }

    async init() {
        try {
            AppState.isLoading = true;
            this.scheduleRenderer.renderLoading();
            this.speakersRenderer.renderLoading();

            console.log('Loading event data...');
            AppState.eventData = await DataLoader.loadEventData();
            AppState.isLoading = false;
            AppState.error = null;

            console.log('Event data loaded:', AppState.eventData);

            // Preload speaker images
            if (AppState.eventData.speakers) {
                this.imagePreloader.preloadSpeakerImages(AppState.eventData.speakers);
                this.speakerCarousel.populate(AppState.eventData.speakers);
            }

            this.scheduleRenderer.render();
            this.speakersRenderer.render();
            this.filterController.initializeFilters();
            
            this.animationController.observeNewElements();

        } catch (error) {
            console.error('App initialization error:', error);
            AppState.isLoading = false;
            AppState.error = error.message;
            
            this.scheduleRenderer.renderError(error.message);
            this.speakersRenderer.renderError(error.message);
        }
    }
}

// Global error handling
window.addEventListener('error', function(e) {
    console.error('Application error:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
});

// Initialize Application
let app;
let modalHandler;

function initApp() {
    app = new App();
    modalHandler = app.modalHandler; // Make modal handler globally available
    app.init();
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
