import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tagger from "@dhiwise/component-tagger";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isLite = env.VITE_APP_MODE === 'lite';
  const rootDir = process.cwd();

  const backendTarget = process.env.DOCKER_ENV === 'true'
    ? 'http://backend:8081'
    : 'http://localhost:8081';

  const plugins = [
    react(),
    tagger(),
  ];

  const srcPath = path.resolve(__dirname, "./src");

  const aliases = {
    "@": srcPath,
  };

  if (isLite) {
    const emptyModule = path.resolve(__dirname, "./src/emptyModule.jsx");
    aliases['framer-motion'] = emptyModule;
    aliases['recharts'] = emptyModule;
  }


  // ═══ Teltonika TRB950 Local Modem SMS Plugin ═══
  // Primary: Send via modem at 192.168.1.1:4433
  // Fallback: Cloud API at sapi.itnewsletter.co.il
  const smsModemPlugin = () => ({
    name: 'sms-modem-gateway',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Only intercept SMS send requests
        if (req.method !== 'POST' || !req.url?.includes('/api/sms/sendSmsToRecipients')) {
          return next();
        }

        // Parse request body
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const phone = (data.destinations || '').replace(/\D/g, '');
            const text = data.txtSMSmessage || '';
            const time = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });

            if (!phone || !text) {
              return next(); // Let proxy handle invalid requests
            }

            console.log(`\n📱 ═══════════════════════════════════════`);
            console.log(`📱 SMS OUT  │ ${time}`);
            console.log(`📱 Phone    │ ${phone}`);
            console.log(`📱 Message  │ ${text.slice(0, 50)}...`);

            // ── Try Teltonika Modem First ──
            try {
              const https = await import('https');
              const modemUrl = `https://192.168.1.1:4433/cgi-bin/sms_send?username=icaffeos&password=Nati1111&number=${phone}&text=${encodeURIComponent(text)}`;

              const modemResult = await new Promise((resolve, reject) => {
                const modemReq = https.get(modemUrl, { rejectUnauthorized: false, timeout: 8000 }, (modemRes) => {
                  let responseData = '';
                  modemRes.on('data', chunk => responseData += chunk);
                  modemRes.on('end', () => {
                    if (modemRes.statusCode >= 200 && modemRes.statusCode < 300) {
                      resolve({ success: true, data: responseData });
                    } else {
                      reject(new Error(`Modem HTTP ${modemRes.statusCode}: ${responseData}`));
                    }
                  });
                });
                modemReq.on('error', reject);
                modemReq.on('timeout', () => { modemReq.destroy(); reject(new Error('Modem timeout')); });
              });

              console.log(`📱 Method   │ 🏭 MODEM (Teltonika TRB950)`);
              console.log(`✅ Modem Response │ ${modemResult.data.slice(0, 120)}`);
              console.log(`📱 ═══════════════════════════════════════\n`);

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, result: 1, resultJSON: '[]', errDesc: '', method: 'modem' }));
              return;

            } catch (modemErr) {
              console.log(`📱 Method   │ ⚠️ MODEM FAILED → Falling back to Cloud API`);
              console.log(`📱 Error    │ ${modemErr.message}`);
            }

            // ── Fallback: Cloud SMS API ──
            try {
              const cloudUrl = 'https://sapi.itnewsletter.co.il/api/restApiSms/sendSmsToRecipients';
              const cloudRes = await fetch(cloudUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              });
              const cloudResult = await cloudRes.json();

              const icon = cloudResult.success ? '✅' : '❌';
              console.log(`📱 Method   │ ☁️ CLOUD API (itnewsletter)`);
              console.log(`${icon} Cloud Response │ ${JSON.stringify(cloudResult).slice(0, 120)}`);
              console.log(`📱 ═══════════════════════════════════════\n`);

              res.writeHead(cloudRes.status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ...cloudResult, method: 'cloud' }));
            } catch (cloudErr) {
              console.log(`❌ BOTH MODEM AND CLOUD FAILED │ ${cloudErr.message}`);
              console.log(`📱 ═══════════════════════════════════════\n`);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Both modem and cloud SMS failed', method: 'none' }));
            }

          } catch (parseErr) {
            console.error('❌ SMS Plugin parse error:', parseErr.message);
            return next(); // Let proxy handle malformed requests
          }
        });
      });
    }
  });

  const cfRedirectsPlugin = () => ({
    name: 'cloudflare-redirects',
    closeBundle() {
      const distPath = path.resolve(__dirname, './dist');
      if (fs.existsSync(distPath)) {
        fs.writeFileSync(path.join(distPath, '_redirects'), '/* /index.html 200\n');
        console.log('✅ Generated _redirects in dist for Cloudflare SPA routing.');
      }
    }
  });

  return {
    base: '/',
    build: {
      outDir: "dist",
      chunkSizeWarningLimit: isLite ? 500 : 2000,
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        plugins: [],
      },
    },
    plugins: [react(), tagger(), cfRedirectsPlugin()].filter(Boolean),
    resolve: {
      alias: aliases,
      dedupe: ['react', 'react-dom'],
    },
    server: {
      port: 4028,
      host: "0.0.0.0",
      strictPort: false,
      allowedHosts: 'all',
      // Force no-cache so tablets always get fresh code after restart
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
      hmr: {
        // Match HMR port with server port dynamically based on mode
        port: mode === 'loyalty' ? 4029 : 4028,
      },
      proxy: {
        "/item": { target: backendTarget, changeOrigin: true, secure: false },
        "/api/marketing": { target: backendTarget, changeOrigin: true, secure: false },
        "/api/maya": { target: backendTarget, changeOrigin: true, secure: false },
        // SMS proxy is now handled by smsModemPlugin above — this proxy is kept as a catch-all
        // for non-send SMS routes (like balance check)
        "/api/sms": {
          target: "https://sapi.itnewsletter.co.il",
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/sms/, "/api/restApiSms"),
        },
        "/api": { target: backendTarget, changeOrigin: true, secure: false },
        "/supabase-api": {
          target: "http://127.0.0.1:54321",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/supabase-api/, ""),
        },
        "/edge-node": {
          target: "http://100.112.253.49:8090",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/edge-node/, ""),
        },
        "/studio": {
          target: "http://localhost:5002",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/studio/, ""),
        },
        "/health": { target: backendTarget, changeOrigin: true, secure: false },
        "/music/volumes": { target: backendTarget, changeOrigin: true },
        "/music/library": { target: backendTarget, changeOrigin: true },
        "/music/scan": { target: backendTarget, changeOrigin: true },
        "/music/stream": { target: backendTarget, changeOrigin: true },
        "/music/folders": { target: backendTarget, changeOrigin: true },
        "/music/process": { target: backendTarget, changeOrigin: true },
        "/music/cover": { target: backendTarget, changeOrigin: true },
        "/music/sync": { target: backendTarget, changeOrigin: true },
        "/music/youtube": { target: backendTarget, changeOrigin: true },
        "/ollama": {
          target: process.env.DOCKER_ENV === 'true' ? "http://host.docker.internal:11434/api" : "http://localhost:11434/api",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/ollama/, ""),
        },
      },
    }
  };
});
