import { JSDOM } from 'jsdom';

// Initialize JSDOM
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:4028'
});

global.window = dom.window;
global.document = dom.window.document;
global.location = dom.window.location;
global.localStorage = dom.window.localStorage;

Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  writable: true,
  configurable: true
});

Object.defineProperty(global, 'crypto', {
  value: dom.window.crypto || {},
  writable: true,
  configurable: true
});

// Fallback for crypto.randomUUID if jsdom is old/lacks it in http mode
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = () => '11111111-1111-1111-1111-111111111111';
}

console.log("Evaluating store.js and App.jsx inside jsdom environment...");

try {
  // Use dynamic imports to evaluate modules after jsdom is configured
  const { useStore } = await import('./core/store.js');
  console.log("✅ store.js evaluated successfully! Keys:", Object.keys(useStore.getState()));
  
  const { default: App } = await import('./App.jsx');
  console.log("✅ App.jsx evaluated successfully!");

  const { default: Routes } = await import('./Routes.jsx');
  console.log("✅ Routes.jsx evaluated successfully!");

  console.log("Evaluation complete. No load-time errors found!");
} catch (err) {
  console.error("❌ Evaluation crashed with error:", err);
  process.exit(1);
}
