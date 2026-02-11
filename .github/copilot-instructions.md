# Copilot Instructions for AI Agents

## Project Overview
This is a static web application for managing and displaying sports fixtures, player lists, schedules, and hosting/joining games. The project is organized by feature, with each major page having its own HTML, CSS, and JavaScript files.

## Key Structure
- `index.html`, `host.html`, `join.html`, `fixtures.html`, `players.html`, `schedule.html`: Main entry points for different app sections.
- `scripts/`: Contains JavaScript files, each named after the page or feature it supports (e.g., `host.js`, `fixtures.js`).
- `styles/`: Contains CSS files, each named after the page or feature it styles (e.g., `host.css`, `fixtures.css`).

## Patterns & Conventions
- **One-to-one mapping**: Each HTML file is paired with a JS and CSS file of the same name for logic and styling.
- **No build step**: This is a static site; there is no bundler or build process. All scripts and styles are loaded directly in HTML.
- **No backend**: All logic is client-side. There are no API calls or server-side code in this repo.
- **Authentication**: If present, handled in `scripts/auth.js`.
- **Navigation**: Each page is standalone; navigation is via links between HTML files.

## Developer Workflows
- **To test changes**: Open the relevant HTML file in a browser. No local server is required unless using features that require `file://` restrictions to be bypassed.
- **Debugging**: Use browser dev tools (Console, Network, Elements) to debug JS and CSS.
- **Adding features**: Add new HTML, JS, and CSS files as needed, following the naming convention.

## Examples
- To update player logic, edit `players.html`, `scripts/players.js`, and `styles/players.css`.
- To add a new page (e.g., "results"), create `results.html`, `scripts/results.js`, and `styles/results.css`.

## Important Files
- `scripts/auth.js`: Handles authentication logic (if any).
- `scripts/fixtures.js`, `scripts/schedule.js`, etc.: Feature-specific logic.
- `styles/`: All CSS, organized by feature.

## AI Agent Guidance
- Follow the one-to-one file mapping for new features.
- Do not introduce a build system or backend code.
- Keep all logic client-side and modular by feature.
- Reference existing files for examples of structure and naming.
