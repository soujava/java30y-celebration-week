/**
 * Event Analytics for Java 30Y Celebration
 * Two-tier approach: Anonymous metrics + Enhanced tracking with consent
 */

const EventAnalytics = {
    // Track basic anonymous metrics (no consent needed)
    trackAnonymousEvent(eventName, parameters = {}) {
        if (typeof gtag === 'undefined') return;
        
        // Only send non-personal, anonymous events
        const anonymousParams = {
            ...parameters,
            'anonymize_ip': true,
            'allow_google_signals': false,
            'allow_ad_personalization_signals': false
        };
        
        gtag('event', eventName, anonymousParams);
    },
    // Track which sessions people are actually interested in
    trackSessionInterest(session) {
        if (typeof gtag === 'undefined' || !CookieConsent.canTrack()) return;
        
        gtag('event', 'view_session_details', {
            event_category: 'Content',
            session_title: session.title || 'Unknown',
            session_day: session.day || 'Unknown',
            session_speakers: session.speakers?.join(', ') || 'No speakers',
            session_language: session.language || 'Unknown',
            session_topics: session.topics?.join(', ') || 'No topics'
        });
    },

    // Track speaker profile views - who's popular?
    trackSpeakerView(speaker) {
        if (typeof gtag === 'undefined' || !CookieConsent.canTrack()) return;
        
        gtag('event', 'view_speaker', {
            event_category: 'Content',
            speaker_name: speaker.name || 'Unknown',
            is_java_champion: speaker.isJavaChampion || false,
            speaker_company: speaker.company || 'Unknown'
        });
    },

    // Track registration intent
    trackRegistrationClick(location) {
        if (typeof gtag === 'undefined' || !CookieConsent.canTrack()) return;
        
        gtag('event', 'click_register', {
            event_category: 'Registration',
            click_location: location, // 'header', 'nav', 'cta_section'
            sessions_viewed_before_click: this.getViewedSessionsCount(),
            time_on_page: Math.round((Date.now() - performance.timing.navigationStart) / 1000),
            transport_type: 'beacon'
        });
    },

    // Track how people use filters - what are they looking for?
    trackFilterUse(filterType, filterValue) {
        if (typeof gtag === 'undefined' || !CookieConsent.canTrack()) return;
        
        gtag('event', 'use_filter', {
            event_category: 'Navigation',
            filter_type: filterType,
            filter_value: filterValue,
            results_shown: document.querySelectorAll('.session:not([style*="display: none"])').length
        });
    },

    // Track timezone changes - where's our audience?
    trackTimezoneChange(timezone) {
        if (typeof gtag === 'undefined' || !CookieConsent.canTrack()) return;
        
        gtag('event', 'change_timezone', {
            event_category: 'Preferences',
            timezone: timezone
        });
    },

    // Simple scroll tracking - are people exploring the content?
    initScrollTracking() {
        let maxScroll = 0;
        
        window.addEventListener('scroll', this.debounce(() => {
            const scrollPercent = Math.round((window.scrollY / 
                (document.documentElement.scrollHeight - window.innerHeight)) * 100);
            
            // Only track milestones: 25%, 50%, 75%, 100%
            [25, 50, 75, 100].forEach(milestone => {
                if (scrollPercent >= milestone && maxScroll < milestone) {
                    maxScroll = milestone;
                    
                    if (CookieConsent.canTrack()) {
                        gtag('event', 'scroll', {
                            event_category: 'Engagement',
                            percent_scrolled: milestone
                        });
                    }
                }
            });
        }, 300));
    },

    // Track which day tabs are most viewed
    trackDayView(dayDate) {
        if (typeof gtag === 'undefined' || !CookieConsent.canTrack()) return;
        
        gtag('event', 'view_day_schedule', {
            event_category: 'Navigation',
            day_viewed: dayDate
        });
    },

    // Track CFP interest
    trackCFPClick() {
        if (typeof gtag === 'undefined' || !CookieConsent.canTrack()) return;
        
        gtag('event', 'click_cfp', {
            event_category: 'Engagement',
            transport_type: 'beacon'
        });
    },

    // Track partner/sponsor clicks
    trackPartnerClick(partnerName) {
        if (typeof gtag === 'undefined' || !CookieConsent.canTrack()) return;
        
        gtag('event', 'click_partner', {
            event_category: 'Partners',
            partner_name: partnerName,
            transport_type: 'beacon'
        });
    },

    // Simple engagement score when they leave
    trackExitEngagement() {
        if (typeof gtag === 'undefined' || !CookieConsent.canTrack()) return;
        
        const scrollPercent = Math.round((window.scrollY / 
            (document.documentElement.scrollHeight - window.innerHeight)) * 100);
        
        gtag('event', 'page_exit', {
            event_category: 'Engagement',
            final_scroll_depth: scrollPercent,
            sessions_viewed: this.getViewedSessionsCount(),
            speakers_viewed: this.getViewedSpeakersCount(),
            time_on_page: Math.round((Date.now() - performance.timing.navigationStart) / 1000),
            transport_type: 'beacon'
        });
    },

    // Helper: Count viewed sessions
    getViewedSessionsCount() {
        return document.querySelectorAll('.session.expanded').length;
    },

    // Helper: Count viewed speakers  
    getViewedSpeakersCount() {
        return parseInt(sessionStorage.getItem('speakers_viewed_count') || '0');
    },

    // Helper: Simple debounce
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
    },

    // Initialize all tracking
    init() {
        // ALWAYS track basic anonymous metrics
        this.initBasicTracking();
        
        // Only initialize enhanced tracking if we have consent
        if (CookieConsent.canTrack()) {
            this.initEnhancedTracking();
        }
    },
    
    // Basic anonymous tracking - always runs
    initBasicTracking() {
        // Track basic page navigation
        this.trackAnonymousEvent('page_view', {
            page_location: window.location.pathname,
            page_title: document.title
        });
        
        // Track registration clicks anonymously
        document.querySelectorAll('a[href*="soujava.dev/30y-celebration-week"]').forEach(link => {
            link.addEventListener('click', () => {
                this.trackAnonymousEvent('registration_intent', {
                    click_location: link.closest('header') ? 'header' : 
                                   link.closest('nav') ? 'nav' : 
                                   link.closest('.cta-section') ? 'cta' : 'other'
                });
            });
        });
    },
    
    // Enhanced tracking - only with consent
    initEnhancedTracking() {
        // Scroll tracking
        this.initScrollTracking();
        
        // Exit tracking
        window.addEventListener('beforeunload', () => this.trackExitEngagement());
        
        // Track speaker views in sessionStorage for exit metrics
        document.addEventListener('click', (e) => {
            if (e.target.closest('.speaker-card') || e.target.closest('[data-speaker-id]')) {
                const count = parseInt(sessionStorage.getItem('speakers_viewed_count') || '0');
                sessionStorage.setItem('speakers_viewed_count', count + 1);
            }
        });
    }
};

// Initialize immediately for basic tracking
// Enhanced features will activate if/when consent is given
document.addEventListener('DOMContentLoaded', () => {
    EventAnalytics.init();
});

// Export for use in main.js
window.EventAnalytics = EventAnalytics;