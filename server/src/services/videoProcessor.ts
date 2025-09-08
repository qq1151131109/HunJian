import { Server } from 'socket.io'
import path from 'path'
import fs from 'fs-extra'
import { FFmpegService } from '../utils/ffmpeg'
import { WhisperService } from '../utils/whisper'
import type { ProcessStatus, ProcessResult } from '../../../shared/types'

interface ProcessingOptions {
  videos: Express.Multer.File[]
  audioFile?: Express.Multer.File
  trailerVideo?: Express.Multer.File
  config: {
    audioDuration: number
    subtitlePath: string
    subtitleStyle: string
    customSubtitleSettings?: {
      styleId: string
      fontSize: number
      position: 'top' | 'top-center' | 'center-up' | 'center' | 'center-down' | 'bottom-center' | 'bottom'
      marginVertical: number
      marginHorizontal: number
      color: string
      outline: boolean
      outlineWidth: number
    }
  }
}

export class VideoProcessor {
  private processId: string
  private io: Server
  private status: ProcessStatus
  private ffmpeg: FFmpegService
  private whisper: WhisperService
  private isProcessing = false
  private shouldStop = false
  private sharedSubtitlePath: string | null = null

  constructor(processId: string, io: Server) {
    this.processId = processId
    this.io = io
    this.ffmpeg = new FFmpegService()
    this.whisper = new WhisperService()
    
    this.status = {
      id: processId,
      status: 'pending',
      progress: 0,
      totalFiles: 0,
      processedFiles: 0
    }
  }

  async startProcessing(options: ProcessingOptions): Promise<void> {
    try {
      console.log(`开始处理任务 ${this.processId}，视频文件数量: ${options.videos.length}`)
      console.log('处理器收到的配置:', JSON.stringify(options.config, null, 2))
      
      if (this.isProcessing) {
        throw new Error('任务正在处理中')
      }

      this.isProcessing = true
      this.shouldStop = false
      
      // 更新初始状态
      this.status = {
        ...this.status,
        status: 'processing',
        totalFiles: options.videos.length,
        processedFiles: 0,
        progress: 0
      }

      console.log('更新处理状态并保存:', this.status)
      await this.saveStatus()
      this.emitStatusUpdate()

      const outputDir = path.join(process.env.OUTPUT_DIR || './output', this.processId)
      await fs.ensureDir(outputDir)

      // 如果有音频文件，提前生成一次字幕供所有视频复用
      if (options.audioFile) {
        this.status.currentStep = '生成共享字幕文件 (Whisper)'
        this.status.progress = 5
        this.emitStatusUpdate()
        
        try {
          console.log('开始为音频文件生成共享字幕...')
          const sharedSubtitleDir = path.join(outputDir, 'shared_subtitle')
          await fs.ensureDir(sharedSubtitleDir)
          
          this.sharedSubtitlePath = await this.whisper.generateSubtitleFromAudio(options.audioFile.path, sharedSubtitleDir)
          console.log(`共享字幕生成成功: ${this.sharedSubtitlePath}`)
        } catch (error) {
          console.error('共享字幕生成失败:', error)
          console.log('将为每个片段单独生成字幕')
          this.sharedSubtitlePath = null
        }
      }

      const results: ProcessResult[] = []

      // 处理每个视频文件
      console.log(`开始处理 ${options.videos.length} 个视频文件`)
      for (let i = 0; i < options.videos.length; i++) {
        if (this.shouldStop) {
          console.log('处理被取消')
          break
        }

        const videoFile = options.videos[i]
        console.log(`处理第 ${i + 1} 个文件: ${videoFile.originalname}`)
        const result = await this.processVideo(videoFile, options, outputDir, i)
        results.push(result)

        this.status.processedFiles++
        this.status.progress = (this.status.processedFiles / this.status.totalFiles) * 100

        console.log(`文件处理完成，进度: ${this.status.progress}%`)
        await this.saveStatus()
        this.emitStatusUpdate()
        this.emitFileProcessed(result)
      }

      // 完成处理
      if (!this.shouldStop) {
        this.status.status = 'completed'
        this.status.progress = 100
      } else {
        this.status.status = 'error'
        this.status.error = '处理被用户取消'
      }

      // 清理共享字幕文件
      if (this.sharedSubtitlePath) {
        try {
          const sharedSubtitleDir = path.dirname(this.sharedSubtitlePath)
          await fs.remove(sharedSubtitleDir)
          console.log('清理共享字幕目录完成')
        } catch (error) {
          console.warn('清理共享字幕目录失败:', error)
        }
        this.sharedSubtitlePath = null
      }

      await this.saveStatus()
      this.emitProcessComplete()

    } catch (error) {
      console.error(`处理任务 ${this.processId} 失败:`, error)
      this.status.status = 'error'
      this.status.error = (error as Error).message
      await this.saveStatus()
      this.emitProcessComplete()
    } finally {
      this.isProcessing = false
    }
  }

