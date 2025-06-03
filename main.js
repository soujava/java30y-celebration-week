// Speaker Carousel Controller
class SpeakerCarousel {
    constructor() {
        this.container = document.getElementById('speakerCarousel');
        this.track = this.container?.querySelector('.carousel-track');
    }

    populate(speakers) {
        if (!this.track || !speakers) return;

        // Get confirmed speakers only
        const confirmedSpeakers = Object.entries(speakers)
            .filter(([id, speaker]) => speaker.confirmed === true)
            .slice(0, 12); // Limit to 12 speakers for smooth animation

        if (confirmedSpeakers.length === 0) {
            this.track.innerHTML = '<div style="color: rgba(255,255,255,0.7); text-align: center; padding: 2rem;">Speakers coming soon...</div>';
            return;
        }

        // Duplicate speakers for seamless loop
        const duplicatedSpeakers = [...confirmedSpeakers, ...confirmedSpeakers, ...confirmedSpeakers];
        
        const speakersHTML = duplicatedSpeakers.map(([id, speaker]) => {
            return `
                <div class="carousel-speaker" data-speaker-id="${id}">
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
                </div>
            `;
        }).join('');

        this.track.innerHTML = speakersHTML;
        this.bindEvents();
    }

    bindEvents() {
        // Carousel speakers are no longer clickable
        // Removed click events for carousel speakers
    }
}// Image Preloader
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
            .filter(speaker => speaker.confirmed && speaker.image)
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
}/**
 * SouJava 30-Year Celebration Week - Event Application
 * Optimized JavaScript with Sessionize API integration
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
            
            throw new Error('Failed to load event data. Please try again later.');
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
                const speakerId = speaker.id;
                transformed.speakers[speakerId] = {
                    name: speaker.fullName,
                    title: speaker.tagLine || '',
                    bio: speaker.bio || '',
                    image: speaker.profilePicture || '',
                    confirmed: true,
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

        // Since sessions don't have dates, create a mock schedule
        // Group sessions by a default date range (June 16-20, 2025)
        const eventDates = [
            { date: '2025-06-16', dayName: 'Monday', time: '11:30' },
            { date: '2025-06-17', dayName: 'Tuesday', time: '12:00' },
            { date: '2025-06-18', dayName: 'Wednesday', time: '12:30' },
            { date: '2025-06-19', dayName: 'Thursday', time: '13:00' },
            { date: '2025-06-20', dayName: 'Friday', time: '13:30' }
        ];

        // Transform sessions
        if (sessionizeData.sessions) {
            const validSessions = sessionizeData.sessions.filter(session => 
                session.title && 
                session.title !== 'Session Details Coming Soon' &&
                session.status === 'Accepted'
            );

            console.log('Valid sessions:', validSessions.length);

            validSessions.forEach((session, index) => {
                const dayIndex = index % eventDates.length;
                const eventDate = eventDates[dayIndex];
                
                const transformedSession = {
                    id: session.id.toString(),
                    time: eventDate.time,
                    duration: 45,
                    title: session.title || '',
                    description: session.description || '',
                    language: this.getLanguageFromCategories(session.categoryItems, categoryLookup),
                    type: this.getTypeFromCategories(session.categoryItems, categoryLookup),
                    speakers: session.speakers || []
                };

                // Find or create day in schedule
                let daySchedule = transformed.schedule.find(day => day.date === eventDate.date);
                if (!daySchedule) {
                    daySchedule = {
                        date: eventDate.date,
                        dayName: eventDate.dayName,
                        sessions: []
                    };
                    transformed.schedule.push(daySchedule);
                }

                daySchedule.sessions.push(transformedSession);
            });
        }

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
        for (const itemId of categoryItems) {
            const category = categoryLookup[itemId];
            if (category && category.category === 'Language') {
                return category.name;
            }
        }
        return 'English'; // default
    }

    static getTypeFromCategories(categoryItems, categoryLookup) {
        for (const itemId of categoryItems) {
            const category = categoryLookup[itemId];
            if (category && category.category === 'Type') {
                return category.name.toLowerCase().replace(' ', '');
            }
        }
        return 'talk'; // default
    }

    static detectLanguage(title, description) {
        const text = `${title} ${description}`.toLowerCase();
        const portugueseKeywords = ['português', 'brasil', 'desenvolvimento', 'programação', 'aplicações', 'microsserviços'];
        const hasPortuguese = portugueseKeywords.some(keyword => text.includes(keyword));
        return hasPortuguese ? 'Portuguese' : 'English';
    }

    static detectSessionType(title, description) {
        const text = `${title} ${description}`.toLowerCase();
        if (text.includes('kickoff') || text.includes('opening') || text.includes('welcome')) return 'opening';
        if (text.includes('roundtable') || text.includes('panel') || text.includes('discussion')) return 'roundtable';
        return 'talk';
    }

    static getDayName(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    }
}

// Modal Handler
class ModalHandler {
    constructor() {
        this.speakerModal = document.getElementById('speakerModal');
        this.sessionModal = document.getElementById('sessionModal');
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
        
        if (!speaker || speaker.confirmed !== true) {
            console.warn('Speaker not found or not confirmed:', speakerId);
            return;
        }

        this.populateSpeakerContent(speaker);
        this.showModal(this.speakerModal);
    }

    showSession(sessionId) {
        const session = this.findSessionById(sessionId);
        if (!session) {
            console.error('Session not found:', sessionId);
            return;
        }

        this.populateSessionContent(session);
        this.showModal(this.sessionModal);
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

    populateSpeakerContent(speaker) {
        const elements = {
            image: document.getElementById('modalSpeakerImage'),
            name: document.getElementById('modalSpeakerName'),
            title: document.getElementById('modalSpeakerTitle'),
            bio: document.getElementById('modalSpeakerBio'),
            socialLinks: document.getElementById('modalSocialLinks')
        };

        if (elements.image) {
            // Check if image is preloaded
            if (app?.imagePreloader?.isImageLoaded(speaker.image)) {
                elements.image.src = speaker.image;
                elements.image.style.display = 'block';
            } else {
                elements.image.src = speaker.image;
                elements.image.style.display = 'block';
            }
            elements.image.alt = `Photo of ${speaker.name}`;
            elements.image.onerror = () => {
                elements.image.style.display = 'none';
            };
        }

        if (elements.name) elements.name.textContent = speaker.name;
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

    populateSessionContent(session) {
        const sessionDetails = document.getElementById('sessionDetails');
        if (!sessionDetails) return;

        const speakers = session.speakers.map(speakerId => {
            const speaker = AppState.eventData.speakers[speakerId];
            if (!speaker || !speaker.confirmed) return '';
            
            return `
                <div class="session-speaker-item" onclick="modalHandler.showSpeaker('${speakerId}')">
                    <img src="${speaker.image}" 
                         alt="${speaker.name}"
                         class="session-speaker-avatar"
                         onerror="this.style.display='none';">
                    <span class="session-speaker-name">${speaker.name}</span>
                </div>
            `;
        }).join('');

        const formattedTime = Utils.formatTime(session.time, session.date, AppState.currentTimezone);

        sessionDetails.innerHTML = `
            <div class="session-header">
                <div class="session-time-info">
                    <div class="session-day">${session.dayName}</div>
                    <time class="session-time">${formattedTime}</time>
                </div>
                <div class="session-badges">
                    <span class="badge badge-language">${session.language}</span>
                    <span class="badge badge-type">${session.type}</span>
                </div>
            </div>
            <h3 class="session-title">${session.title}</h3>
            <div class="session-description">${Utils.sanitizeHTML(session.description || 'No description available.').replace(/\n/g, '<br>')}</div>
            ${speakers ? `
                <div class="session-speakers">
                    <h4>Speakers</h4>
                    <div class="session-speaker-list">
                        ${speakers}
                    </div>
                </div>
            ` : ''}
        `;
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
        document.body.style.overflow = 'hidden';
        
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
            option.textContent = day.dayName;
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

        // Only show confirmed speakers in filter
        const confirmedSpeakers = Object.entries(AppState.eventData.speakers)
            .filter(([id, speaker]) => speaker.confirmed === true)
            .sort(([,a], [,b]) => a.name.localeCompare(b.name));

        confirmedSpeakers.forEach(([id, speaker]) => {
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
                        <h3 class="day-header">${day.dayName}, ${Utils.formatDate(day.date)}</h3>
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
        
        return `
            <div class="session" 
                 data-session-id="${session.id}"
                 data-language="${session.language.toLowerCase()}"
                 data-speakers="${session.speakers.join(',')}"
                 data-type="${session.type}"
                 data-day="${date}">
                <div class="session-time">${formattedTime}</div>
                <div class="session-content">
                    <h4 class="session-title">${Utils.sanitizeHTML(session.title)}</h4>
                    ${session.description ? `<p class="session-description">${Utils.sanitizeHTML(session.description)}</p>` : ''}
                    <div class="session-badges">
                        <span class="badge badge-language">${session.language}</span>
                        <span class="badge badge-type">${session.type}</span>
                    </div>
                </div>
                <div class="speakers-list">
                    ${speakers}
                </div>
            </div>
        `;
    }

    renderSpeaker(speakerId) {
        const speaker = AppState.eventData.speakers[speakerId];
        
        // Only render confirmed speakers
        if (!speaker || speaker.confirmed !== true) {
            return `<div class="speaker-fallback" data-speaker-id="${speakerId}">
                ${speakerId.substring(0, 2).toUpperCase()}
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

    bindEvents() {
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('speaker-avatar') || e.target.classList.contains('speaker-fallback')) {
                const speakerId = e.target.dataset.speakerId;
                if (speakerId) {
                    this.modalHandler.showSpeaker(speakerId);
                }
            }
        });

        this.container.addEventListener('click', (e) => {
            const sessionElement = e.target.closest('.session');
            if (sessionElement && !e.target.closest('.speakers-list')) {
                const sessionId = sessionElement.dataset.sessionId;
                if (sessionId) {
                    this.modalHandler.showSession(sessionId);
                }
            }
        });
    }

    applyFilters() {
        const { day, language, speaker, type } = AppState.filters;
        
        document.querySelectorAll('.session').forEach(sessionElement => {
            let visible = true;

            if (day && sessionElement.dataset.day !== day) visible = false;
            if (language && sessionElement.dataset.language !== language.toLowerCase()) visible = false;
            if (speaker && !sessionElement.dataset.speakers.split(',').includes(speaker)) visible = false;
            if (type && sessionElement.dataset.type !== type) visible = false;

            sessionElement.style.display = visible ? 'grid' : 'none';
        });

        document.querySelectorAll('.day-group').forEach(dayGroup => {
            const dayDate = dayGroup.dataset.day;
            const visibleSessions = dayGroup.querySelectorAll('.session:not([style*="display: none"])');
            dayGroup.style.display = visibleSessions.length > 0 ? 'block' : 'none';
        });
    }

    updateTimezone(timezone) {
        AppState.currentTimezone = timezone;
        // Only update times, don't re-render entire schedule
        this.updateSessionTimes();
    }

    updateSessionTimes() {
        document.querySelectorAll('.session').forEach(sessionElement => {
            const sessionId = sessionElement.dataset.sessionId;
            const session = this.findSessionById(sessionId);
            if (session) {
                const timeElement = sessionElement.querySelector('.session-time');
                if (timeElement) {
                    const formattedTime = Utils.formatTime(session.time, session.date, AppState.currentTimezone);
                    timeElement.textContent = formattedTime;
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
                <span>Loading agenda...</span>
            </div>
        `;
    }
}

// Speakers Renderer
class SpeakersRenderer {
    constructor(modalHandler) {
        this.container = document.getElementById('speakers-container');
        this.modalHandler = modalHandler;
    }

    render() {
        if (!AppState.eventData?.speakers) {
            this.renderError('No speakers data available');
            return;
        }

        try {
            // Only show confirmed speakers
            const confirmedSpeakers = Object.entries(AppState.eventData.speakers)
                .filter(([id, speaker]) => speaker.confirmed === true)
                .sort(([,a], [,b]) => a.name.localeCompare(b.name));

            if (confirmedSpeakers.length === 0) {
                this.renderError('No confirmed speakers available');
                return;
            }

            const speakersHTML = confirmedSpeakers
                .map(([id, speaker]) => this.renderSpeakerCard(id, speaker))
                .join('');

            this.container.innerHTML = speakersHTML;
            this.bindEvents();
        } catch (error) {
            console.error('Error rendering speakers:', error);
            this.renderError('Error displaying speakers');
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
                <h3 class="speaker-name">${Utils.sanitizeHTML(speaker.name)}</h3>
                <p class="speaker-title">${Utils.sanitizeHTML(speaker.title)}</p>
                ${socialLinks ? `<div class="speaker-social">${socialLinks}</div>` : ''}
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
