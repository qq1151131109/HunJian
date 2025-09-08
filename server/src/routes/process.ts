import express from 'express'
import { uploadFiles } from '../middleware/upload'
import { VideoProcessor } from '../services/videoProcessor'
import fs from 'fs-extra'
import path from 'path'
import archiver from 'archiver'
import { spawn } from 'child_process'
const router = express.Router()

// 存储处理任务的映射
const processingTasks = new Map<string, VideoProcessor>()

// 开始处理视频
router.post('/start', uploadFiles, async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    const { config } = req.body

    if (!files || !files.videos || files.videos.length === 0) {
      return res.status(400).json({
        error: '没有上传视频文件'
      })
    }

    const processId = req.processId!
    const io = req.app.get('io')

    // 创建视频处理器实例
    const processor = new VideoProcessor(processId, io)
    processingTasks.set(processId, processor)

    // 解析配置
    const processConfig = JSON.parse(config || '{}')

    // 准备处理参数
    console.log('接收到的processConfig:', processConfig)
    console.log('customSubtitleSettings:', processConfig.customSubtitleSettings)
    
    const processingOptions = {
      videos: files.videos,
      audioFile: files.audioFile?.[0],
      trailerVideo: files.trailerVideo?.[0],
      config: {
        audioDuration: processConfig.audioDuration || 30,
        subtitlePath: processConfig.subtitlePath || process.env.SUBTITLE_PATH || '',
        subtitleStyle: processConfig.subtitleStyle || 'tiktok-classic',
        customSubtitleSettings: processConfig.customSubtitleSettings
      }
    }
    
    console.log('最终处理选项:', JSON.stringify(processingOptions.config, null, 2))

    // 异步开始处理
    processor.startProcessing(processingOptions).catch(error => {
      console.error(`处理任务 ${processId} 失败:`, error)
    })

    res.json({
      success: true,
      processId,
      message: '开始处理视频',
      totalFiles: files.videos.length
    })

  } catch (error) {
    console.error('启动处理失败:', error)
    res.status(500).json({
      error: '启动处理失败',
      message: (error as Error).message
    })
  }
})

// 获取处理状态
router.get('/status/:processId', async (req, res) => {
  try {
    const { processId } = req.params
    const processor = processingTasks.get(processId)

    if (!processor) {
      // 尝试从文件系统读取状态
      const statusPath = path.join(process.env.OUTPUT_DIR || './output', processId, 'status.json')
      if (await fs.pathExists(statusPath)) {
        const status = await fs.readJSON(statusPath)
        return res.json(status)
      }

      return res.status(404).json({
        error: '处理任务不存在'
      })
    }

    const status = processor.getStatus()
    res.json(status)

  } catch (error) {
    console.error('获取处理状态错误:', error)
    res.status(500).json({
      error: '获取状态失败',
      message: (error as Error).message
    })
  }
})

// 停止处理
router.post('/stop/:processId', async (req, res) => {
  try {
    const { processId } = req.params
    const processor = processingTasks.get(processId)

    if (!processor) {
      return res.status(404).json({
        error: '处理任务不存在'
      })
    }

    // 暂时使用stop方法
    processor.stop()
    processingTasks.delete(processId)

    res.json({
      success: true,
      message: '处理已停止'
    })

  } catch (error) {
    console.error('停止处理错误:', error)
    res.status(500).json({
      error: '停止处理失败',
      message: (error as Error).message
    })
  }
})


// 打开输出文件夹
router.post('/open-folder/:processId', async (req, res) => {
  try {
    const { processId } = req.params
    const outputDir = path.join(process.env.OUTPUT_DIR || './output', processId)

    if (!await fs.pathExists(outputDir)) {
      return res.status(404).json({
        error: '输出目录不存在'
      })
    }

    // 根据操作系统打开文件夹
    const platform = process.platform
    let command: string
    let args: string[]

    if (platform === 'darwin') {
      command = 'open'
      args = [outputDir]
    } else if (platform === 'win32') {
      command = 'explorer'
      args = [outputDir]
    } else {
      command = 'xdg-open'
      args = [outputDir]
    }

    // 使用spawn替代exec以避免命令注入
    const childProcess = spawn(command, args, { detached: true, stdio: 'ignore' })
    childProcess.unref() // 让子进程在后台运行

    res.json({
      success: true,
      message: '文件夹已打开'
    })

  } catch (error) {
    console.error('打开文件夹错误:', error)
    res.status(500).json({
      error: '打开文件夹失败',
      message: (error as Error).message
    })
  }
})

// 获取所有任务列表
router.get('/list', async (req, res) => {
  try {
    const outputDir = process.env.OUTPUT_DIR || './output'
    
    if (!await fs.pathExists(outputDir)) {
      return res.json([])
    }

    const taskDirs = await fs.readdir(outputDir)
    const tasks = []

    for (const taskId of taskDirs) {
      const statusPath = path.join(outputDir, taskId, 'status.json')
      
      if (await fs.pathExists(statusPath)) {
        try {
          const status = await fs.readJSON(statusPath)
          const stats = await fs.stat(statusPath)
          
          tasks.push({
            ...status,
            createdAt: stats.birthtime,
            updatedAt: stats.mtime
          })
        } catch (error) {
          console.error(`读取任务状态失败 ${taskId}:`, error)
        }
      }
    }

    // 按更新时间降序排列
    tasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    res.json(tasks)

  } catch (error) {
    console.error('获取任务列表错误:', error)
    res.status(500).json({
      error: '获取任务列表失败',
      message: (error as Error).message
    })
  }
})

// 删除任务和相关文件
router.delete('/delete/:processId', async (req, res) => {
  try {
    const { processId } = req.params
    
    // 检查任务是否存在
    const processor = processingTasks.get(processId)
    
    // 如果任务正在运行，先停止它
    if (processor) {
      processor.stop()
      processingTasks.delete(processId)
    }
    
    // 删除输出目录和所有相关文件
    const outputDir = path.join(process.env.OUTPUT_DIR || './output', processId)
    if (await fs.pathExists(outputDir)) {
      await fs.remove(outputDir)
    }
    
    // 清理上传目录中可能的临时文件（基于processId查找）
    const uploadDir = process.env.UPLOAD_DIR || './uploads'
    if (await fs.pathExists(uploadDir)) {
      const files = await fs.readdir(uploadDir)
      const processFiles = files.filter(file => file.includes(processId))
      for (const file of processFiles) {
        const filePath = path.join(uploadDir, file)
        try {
          await fs.remove(filePath)
        } catch (error) {
          console.error(`删除上传文件 ${filePath} 失败:`, error)
        }
      }
    }

    res.json({
      success: true,
      message: '任务及相关文件已删除'
    })

  } catch (error) {
    console.error('删除任务错误:', error)
    res.status(500).json({
      error: '删除任务失败',
      message: (error as Error).message
    })
  }
})

export default router