  private async processVideo(
    videoFile: Express.Multer.File,
    options: ProcessingOptions,
    outputDir: string,
    index: number
  ): Promise<ProcessResult> {
    try {
      this.status.currentFile = videoFile.originalname
      // 计算基础进度（每个文件开始时）
      const baseProgress = (index / this.status.totalFiles) * 100
      this.status.progress = baseProgress
      this.status.currentStep = '准备处理视频文件'
      this.emitStatusUpdate()

      const inputPath = videoFile.path
      const relativePath = this.getVideoRelativePath(videoFile)
      const outputSubDir = path.join(outputDir, 'videos', path.dirname(relativePath))
      
      await fs.ensureDir(outputSubDir)
      
      const baseName = path.basename(relativePath, path.extname(relativePath))
      const tempDir = path.join(outputDir, 'temp', `video_${index}`)
      await fs.ensureDir(tempDir)

      // 步骤1: 计算实际裁切时长
      this.status.currentStep = '分析音频时长'
      this.status.progress = baseProgress + (1 / this.status.totalFiles) * 10
      this.emitStatusUpdate()
      
      let actualCutDuration: number

      if (options.audioFile) {
        // 有音频文件，使用音频时长
        const mainAudioDuration = await this.ffmpeg.getAudioDuration(options.audioFile.path)
        console.log(`主音频时长: ${mainAudioDuration}秒`)

        let trailerAudioDuration = 0
        if (options.trailerVideo) {
          // 获取引流视频的音频时长
          trailerAudioDuration = await this.ffmpeg.getVideoAudioDuration(options.trailerVideo.path)
          console.log(`引流视频音频时长: ${trailerAudioDuration}秒`)
        }

        // 正确的裁切时长计算逻辑
        if (options.trailerVideo && trailerAudioDuration > 0) {
          // 引流视频有音频：裁切时长 = 音频时长（引流视频音频会和背景音频混合）
          actualCutDuration = mainAudioDuration
          console.log(`引流视频有音频，裁切时长 = 音频时长: ${actualCutDuration}秒`)
        } else if (options.trailerVideo) {
          // 引流视频无音频：裁切时长 = 音频时长 - 引流视频时长
          const trailerVideoDuration = await this.ffmpeg.getVideoDuration(options.trailerVideo.path)
          actualCutDuration = mainAudioDuration - trailerVideoDuration
          console.log(`引流视频无音频，裁切时长 = ${mainAudioDuration} - ${trailerVideoDuration} = ${actualCutDuration}秒`)
          
          if (actualCutDuration <= 0) {
            throw new Error(`引流视频时长(${trailerVideoDuration}秒) 大于等于主音频时长(${mainAudioDuration}秒)，无法处理`)
          }
        } else {
          // 没有引流视频：直接使用音频时长
          actualCutDuration = mainAudioDuration
          console.log(`无引流视频，裁切时长 = 音频时长: ${actualCutDuration}秒`)
        }

        console.log(`计算出的裁切时长: ${actualCutDuration}秒`)
      } else {
        // 没有音频文件，使用预设时长作为后备
        actualCutDuration = options.config.audioDuration
        console.log(`使用预设裁切时长: ${actualCutDuration}秒`)
      }

      // 步骤2: 按计算出的时长裁切视频
      this.status.currentStep = '裁切视频片段'
      this.status.progress = baseProgress + (1 / this.status.totalFiles) * 20
      this.emitStatusUpdate()
      
      const segments = await this.ffmpeg.cutVideoByDuration(
        inputPath,
        actualCutDuration,
        tempDir
      )

      const processedSegments: string[] = []

      // 处理每个片段
      for (let segIndex = 0; segIndex < segments.length; segIndex++) {
        const segment = segments[segIndex]
        let currentSegment = segment
        const segmentBaseProgress = baseProgress + (1 / this.status.totalFiles) * 30 + ((segIndex / segments.length) * (1 / this.status.totalFiles) * 60)

        // 步骤3: 添加音频（如果有）
        if (options.audioFile) {
          this.status.currentStep = `为片段 ${segIndex + 1}/${segments.length} 添加音频`
          this.status.progress = segmentBaseProgress
          this.emitStatusUpdate()
          
          const withAudioPath = path.join(tempDir, `segment_${segIndex}_with_audio.mp4`)
          await this.ffmpeg.addAudioToVideo(currentSegment, options.audioFile.path, withAudioPath)
          currentSegment = withAudioPath
        }

        // 步骤4: 添加字幕
        if (this.sharedSubtitlePath) {
          // 使用共享字幕
          this.status.currentStep = `为片段 ${segIndex + 1}/${segments.length} 添加共享字幕`
          this.status.progress = segmentBaseProgress + ((1 / segments.length) * (1 / this.status.totalFiles) * 30)
          this.emitStatusUpdate()
          
          try {
            console.log(`使用共享字幕为片段 ${segIndex} 添加字幕...`)
            const withSubtitlePath = path.join(tempDir, `segment_${segIndex}_with_subtitle.mp4`)
            // 使用自定义设置或默认样式ID
            console.log('字幕处理 - customSubtitleSettings:', options.config.customSubtitleSettings)
            console.log('字幕处理 - subtitleStyle:', options.config.subtitleStyle)
            const subtitleStyle = options.config.customSubtitleSettings ? 'custom' : options.config.subtitleStyle
            console.log('最终使用的subtitleStyle:', subtitleStyle)
            await this.ffmpeg.addSubtitleToVideo(currentSegment, this.sharedSubtitlePath, withSubtitlePath, subtitleStyle, options.config.customSubtitleSettings)
            currentSegment = withSubtitlePath
            console.log(`共享字幕添加成功: ${withSubtitlePath}`)
          } catch (error) {
            console.error(`共享字幕添加失败 (片段 ${segIndex}):`, error)
            console.log(`跳过字幕处理，继续处理片段 ${segIndex}`)
          }
        } else if (options.audioFile) {
          // 如果没有共享字幕但有音频文件，为该片段单独生成字幕
          this.status.currentStep = `为片段 ${segIndex + 1}/${segments.length} 生成字幕(Whisper)`
          this.status.progress = segmentBaseProgress + ((1 / segments.length) * (1 / this.status.totalFiles) * 30)
          this.emitStatusUpdate()
          
          try {
            console.log(`使用Whisper为片段 ${segIndex} 生成字幕...`)
            const subtitlePath = await this.whisper.generateSubtitleFromVideo(currentSegment, tempDir)
            console.log(`Whisper字幕生成成功: ${subtitlePath}`)
            
            const withSubtitlePath = path.join(tempDir, `segment_${segIndex}_with_subtitle.mp4`)
            // 使用自定义设置或默认样式ID
            console.log('Whisper字幕处理 - customSubtitleSettings:', options.config.customSubtitleSettings)
            console.log('Whisper字幕处理 - subtitleStyle:', options.config.subtitleStyle)
            const subtitleStyle = options.config.customSubtitleSettings ? 'custom' : options.config.subtitleStyle
            console.log('Whisper最终使用的subtitleStyle:', subtitleStyle)
            await this.ffmpeg.addSubtitleToVideo(currentSegment, subtitlePath, withSubtitlePath, subtitleStyle, options.config.customSubtitleSettings)
            currentSegment = withSubtitlePath
            
            // 清理生成的字幕文件
            await fs.remove(subtitlePath)
            
          } catch (error) {
            console.error(`Whisper字幕生成失败 (片段 ${segIndex}):`, error)
            console.log(`跳过字幕处理，继续处理片段 ${segIndex}`)
          }
        }

        // 步骤5: 添加引流视频（如果有）
        this.status.currentStep = `为片段 ${segIndex + 1}/${segments.length} 添加引流视频`
        this.status.progress = segmentBaseProgress + ((1 / segments.length) * (1 / this.status.totalFiles) * 50)
        this.emitStatusUpdate()
        
        let finalPath: string
        try {
          if (options.trailerVideo) {
            finalPath = path.join(outputSubDir, `${baseName}_segment_${segIndex}_final.mp4`)
            await this.ffmpeg.concatenateVideos([currentSegment, options.trailerVideo.path], finalPath)
          } else {
            finalPath = path.join(outputSubDir, `${baseName}_segment_${segIndex}_final.mp4`)
            await fs.copy(currentSegment, finalPath)
          }
          processedSegments.push(finalPath)
          console.log(`片段 ${segIndex} 处理完成: ${finalPath}`)
        } catch (error) {
          console.error(`片段 ${segIndex} 拼接失败:`, error)
          // 拼接失败时，使用没有引流视频的版本
          finalPath = path.join(outputSubDir, `${baseName}_segment_${segIndex}_no_trailer.mp4`)
          await fs.copy(currentSegment, finalPath)
          processedSegments.push(finalPath)
          console.log(`片段 ${segIndex} 使用无引流版本: ${finalPath}`)
        }
      }

      // 清理临时文件
      this.status.currentStep = `清理临时文件并完成处理`
      this.status.progress = baseProgress + (1 / this.status.totalFiles) * 100
      this.emitStatusUpdate()
      
      await fs.remove(tempDir)

      return {
        id: `${this.processId}_${index}`,
        processId: this.processId,
        originalFile: videoFile.originalname,
        outputFile: `处理完成，生成 ${processedSegments.length} 个片段`,
        status: 'success'
      }

    } catch (error) {
      console.error(`处理视频 ${videoFile.originalname} 失败:`, error)
      return {
        id: `${this.processId}_${index}`,
        processId: this.processId,
        originalFile: videoFile.originalname,
        outputFile: '',
        status: 'error',
        error: (error as Error).message
      }
    }
  }

