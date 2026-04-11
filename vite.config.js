import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const candidateImagesSourceDir = path.resolve(process.cwd(), 'src/assets/images/candidates')
const candidateImagesPublicDir = 'images/candidates'

function getImageContentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.avif':
      return 'image/avif'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.svg':
      return 'image/svg+xml'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

function candidateImagesPlugin() {
  let outDir = path.resolve(process.cwd(), 'dist')

  return {
    name: 'candidate-images-static',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use('/images/candidates', async (req, res, next) => {
        const requestPath = req.url?.split('?')[0] ?? ''
        const relativePath = decodeURIComponent(requestPath).replace(/^\/+/, '')

        if (!relativePath) {
          next()
          return
        }

        const filePath = path.resolve(candidateImagesSourceDir, relativePath)
        if (!filePath.startsWith(candidateImagesSourceDir)) {
          next()
          return
        }

        try {
          const stats = await fsp.stat(filePath)
          if (!stats.isFile()) {
            next()
            return
          }

          res.setHeader('Content-Type', getImageContentType(filePath))
          fs.createReadStream(filePath).pipe(res)
        } catch {
          next()
        }
      })
    },
    async writeBundle() {
      const targetDir = path.join(outDir, candidateImagesPublicDir)
      await fsp.mkdir(path.dirname(targetDir), { recursive: true })
      await fsp.cp(candidateImagesSourceDir, targetDir, { recursive: true, force: true })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), candidateImagesPlugin()],
  assetsInclude: ['**/*.glb'],
})
