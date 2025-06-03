// HTML Templates Module
import { createIcon } from './icons.js';

export const templates = {
    speakerCard({ id, name, title, image, social }) {
        const socialLinks = social ? Object.entries(social)
            .map(([platform, url]) => `
                <a href="${url}" target="_blank" rel="noopener" 
                   class="speaker-social-link" aria-label="${platform}">
                    ${createIcon(platform)}
                </a>
            `).join('') : '';

        return `
            <div class="speaker-card" data-speaker-id="${id}">
                <img src="${image}" alt="${name}" class="speaker-image"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="speaker-card-fallback" style="display: none;">
                    ${this.getInitials(name)}
                </div>
                <div class="speaker-info">
                    <h3 class="speaker-name">${this.sanitize(name)}</h3>
                    <p class="speaker-title">${this.sanitize(title)}</p>
                    ${socialLinks ? `<div class="speaker-social">${socialLinks}</div>` : ''}
                </div>
            </div>
        `;
    },

    carouselSpeaker({ id, name, title, image }) {
        return `
            <a href="#speakers" class="carousel-speaker" data-speaker-id="${id}">
                <img src="${image}" alt="${name}" class="carousel-speaker-image"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="carousel-speaker-fallback" style="display: none;">
                    ${this.getInitials(name)}
                </div>
                <div class="carousel-speaker-info">
                    <div class="carousel-speaker-name">${this.sanitize(name)}</div>
                    <div class="carousel-speaker-title">${this.sanitize(title)}</div>
                </div>
            </a>
        `;
    },

    sessionSpeakerDetail({ id, name, title, image }) {
        return `
            <div class="session-speaker-detail" data-speaker-id="${id}">
                <img src="${image}" alt="${name}" class="session-speaker-avatar"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="session-speaker-fallback" style="display: none;">
                    ${this.getInitials(name)}
                </div>
                <div class="session-speaker-info">
                    <div class="session-speaker-name">${this.sanitize(name)}</div>
                    <div class="session-speaker-title">${this.sanitize(title)}</div>
                </div>
            </div>
        `;
    },

    speakerAvatar({ id, name, image }) {
        return `
            <img src="${image}" alt="${name}" class="speaker-avatar" 
                 data-speaker-id="${id}"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="speaker-fallback" style="display: none;" data-speaker-id="${id}">
                ${this.getInitials(name)}
            </div>
        `;
    },

    javaChampionBadge() {
        return `
            <span class="java-champion-badge">
                ${createIcon('crown')}
                Java Champion
            </span>
        `;
    },

    // Helper methods
    sanitize(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    getInitials(name) {
        return name.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }
};
