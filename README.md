# SouJava 30-Year Celebration Week Website

This is the static site for the SouJava 30-Year Celebration Week, published at:

👉 **[https://soujava.github.io/java30y-celebration-week/](https://soujava.github.io/java30y-celebration-week/)**

## About
- Modern, mobile-friendly, and fully static event site.
- All content is driven by JSON files for easy updates via pull request.
- No build step, no backend, no frameworks—just HTML, CSS (Tailwind via CDN), and vanilla JS.

## How to Update Speaker or Talk Data

All event content is managed in two JSON files at the repo root:

- [`speakers.json`](./speakers.json): Speaker bios, images, and social links.
- [`talks.json`](./talks.json): Schedule, talk titles, descriptions, language, and speaker assignments.

### To update your info or propose a new talk:
1. **Fork the repository** and create a branch.
2. **Edit the relevant JSON file(s):**
   - Add or update your entry in `speakers.json` (use your existing `id` if present).
   - Add or update your talk/session in `talks.json` (reference speakers by their `id`).
3. **Submit a pull request.**
   - PRs are reviewed for JSON validity and event fit.
   - No need to touch HTML, CSS, or JS for content changes.

**Tips:**
- Use `\n\n` for paragraph breaks in bios or talk descriptions.
- Speaker images must be placed in `speakers-pics/` and referenced by filename in the JSON.
- All changes are live on the site within minutes after merge (GitHub Pages auto-deploy).

## Live Site
[https://soujava.github.io/java30y-celebration-week/](https://soujava.github.io/java30y-celebration-week/)

---

For technical/design issues, open an issue or PR. For event/content questions, contact [Karina Varela](https://www.linkedin.com/me/kvarel4) or another member of the SouJava team. 