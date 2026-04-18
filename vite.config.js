import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const rootDir = import.meta.dirname

function getConfig (mode) {
  if (mode === 'module') {
    return {
      build: {
        emptyOutDir: true,
        lib: {
          entry: resolve(rootDir, 'builds/module.js'),
          formats: ['es', 'cjs'],
          fileName: format => format === 'es' ? 'module.esm.js' : 'module.cjs.js'
        },
        minify: false,
        outDir: 'dist',
        reportCompressedSize: false
      }
    }
  }

  if (mode === 'cdn') {
    return {
      build: {
        emptyOutDir: false,
        lib: {
          entry: resolve(rootDir, 'builds/cdn.js'),
          fileName: () => 'cdn.min.js',
          formats: ['iife'],
          name: 'AlpinejsRouter'
        },
        outDir: 'dist',
        reportCompressedSize: false
      }
    }
  }

  if (mode === 'cdn-es2015') {
    return {
      build: {
        emptyOutDir: false,
        lib: {
          entry: resolve(rootDir, 'builds/cdn.js'),
          fileName: () => 'es6.min.js',
          formats: ['iife'],
          name: 'AlpinejsRouter'
        },
        outDir: 'dist',
        reportCompressedSize: false,
        target: 'es2015'
      }
    }
  }

  throw new Error(`Unknown build mode: ${mode}`)
}

export default defineConfig(({ mode }) => getConfig(mode))
