// @vitest-environment jsdom

import { describe, it } from 'vitest';
import { useStore } from './store';
import AppRoutes from '../Routes';
import { MusicContext } from '../context/MusicContext';

describe('Import and Evaluation Tests', () => {
  it('should evaluate store, routes, and context without throwing compile or load-time errors', () => {
    try {
      console.log("✅ store:", typeof useStore);
      console.log("✅ routes:", typeof AppRoutes);
      console.log("✅ context:", typeof MusicContext);
    } catch (err) {
      console.error("❌ Evaluation failed:", err);
      throw err;
    }
  });
});
