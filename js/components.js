// Component System
import { templates } from './templates.js';

export class Component {
    constructor(container) {
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
    }

    render(html) {
        if (this.container) {
            this.container.innerHTML = html;
        }
    }

    append(html) {
        if (this.container) {
            this.container.insertAdjacentHTML('beforeend', html);
        }
    }
}

export class SpeakerComponent extends Component {
    constructor(container, speakers, options = {}) {
        super(container);
        this.speakers = speakers;
        this.options = options;
        this.loadedCount = 0;
        this.batchSize = options.batchSize || 12;
    }

    renderCard(id, speaker) {
        return templates.speakerCard({
            id,
            name: speaker.name,
            title: speaker.title,
            image: speaker.image,
            social: speaker.social
        });
    }

    renderBatch(start, end) {
        const speakers = Object.entries(this.speakers).slice(start, end);
        return speakers.map(([id, speaker]) => this.renderCard(id, speaker)).join('');
    }
}

export class CarouselComponent extends Component {
    constructor(container, speakers) {
        super(container);
        this.speakers = speakers;
    }

    render() {
        const availableSpeakers = Object.entries(this.speakers).slice(0, 12);
        const duplicated = [...availableSpeakers, ...availableSpeakers];
        
        const html = duplicated.map(([id, speaker]) => 
            templates.carouselSpeaker({
                id,
                name: speaker.name,
                title: speaker.title,
                image: speaker.image
            })
        ).join('');

        super.render(html);
    }
}
