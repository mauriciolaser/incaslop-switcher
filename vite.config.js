import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const staticImageDirs = [
  {
    route: '/images/candidates',
    sourceDir: path.resolve(process.cwd(), 'src/assets/images/candidates'),
    publicDir: 'images/candidates',
  },
  {
    route: '/images/partidos',
    sourceDir: path.resolve(process.cwd(), 'src/assets/images/partidos'),
    publicDir: 'images/partidos',
  },
  {
    route: '/images/transparent',
    sourceDir: path.resolve(process.cwd(), 'src/assets/images/transparent'),
    publicDir: 'images/transparent',
  },
  {
    route: '/sprites/parties',
    sourceDir: path.resolve(process.cwd(), 'src/assets/sprites/parties'),
    publicDir: 'sprites/parties',
  },
]

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

function staticImagesPlugin() {
  let outDir = path.resolve(process.cwd(), 'dist')

  return {
    name: 'static-images-public',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      for (const { route, sourceDir } of staticImageDirs) {
        server.middlewares.use(route, async (req, res, next) => {
          const requestPath = req.url?.split('?')[0] ?? ''
          const relativePath = decodeURIComponent(requestPath).replace(/^\/+/, '')

          if (!relativePath) {
            next()
            return
          }

          const filePath = path.resolve(sourceDir, relativePath)
          if (!filePath.startsWith(sourceDir)) {
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
      }
    },
    async writeBundle() {
      for (const { sourceDir, publicDir } of staticImageDirs) {
        const targetDir = path.join(outDir, publicDir)
        await fsp.mkdir(path.dirname(targetDir), { recursive: true })
        await fsp.cp(sourceDir, targetDir, { recursive: true, force: true })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), staticImagesPlugin()],
  assetsInclude: ['**/*.glb'],
})
