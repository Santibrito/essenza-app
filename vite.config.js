import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Remove comments and whitespace in production
          comments: false,
          whitespace: 'condense'
        }
      }
    }),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  server: {
    port: 5173,
  },
  build: {
    // Conservative minification - safe for Vue components
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 2,
        // CRITICAL: Disable unsafe optimizations that break Vue
        unsafe: false,
        unsafe_comps: false,
        unsafe_methods: false,
        unsafe_math: false
      },
      mangle: {
        safari10: true,
        // CRITICAL: Don't mangle property names (breaks Vue __scopeId)
        properties: false
      },
      format: {
        comments: false
      }
    },
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separate vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
              return 'vue-vendor'
            }
            if (id.includes('radix-vue') || id.includes('reka-ui') || id.includes('lucide-vue-next')) {
              return 'ui-vendor'
            }
            if (id.includes('@vueuse') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'utils-vendor'
            }
            // All other node_modules
            return 'vendor'
          }
          // Split large components
          if (id.includes('/components/dashboard/')) {
            return 'dashboard'
          }
          if (id.includes('/components/customs/')) {
            return 'customs'
          }
          if (id.includes('/components/ui/')) {
            return 'ui'
          }
        },
        // Smaller chunk names
        chunkFileNames: 'js/[hash:8].js',
        entryFileNames: 'js/[hash:8].js',
        assetFileNames: (assetInfo) => {
          // Handle cases where name might be undefined
          if (!assetInfo.name) {
            return 'assets/[hash:8][extname]'
          }
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/\.(css)$/.test(assetInfo.name)) {
            return `css/[hash:8].${ext}`
          }
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico|webp)$/i.test(assetInfo.name)) {
            return `img/[hash:8].${ext}`
          }
          return `assets/[hash:8].${ext}`
        }
      }
    },
    // Reduce bundle size
    chunkSizeWarningLimit: 500,
    // Enable source maps only in dev
    sourcemap: false,
    // Optimize CSS
    cssCodeSplit: true,
    cssMinify: 'lightningcss',
    // Reduce asset inline threshold
    assetsInlineLimit: 4096, // Increased from 2048 to inline more small assets
    // Target modern browsers for smaller output
    target: 'es2020',
    // Optimize module preload
    modulePreload: {
      polyfill: false
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia', 'vue-sonner'],
    exclude: []
  },
  // Enable esbuild optimizations
  esbuild: {
    drop: ['console', 'debugger'],
    legalComments: 'none',
    treeShaking: true
  }
})
