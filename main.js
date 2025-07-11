const HERO_CTA_CONFIG = {
  primary: {
    text: "Watch the Sessions",
    link: "https://soujava.dev/celebrationplaylist" 
  },
  secondary: {
    text: "",
    link: ""
  },
  showSecondaryButton: false 
};

const AppState = {
    eventData: null,
    currentTimezone: 'America/Sao_Paulo',
    isLoading: true,
    error: null,
    isDataReady: false,
    filters: {
        day: '',
        language: '',
        speaker: '',
        type: '',
        topic: ''
    }
};

const CONFIG = {
    SESSIONIZE_API: 'https://sessionize.com/api/v2/f8z6beeh/view/All',
    CACHE_KEY: 'soujava_event_data',
    CACHE_DURATION: 30 * 60 * 1000,
    FALLBACK_DATA: {
        sessions: [],
        speakers: [],
        categories: [],
        rooms: []
    }
};

const Utils = {
    createSlug(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
    },

    createSessionAnchor(session) {
        if (!session || !session.title) return `session-${session.id || 'unknown'}`;
        
        let slug = session.title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 60);
        
        if (!slug || slug.length < 3) {
            slug = `session-${session.id}`;
        }
        
        return slug;
    },

    createDayAnchor(date) {
        if (!date) return 'day-unknown';
        const dateObj = new Date(date + 'T00:00:00');
        const dayNumber = dateObj.getDate() - 15;
        return `day-${dayNumber}`;
    },

    createSpeakerAnchor(speakerName) {
        if (!speakerName) return 'speaker-unknown';
        return this.createSlug(speakerName);
    },

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
            return null;
        }
    },

    formatDateHeader(dateString) {
        try {
            const date = new Date(dateString + 'T00:00:00');
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
            return `${dayName}, ${monthDay}`;
        } catch (error) {
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

    ensureNonEmptyString(value, fallback = 'Unknown') {
        if (!value || typeof value !== 'string' || value.trim() === '') {
            return fallback;
        }
        return value.trim();
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

const CacheManager = {
    set(key, data) {
        try {
            const cacheData = {
                data,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(cacheData));
        } catch (error) {
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
            return null;
        }
    },

    clear(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
        }
    }
};

class DataLoader {
    static async loadEventData() {
        CacheManager.clear(CONFIG.CACHE_KEY);
        
        const cachedData = CacheManager.get(CONFIG.CACHE_KEY);
        if (cachedData) {
            return this.transformSessionizeData(cachedData);
        }

        try {
            const response = await fetch(CONFIG.SESSIONIZE_API);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            CacheManager.set(CONFIG.CACHE_KEY, data);
            
            return this.transformSessionizeData(data);
        } catch (error) {
            
            const oldCache = CacheManager.get(CONFIG.CACHE_KEY, Infinity);
            if (oldCache) {
                return this.transformSessionizeData(oldCache);
            }
            
            throw new Error('Unable to load schedule. Please check your connection and refresh the page.');
        }
    }

    static transformSessionizeData(sessionizeData) {
        const transformed = {
            speakers: {},
            schedule: [],
            sessionsById: {}
        };

        if (sessionizeData.speakers) {
            sessionizeData.speakers.forEach(speaker => {
                const speakerName = Utils.ensureNonEmptyString(speaker.fullName, 'Unknown Speaker');
                
                transformed.speakers[speaker.id] = {
                    name: speakerName,
                    title: speaker.tagLine || '',
                    bio: speaker.bio || '',
                    image: speaker.profilePicture || '',
                    social: this.extractSocialLinks(speaker.links)
                };
            });
        }

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

        if (sessionizeData.sessions && sessionizeData.sessions.length > 0) {
            const validSessions = sessionizeData.sessions.filter(session => 
                session.title && 
                session.startsAt &&
                (!session.status || session.status === 'Accepted')
            );

            validSessions.forEach(session => {
                const timeInfo = Utils.parseSessionizeTime(session.startsAt);
                if (!timeInfo) return;
                
                const sessionTitle = Utils.ensureNonEmptyString(session.title, 'Untitled Session');
                
                const transformedSession = {
                    id: session.id.toString(),
                    time: timeInfo.time,
                    title: sessionTitle,
                    description: session.description || '',
                    language: this.getLanguageFromCategories(session.categoryItems, categoryLookup),
                    type: this.getTypeFromCategories(session.categoryItems, categoryLookup),
                    topics: this.getTopicsFromCategories(session.categoryItems, categoryLookup),
                    speakers: session.speakers || [],
                    startsAt: session.startsAt,
                    endsAt: session.endsAt,
                    timestamp: timeInfo.timestamp,
                    roomId: session.roomId,
                    room: sessionizeData.rooms?.find(r => r.id === session.roomId)?.name || ''
                };

                transformed.sessionsById[transformedSession.id] = transformedSession;

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

        transformed.schedule.sort((a, b) => new Date(a.date) - new Date(b.date));
        transformed.schedule.forEach(day => {
            day.sessions.sort((a, b) => a.timestamp - b.timestamp);
        });

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
        return 'English';
    }

    static getTypeFromCategories(categoryItems, categoryLookup) {
        if (!categoryItems || !Array.isArray(categoryItems)) return 'talk';
        
        for (const itemId of categoryItems) {
            const category = categoryLookup[itemId];
            if (category && category.category === 'Type') {
                return category.name.toLowerCase().replace(/\s+/g, '');
            }
        }
        return 'talk';
    }

    static getTopicsFromCategories(categoryItems, categoryLookup) {
        if (!categoryItems || !Array.isArray(categoryItems)) return [];
        
        const topics = [];
        for (const itemId of categoryItems) {
            const category = categoryLookup[itemId];
            if (category && category.category === 'Topics') {
                topics.push(category.name);
            }
        }
        return topics;
    }
}

class SpeakerCarousel {
    constructor() {
        this.container = document.getElementById('speakerCarousel');
        this.track = this.container?.querySelector('.carousel-track');
    }

    populate(speakers) {
        if (!this.track || !speakers) return;

        const availableSpeakers = Object.entries(speakers)
            .slice(0, 12);

        if (availableSpeakers.length === 0) {
            this.track.innerHTML = '<div style="color: rgba(255,255,255,0.7); text-align: center; padding: 2rem;">Speakers coming soon...</div>';
            return;
        }

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
    }
}

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
        } catch (error) {
        }
    }

    isImageLoaded(src) {
        return this.loadedImages.has(src);
    }
}

class ModalHandler {
    constructor() {
        this.speakerModal = document.getElementById('speakerModal');
        this.bindEvents();
    }

    bindEvents() {
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAll());
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeAll();
            });
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal.active');
                if (openModal) {
                    this.closeAll();
                }
            }
        });
    }

    showSpeaker(speakerId) {
        if (!AppState.isDataReady) {
            return;
        }
        
        const speaker = AppState.eventData?.speakers[speakerId];
        
        if (!speaker) {
            Analytics.trackSpeakerProfileView('Speaker Not Found', false);
            return;
        }

        const speakerName = Utils.ensureNonEmptyString(speaker.name, 'Unknown Speaker');
        
        const isJavaChampion = speaker.title?.toLowerCase().includes('java champion') || 
                               speaker.bio?.toLowerCase().includes('java champion');
        
        Analytics.trackSpeakerProfileView(speakerName, isJavaChampion);
        
        this.populateSpeakerContent(speaker);
        this.showModal(this.speakerModal);
        
        const speakerAnchor = Utils.createSpeakerAnchor(speaker.name);
        if (window.history && window.history.pushState) {
            window.history.pushState(null, '', `#${speakerAnchor}`);
        }
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
            const isJavaChampion = speaker.title?.toLowerCase().includes('java champion') || 
                                  speaker.bio?.toLowerCase().includes('java champion');
            
            elements.name.innerHTML = Utils.sanitizeHTML(speaker.name) + 
                (isJavaChampion ? '<span class="java-champion-badge">Java Champion</span>' : '');
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
        
        setTimeout(() => {
            modal.classList.remove('loading');
        }, 300);
        
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) closeBtn.focus();
    }

    closeAll() {
        const hasOpenModal = document.querySelector('.modal.active');
        if (!hasOpenModal) return;
        
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
        
        if (window.location.hash && window.history && window.history.replaceState) {
            window.location.hash = '';
            
            const baseUrl = window.location.pathname + window.location.search;
            window.history.replaceState(null, '', baseUrl);
        }
    }
}

