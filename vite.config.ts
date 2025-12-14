
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './', // 关键：使用相对路径，适配 GitHub Pages 子目录
      plugins: [react()],
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve('./src'),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
      }
    };
});