  private getVideoRelativePath(videoFile: Express.Multer.File): string {
    // 从文件路径中提取相对路径
    const pathParts = videoFile.path.split('/')
    const videosIndex = pathParts.findIndex(part => part === 'videos')
    
    if (videosIndex !== -1 && videosIndex < pathParts.length - 1) {
      return pathParts.slice(videosIndex + 1).join('/')
    }
    
    return videoFile.originalname
  }

  private async findSubtitleFiles(subtitlePath: string): Promise<string[]> {
    try {
      if (!await fs.pathExists(subtitlePath)) {
        return []
      }

      const files = await fs.readdir(subtitlePath)
      return files
        .filter(file => /\.(srt|ass|ssa|vtt)$/i.test(file))
        .map(file => path.join(subtitlePath, file))
    } catch (error) {
      console.error('查找字幕文件失败:', error)
      return []
    }
  }

  private async saveStatus(): Promise<void> {
    try {
      const statusPath = path.join(process.env.OUTPUT_DIR || './output', this.processId, 'status.json')
      await fs.ensureDir(path.dirname(statusPath))
      await fs.writeJSON(statusPath, this.status, { spaces: 2 })
    } catch (error) {
      console.error('保存状态失败:', error)
    }
  }

  private emitStatusUpdate(): void {
    // 发送到特定房间（为具体任务连接的客户端）
    this.io.to(`process-${this.processId}`).emit('progress-update', this.status)
    // 发送全局消息（为任务管理器）
    this.io.emit('task-status-update', this.status)
  }

  private emitFileProcessed(result: ProcessResult): void {
    this.io.to(`process-${this.processId}`).emit('file-processed', result)
  }

  private emitProcessComplete(): void {
    this.io.to(`process-${this.processId}`).emit('process-complete', this.status)
  }

  async stopProcessing(): Promise<void> {
    this.shouldStop = true
  }

  async stop(): Promise<void> {
    this.shouldStop = true
  }

  getStatus(): ProcessStatus {
    return this.status
  }
}