class FilterController {
    constructor(scheduleRenderer) {
        this.scheduleRenderer = scheduleRenderer;
        this.bindEvents();
    }

    initializeFilters() {
        this.populateDayFilter();
        this.populateSpeakerFilter();
        this.populateTopicFilter();
    }

    populateDayFilter() {
        const dayFilter = document.getElementById('day-filter');
        if (!dayFilter || !AppState.eventData?.schedule) return;

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

        const firstOption = speakerFilter.firstElementChild;
        if (firstOption) {
            speakerFilter.innerHTML = '';
            speakerFilter.appendChild(firstOption);
        } else {
            speakerFilter.innerHTML = '<option value="">All Speakers</option>';
        }

        const allSpeakers = Object.entries(AppState.eventData.speakers)
            .sort(([,a], [,b]) => a.name.localeCompare(b.name));

        allSpeakers.forEach(([id, speaker]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = speaker.name;
            speakerFilter.appendChild(option);
        });
    }

    populateTopicFilter() {
        const topicFilter = document.getElementById('topic-filter');
        if (!topicFilter || !AppState.eventData?.schedule) return;

        const firstOption = topicFilter.firstElementChild;
        if (firstOption) {
            topicFilter.innerHTML = '';
            topicFilter.appendChild(firstOption);
        } else {
            topicFilter.innerHTML = '<option value="">All Topics</option>';
        }

        const allTopics = new Set();
        AppState.eventData.schedule.forEach(day => {
            day.sessions.forEach(session => {
                if (session.topics && session.topics.length > 0) {
                    session.topics.forEach(topic => allTopics.add(topic));
                }
            });
        });

        const sortedTopics = Array.from(allTopics).sort();
        sortedTopics.forEach(topic => {
            const option = document.createElement('option');
            option.value = topic;
            option.textContent = topic;
            topicFilter.appendChild(option);
        });
    }

