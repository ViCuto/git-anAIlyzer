# Vanilla Frontend Patterns & Design

Guide for building the Git-AnAIlyzer frontend using Vanilla JS, Tailwind CSS, and Chart.js, combined with opinionated studio-level design principles.

## Core Technical Rules
1. **No Frameworks:** Strictly use Vanilla JavaScript (ES6+). Do NOT use React, Vue, or Angular.
2. **Styling:** Use Tailwind CSS classes for all styling. Avoid writing custom CSS unless absolutely necessary.
3. **State Management:** Keep data fetching and state separate from DOM rendering and event wiring.
4. **DOM Updates:** Update the DOM through focused `renderX()` functions instead of scattered inline mutations.

## Chart.js Lifecycle (CRITICAL)
- Always check if a chart instance already exists on a canvas before creating a new one.
- If a chart exists, call `chart.destroy()` before rendering the new data to prevent memory leaks and "hover glitch" bugs.

## Design & Aesthetic Principles
- **Reject Defaults:** Avoid generic AI aesthetics (e.g., standard cream backgrounds with terracotta accents, or generic broadsheet layouts). Make deliberate, opinionated choices about palette and layout that fit a developer-focused analytics tool.
- **Typography:** Pair display and body fonts deliberately. Set a clear type scale with intentional weights and spacing. The typography should carry the personality of the dashboard.
- **Structure is Information:** Use structural devices (numbering, dividers, labels) only to encode real structural data, not just for decoration.
- **Motion:** Use motion deliberately (e.g., page-load sequences, hover micro-interactions). Do not over-animate, as scattered effects feel cheap and AI-generated.

## UI Copywriting
- **Active Voice:** Write from the end user's perspective. Controls should state exactly what happens (e.g., "Analyze Profile" instead of "Submit").
- **Error Handling:** Treat failure (like a 404 User Not Found) as a moment for direction. Explain what went wrong in plain terms and invite the user to try again. Do not apologize, just guide them.

## Example Technical Structure
```javascript
let currentChart = null;

function renderLanguageChart(canvasElement, data) {
    if (currentChart) {
        currentChart.destroy();
    }
    
    currentChart = new Chart(canvasElement, {
        type: 'doughnut',
        data: data,
        options: { responsive: true }
    });
}
```