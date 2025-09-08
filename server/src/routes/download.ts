import express from 'express'
import fs from 'fs-extra'
import path from 'path'
import archiver from 'archiver'

const router = express.Router()

// 获取下载信息
router.get('/info/:processId', async (req, res) => {
  try {
    const { processId } = req.params
    const outputDir = path.join(process.env.OUTPUT_DIR || './output', processId)

    if (!await fs.pathExists(outputDir)) {
      return res.status(404).json({
        error: '处理结果不存在'
      })
    }

    const zipPath = path.join(outputDir, `${processId}_processed.zip`)
    
    if (!await fs.pathExists(zipPath)) {
      // 如果压缩包不存在，创建它
      await createZipArchive(processId)
    }

    const stats = await fs.stat(zipPath)

    res.json({
      id: processId,
      filename: `${processId}_processed.zip`,
      size: stats.size,
      url: `/api/download/${processId}`
    })

  } catch (error) {
    console.error('获取下载信息错误:', error)
    res.status(500).json({
      error: '获取下载信息失败',
      message: (error as Error).message
    })
  }
})

// 下载处理结果
router.get('/:processId', async (req, res) => {
  try {
    const { processId } = req.params
    const outputDir = path.join(process.env.OUTPUT_DIR || './output', processId)
    const zipPath = path.join(outputDir, `${processId}_processed.zip`)

    if (!await fs.pathExists(zipPath)) {
      // 如果压缩包不存在，创建它
      await createZipArchive(processId)
    }

    const stats = await fs.stat(zipPath)

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${processId}_processed.zip"`)
    res.setHeader('Content-Length', stats.size)

    const stream = fs.createReadStream(zipPath)
    stream.pipe(res)

  } catch (error) {
    console.error('下载文件错误:', error)
    res.status(500).json({
      error: '下载失败',
      message: (error as Error).message
    })
  }
})

// 创建压缩包
async function createZipArchive(processId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const outputDir = path.join(process.env.OUTPUT_DIR || './output', processId)
    const zipPath = path.join(outputDir, `${processId}_processed.zip`)

    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最高压缩级别
    })

    output.on('close', () => {
      console.log(`压缩包创建完成: ${archive.pointer()} bytes`)
      resolve()
    })

    archive.on('error', (err) => {
      reject(err)
    })

    archive.pipe(output)

    // 添加所有处理后的文件
    const videosDir = path.join(outputDir, 'videos')
    if (fs.existsSync(videosDir)) {
      archive.directory(videosDir, 'videos')
    }

    archive.finalize()
  })
}

export default router