    bindEvents() {
        const filterSelects = ['day-filter', 'language-filter', 'speaker-filter', 'type-filter', 'topic-filter'];
        
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
            type: document.getElementById('type-filter')?.value || '',
            topic: document.getElementById('topic-filter')?.value || ''
        };

        Object.entries(AppState.filters).forEach(([filterType, filterValue]) => {
            if (filterValue) {
                Analytics.trackFilterUse(filterType, filterValue);
            }
        });

        const activeFilters = Object.values(AppState.filters).filter(v => v).length;
        const clearButton = document.getElementById('clear-filters');
        if (clearButton) {
            clearButton.setAttribute('data-active', activeFilters > 0);
        }

        this.scheduleRenderer.applyFilters();
    }

    clearFilters() {
        ['day-filter', 'language-filter', 'speaker-filter', 'type-filter', 'topic-filter'].forEach(filterId => {
            const filter = document.getElementById(filterId);
            if (filter) filter.value = '';
        });

        AppState.filters = { day: '', language: '', speaker: '', type: '', topic: '' };
        this.scheduleRenderer.applyFilters();
    }
}

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
                const dayAnchor = Utils.createDayAnchor(day.date);
                const dayNumber = new Date(day.date + 'T00:00:00').getDate() - 15;
                const streamLink = `https://soujava.dev/celebration-day-${dayNumber}`;
                
                scheduleHTML += `
                    <div class="day-group" data-day="${day.date}" id="${dayAnchor}">
                        <div class="day-header-container">
                            <h3 class="day-header">${Utils.formatDateHeader(day.date)}</h3>
                            <a href="${streamLink}" target="_blank" rel="noopener" class="day-stream-link">
                                Watch Day ${dayNumber} Stream <span class="material-icons">open_in_new</span>
                            </a>
                        </div>
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
        
        const topicBadges = session.topics && session.topics.length > 0 
            ? session.topics.map(topic => `<span class="badge badge-topic">${Utils.sanitizeHTML(topic)}</span>`).join('')
            : '';
        
        const sessionAnchor = Utils.createSessionAnchor(session);
        
        return `
            <div class="session" 
                 id="${sessionAnchor}"
                 data-session-id="${session.id}"
                 data-language="${session.language.toLowerCase()}"
                 data-speakers="${session.speakers.join(',')}"
                 data-type="${session.type}"
                 data-topics="${(session.topics || []).join(',').toLowerCase()}"
                 data-day="${date}"
                 tabindex="0"
                 role="button"
                 aria-expanded="false"
                 aria-label="Session: ${session.title}">
                <div class="session-header" data-session-toggle="${session.id}">
                    <div class="session-mobile-layout">
                        <div class="session-mobile-header">
                            <span class="session-time">${formattedTime}</span>
                            <span class="session-meta-mobile">${session.language} • ${session.type}</span>
                        </div>
                        <div class="session-content">
                            <div class="session-info">
                                ${speakerNames ? `<div class="session-speaker-name">${Utils.sanitizeHTML(speakerNames)}</div>` : ''}
                                <div class="session-title">${Utils.sanitizeHTML(session.title)}</div>
                                ${topicBadges ? `<div class="session-topics">${topicBadges}</div>` : ''}
                            </div>
                            <div class="session-expand-icon">
                                <span class="sr-only">Toggle details</span>
                                <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M7 10l5 5 5-5z"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <div class="session-desktop-layout">
                        <div class="session-time">${formattedTime}</div>
                        <div class="session-content">
                            <div class="session-meta-inline">
                                <span class="session-language">${session.language}</span>
                                <span class="meta-separator">•</span>
                                <span class="session-type">${session.type}</span>
                            </div>
                            <h4 class="session-title">${Utils.sanitizeHTML(session.title)}</h4>
                            ${topicBadges ? `<div class="session-badges-topics">${topicBadges}</div>` : ''}
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
        if (!speakerData) {
            return `<div class="speaker-fallback">
                ${Utils.getInitials('TBD')}
            </div>`;
        }
        
        const speakerId = typeof speakerData === 'string' ? speakerData : speakerData.id;
        const speaker = AppState.eventData.speakers[speakerId];
        
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
        if (!AppState.isDataReady) {
            return;
        }

        this.container.addEventListener('click', (e) => {
            const toggleElement = e.target.closest('[data-session-toggle]');
            if (toggleElement) {
                const sessionId = toggleElement.dataset.sessionToggle;
                this.toggleSessionDetails(sessionId);
                return;
            }
        });

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

        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('speaker-avatar') || e.target.classList.contains('speaker-fallback')) {
                const speakerId = e.target.dataset.speakerId;
                if (speakerId && AppState.isDataReady) {
                    this.modalHandler.showSpeaker(speakerId);
                }
            }
        });

        this.container.addEventListener('click', (e) => {
            const speakerDetail = e.target.closest('.session-speaker-detail');
            if (speakerDetail) {
                const speakerId = speakerDetail.dataset.speakerId;
                if (speakerId && AppState.isDataReady) {
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
        
        if (!isExpanded) {
            const session = AppState.eventData?.sessionsById[sessionId];
            
            if (session) {
                const sessionAnchor = sessionElement.id;
                if (window.history && window.history.pushState && sessionAnchor) {
                    window.history.pushState(null, '', `#${sessionAnchor}`);
                }
                
                const sessionTitle = Utils.ensureNonEmptyString(session.title, 'Unknown Session');
                const topics = session.topics || [];
                
                Analytics.trackSessionDetailsView(sessionTitle, topics);
            } else {
                Analytics.trackSessionDetailsView('Session Not Found', []);
            }
        }
        
        if (isExpanded) {
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
            sessionElement.classList.add('expanded');
            sessionElement.setAttribute('aria-expanded', 'true');
            
            detailsElement.style.maxHeight = 'none';
            const height = detailsElement.scrollHeight;
            detailsElement.style.maxHeight = '0';
            
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
        const { day, language, speaker, type, topic } = AppState.filters;
        
        document.querySelectorAll('.session').forEach(sessionElement => {
            let visible = true;

            if (day && sessionElement.dataset.day !== day) visible = false;
            if (language && sessionElement.dataset.language !== language.toLowerCase()) visible = false;
            if (speaker && !sessionElement.dataset.speakers.split(',').includes(speaker)) visible = false;
            if (type && sessionElement.dataset.type !== type) visible = false;
            if (topic && !sessionElement.dataset.topics?.toLowerCase().includes(topic.toLowerCase())) visible = false;

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
        const session = AppState.eventData?.sessionsById[sessionId];
        if (session) {
            for (const day of AppState.eventData.schedule) {
                if (day.sessions.some(s => s.id === sessionId)) {
                    return { ...session, date: day.date, dayName: day.dayName };
                }
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

class SpeakersRenderer {
    constructor(modalHandler) {
        this.container = document.getElementById('speakers-container');
        this.modalHandler = modalHandler;
        this.loadedCount = 0;
        this.batchSize = 12;
        this.allSpeakers = [];
        this.isLoading = false;
    }

    render() {
        if (!AppState.eventData?.speakers) {
            this.renderError('No speakers data available');
            return;
        }

        try {
            this.allSpeakers = Object.entries(AppState.eventData.speakers)
                .sort(([,a], [,b]) => a.name.localeCompare(b.name));

            if (this.allSpeakers.length === 0) {
                this.renderError('No speakers available');
                return;
            }

            this.loadedCount = 0;
            this.container.innerHTML = '';
            
            this.loadNextBatch();
            
            if (this.allSpeakers.length > this.batchSize) {
                this.setupIncrementalLoading();
            }
            
            this.bindEvents();
        } catch (error) {
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
        
        if (this.loadedCount === 0) {
            this.container.innerHTML = batchHTML;
        } else {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = batchHTML;
            
            Array.from(tempDiv.children).forEach((card, index) => {
                setTimeout(() => {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                    this.container.appendChild(card);
                    
                    requestAnimationFrame(() => {
                        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    });
                }, index * 20);
            });
        }
        
        this.loadedCount += nextBatch.length;
        this.isLoading = false;
        
        this.updateLoadMoreButton();
    }
    
    setupIncrementalLoading() {
        const loadMoreButton = document.createElement('div');
        loadMoreButton.className = 'load-more-container';
        loadMoreButton.innerHTML = `
            <button class="btn btn-outline load-more-btn" id="loadMoreSpeakers">
                Load More Speakers
                <span class="speakers-count">(${this.allSpeakers.length - this.batchSize} remaining)</span>
            </button>
        `;
        
        this.container.parentNode.appendChild(loadMoreButton);
        
        document.getElementById('loadMoreSpeakers')?.addEventListener('click', () => {
            this.loadNextBatch();
        });
        
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
            if (loadMoreContainer) {
                loadMoreContainer.remove();
            }
        } else if (loadMoreBtn) {
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

        const speakerAnchor = Utils.createSpeakerAnchor(speaker.name);

        return `
            <div class="speaker-card" id="${speakerAnchor}" data-speaker-id="${speakerId}">
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
        if (!AppState.isDataReady) {
            return;
        }

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
                
                Analytics.trackTimezoneChange(timezone);
            });
        });
    }

    setActiveTimezone(timezone) {
        this.buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tz === timezone);
        });
    }
}

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

const Analytics = {
    track(eventName, parameters = {}) {
        const validatedParams = {};
        
        Object.entries(parameters).forEach(([key, value]) => {
            validatedParams[key] = Utils.ensureNonEmptyString(value, 'Not Specified');
        });
        
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, validatedParams);
        }
    },
    
    trackRegistrationClick(location = 'header') {
        if (window.EventAnalytics && window.CookieConsent && window.CookieConsent.canTrack()) {
            window.EventAnalytics.trackRegistrationClick(location);
            return;
        }
        
        this.track('registration_click', {
            link_location: location,
            transport_type: 'beacon'
        });
    },
    
    trackCFPClick() {
        if (window.EventAnalytics && window.CookieConsent && window.CookieConsent.canTrack()) {
            window.EventAnalytics.trackCFPClick();
            return;
        }
        
        this.track('cfp_click', {
            link_location: 'navigation',
            transport_type: 'beacon'
        });
    },
    
    trackSessionDetailsView(sessionTitle, sessionTopics = []) {
        if (window.EventAnalytics && window.CookieConsent && window.CookieConsent.canTrack()) {
            const session = Object.values(AppState.eventData?.sessionsById || {})
                .find(s => s.title === sessionTitle);
            
            if (session) {
                const speakerNames = session.speakers.map(id => 
                    AppState.eventData?.speakers[id]?.name || 'Unknown'
                );
                
                window.EventAnalytics.trackSessionInterest({
                    title: session.title,
                    day: session.date,
                    speakers: speakerNames,
                    language: session.language,
                    topics: session.topics
                });
                return;
            }
        }
        
        const validTitle = Utils.ensureNonEmptyString(sessionTitle, 'Unknown Session');
        const validTopics = sessionTopics.filter(t => t && t.trim()).join(', ') || 'No Topics';
        
        this.track('view_session_details', {
            session_title: validTitle,
            session_topics: validTopics,
            topics_count: sessionTopics.length
        });
    },
    
    trackSpeakerProfileView(speakerName, isJavaChampion = false) {
        if (window.EventAnalytics && window.CookieConsent && window.CookieConsent.canTrack()) {
            window.EventAnalytics.trackSpeakerView({
                name: speakerName,
                isJavaChampion: isJavaChampion,
                company: ''
            });
            return;
        }
        
        const validName = Utils.ensureNonEmptyString(speakerName, 'Unknown Speaker');
        
        this.track('view_speaker_profile', {
            speaker_name: validName,
            is_java_champion: isJavaChampion
        });
    },
    
    trackFilterUse(filterType, filterValue) {
        if (window.EventAnalytics && window.CookieConsent && window.CookieConsent.canTrack()) {
            window.EventAnalytics.trackFilterUse(filterType, filterValue);
            return;
        }
        
        const validType = Utils.ensureNonEmptyString(filterType, 'Unknown Filter');
        const validValue = Utils.ensureNonEmptyString(filterValue, 'No Value');
        
        this.track('filter_used', {
            filter_type: validType,
            filter_value: validValue
        });
    },
    
    trackTimezoneChange(timezone) {
        if (window.EventAnalytics && window.CookieConsent && window.CookieConsent.canTrack()) {
            window.EventAnalytics.trackTimezoneChange(timezone);
            return;
        }
        
        const validTimezone = Utils.ensureNonEmptyString(timezone, 'Unknown Timezone');
        
        this.track('change_timezone', {
            timezone: validTimezone
        });
    }
};

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
        this.initAnalytics();
        this.initAnchorHandling();
    }
    
    initAnchorHandling() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="#"]');
            if (link) {
                const targetId = link.getAttribute('href').substring(1);
                
                const speakerCard = e.target.closest('.speaker-card');
                if (speakerCard) {
                    return;
                }
                
                e.preventDefault();
                this.scrollToAnchor(targetId);
                
                if (window.history && window.history.pushState) {
                    window.history.pushState(null, '', `#${targetId}`);
                }
            }
        });
        
        window.addEventListener('popstate', () => {
            this.handleHashChange();
        });
        
        window.addEventListener('hashchange', () => {
            this.handleHashChange();
        });
    }
    
    scrollToAnchor(targetId) {
        const element = document.getElementById(targetId);
        if (element) {
            const header = document.querySelector('.nav');
            const headerHeight = header ? header.offsetHeight : 0;
            const offset = headerHeight + 20;
            
            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - offset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            
            if (element.classList.contains('session')) {
                setTimeout(() => {
                    const sessionId = element.dataset.sessionId;
                    if (sessionId && !element.classList.contains('expanded')) {
                        this.scheduleRenderer.toggleSessionDetails(sessionId);
                    }
                }, 600);
            }
        }
    }
    
    handleHashChange() {
        const hash = window.location.hash.substring(1);
        if (hash) {
            if (AppState.isDataReady) {
                const targetElement = document.getElementById(hash);
                if (targetElement && targetElement.classList.contains('speaker-card')) {
                    const speakerId = targetElement.dataset.speakerId;
                    if (speakerId) {
                        this.modalHandler.showSpeaker(speakerId);
                        return;
                    }
                }
                
                this.scrollToAnchor(hash);
            } else {
                this.pendingHash = hash;
            }
        }
    }
    
    initAnalytics() {
        document.querySelectorAll('a[href*="soujava.dev/30y-celebration-week"]').forEach(link => {
            link.addEventListener('click', () => {
                const location = link.closest('header') ? 'header' : 
                               link.closest('nav') ? 'nav' : 
                               link.closest('.cta-section') ? 'cta_section' : 'other';
                Analytics.trackRegistrationClick(location);
            });
        });
        
        document.querySelectorAll('a[href*="sessionize.com"]').forEach(link => {
            link.addEventListener('click', () => {
                Analytics.trackCFPClick();
            });
        });
        
        document.querySelectorAll('a[href*="aletyx.com"]').forEach(link => {
            link.addEventListener('click', () => {
                if (window.EventAnalytics && window.CookieConsent && window.CookieConsent.canTrack()) {
                    window.EventAnalytics.trackPartnerClick('Aletyx');
                } else {
                    Analytics.track('supporter_click', {
                        event_category: 'Supporter Engagement',
                        event_label: 'Aletyx',
                        supporter_name: 'Aletyx',
                        supporter_type: 'partner',
                        link_location: 'footer'
                    });
                }
            });
        });
        
        document.querySelectorAll('a[href*="soujava.org"]').forEach(link => {
            link.addEventListener('click', () => {
                if (window.EventAnalytics && window.CookieConsent && window.CookieConsent.canTrack()) {
                    window.EventAnalytics.trackPartnerClick('SouJava');
                } else {
                    Analytics.track('organizer_click', {
                        event_category: 'Organizer Engagement',
                        event_label: 'SouJava',
                        organizer_name: 'SouJava',
                        link_location: 'footer'
                    });
                }
            });
        });
        
        document.addEventListener('click', (e) => {
            const socialLink = e.target.closest('.social-link, .speaker-social-link');
            if (socialLink) {
                const platform = socialLink.href.includes('linkedin') ? 'LinkedIn' : 'Twitter';
                const speakerCard = socialLink.closest('.speaker-profile, .speaker-card');
                const speakerName = speakerCard?.querySelector('.speaker-name, .speaker-profile-name')?.textContent || 'Unknown';
                
                Analytics.track('speaker_social_click', {
                    event_category: 'Speaker Social',
                    event_label: `${speakerName} - ${platform}`,
                    social_platform: platform,
                    speaker_name: speakerName
                });
            }
        });
    }

    initMobileNav() {
        const navToggle = document.querySelector('.nav-toggle');
        const navLinks = document.querySelector('.nav-links');
        
        if (navToggle && navLinks) {
            navToggle.addEventListener('click', () => {
                navLinks.classList.toggle('active');
            });
            
            navLinks.addEventListener('click', (e) => {
                if (e.target.tagName === 'A') {
                    navLinks.classList.remove('active');
                }
            });
            
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
            AppState.isDataReady = false;
            this.scheduleRenderer.renderLoading();
            this.speakersRenderer.renderLoading();

            AppState.eventData = await DataLoader.loadEventData();
            AppState.isLoading = false;
            AppState.error = null;
            AppState.isDataReady = true;

            if (AppState.eventData.speakers) {
                this.imagePreloader.preloadSpeakerImages(AppState.eventData.speakers);
                this.speakerCarousel.populate(AppState.eventData.speakers);
            }

            this.scheduleRenderer.render();
            this.speakersRenderer.render();
            this.filterController.initializeFilters();
            
            this.animationController.observeNewElements();
            
            if (this.pendingHash) {
                setTimeout(() => {
                    const targetElement = document.getElementById(this.pendingHash);
                    if (targetElement && targetElement.classList.contains('speaker-card')) {
                        const speakerId = targetElement.dataset.speakerId;
                        if (speakerId) {
                            this.modalHandler.showSpeaker(speakerId);
                            this.pendingHash = null;
                            return;
                        }
                    }
                    
                    this.scrollToAnchor(this.pendingHash);
                    this.pendingHash = null;
                }, 100);
            } else {
                this.handleHashChange();
            }

        } catch (error) {
            AppState.isLoading = false;
            AppState.isDataReady = false;
            AppState.error = error.message;
            
            this.scheduleRenderer.renderError(error.message);
            this.speakersRenderer.renderError(error.message);
        }
    }
}

window.addEventListener('error', function(e) {
    if (e.error && e.error.message && e.error.message.includes('ResizeObserver')) {
        e.preventDefault();
        return;
    }
});

window.addEventListener('unhandledrejection', function(e) {
    if (e.reason && (e.reason.toString().includes('fetch') || e.reason.toString().includes('network'))) {
        e.preventDefault();
        return;
    }
});

function applyHeroCtaConfig() {
  const primaryBtn = document.getElementById('primaryCtaButton');
  const secondaryBtn = document.getElementById('secondaryCtaButton');

  if (primaryBtn && HERO_CTA_CONFIG.primary && HERO_CTA_CONFIG.primary.text) {
    primaryBtn.textContent = HERO_CTA_CONFIG.primary.text;
    primaryBtn.href = HERO_CTA_CONFIG.primary.link;
    primaryBtn.target = "_blank";
    primaryBtn.rel = "noopener";
    primaryBtn.style.display = 'inline-flex';
  }

  if (secondaryBtn && HERO_CTA_CONFIG.showSecondaryButton && HERO_CTA_CONFIG.secondary && HERO_CTA_CONFIG.secondary.text) {
    secondaryBtn.textContent = HERO_CTA_CONFIG.secondary.text;
    secondaryBtn.href = HERO_CTA_CONFIG.secondary.link;
    secondaryBtn.target = "_blank";
    secondaryBtn.rel = "noopener";
    secondaryBtn.style.display = 'inline-flex';
  } else if (secondaryBtn) {
    secondaryBtn.style.display = 'none';
  }
}

let app;
let modalHandler;

function initApp() {
    app = new App();
    modalHandler = app.modalHandler;
    app.init();
    
    applyHeroCtaConfig();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
