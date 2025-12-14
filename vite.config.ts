import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // 关键：使用相对路径，适配 GitHub Pages 等非根目录部署
      base: './', 
      plugins: [react()],
      server: {
        port: 3000,
        host: '0.0.0.0',
        fs: {
            allow: ['.'],
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        // 确保 m3-1 中的大文件不被意外内联或哈希化（如果它们在 public 中，Vite 会自动复制，这里是双重保险）
        assetsInlineLimit: 0, 
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve('.'),
        }
      }
    };
});