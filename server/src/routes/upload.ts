import express from 'express'
import { uploadFiles } from '../middleware/upload'
import fs from 'fs-extra'
import path from 'path'

const router = express.Router()

// 文件上传接口
router.post('/', uploadFiles, async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    const { config } = req.body

    if (!files || !files.videos || files.videos.length === 0) {
      return res.status(400).json({
        error: '没有上传视频文件'
      })
    }

    const processId = req.processId
    const uploadPath = path.join(process.env.UPLOAD_DIR || './uploads', processId!)

    // 保存配置信息
    const configData = {
      processId,
      config: JSON.parse(config || '{}'),
      files: {
        videos: files.videos.map(file => ({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype
        })),
        audioFile: files.audioFile ? {
          filename: files.audioFile[0].filename,
          originalName: files.audioFile[0].originalname,
          path: files.audioFile[0].path,
          size: files.audioFile[0].size,
          mimetype: files.audioFile[0].mimetype
        } : null,
        trailerVideo: files.trailerVideo ? {
          filename: files.trailerVideo[0].filename,
          originalName: files.trailerVideo[0].originalname,
          path: files.trailerVideo[0].path,
          size: files.trailerVideo[0].size,
          mimetype: files.trailerVideo[0].mimetype
        } : null
      },
      createdAt: new Date().toISOString()
    }

    // 保存配置文件
    await fs.writeJSON(path.join(uploadPath, 'config.json'), configData, { spaces: 2 })

    res.json({
      success: true,
      processId,
      message: '文件上传成功',
      data: {
        totalVideos: files.videos.length,
        hasAudio: !!files.audioFile,
        hasTrailer: !!files.trailerVideo,
        uploadPath
      }
    })

  } catch (error) {
    console.error('文件上传错误:', error)
    res.status(500).json({
      error: '文件上传失败',
      message: (error as Error).message
    })
  }
})

// 获取上传状态
router.get('/status/:processId', async (req, res) => {
  try {
    const { processId } = req.params
    const configPath = path.join(process.env.UPLOAD_DIR || './uploads', processId, 'config.json')

    if (!await fs.pathExists(configPath)) {
      return res.status(404).json({
        error: '上传任务不存在'
      })
    }

    const config = await fs.readJSON(configPath)
    res.json(config)

  } catch (error) {
    console.error('获取上传状态错误:', error)
    res.status(500).json({
      error: '获取状态失败',
      message: (error as Error).message
    })
  }
})

export default router