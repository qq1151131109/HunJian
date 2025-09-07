import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs-extra'
import { promisify } from 'util'

// 设置 FFmpeg 路径（如果需要）
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH)
}
if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH)
}

export class FFmpegService {
  
  /**
   * 获取视频信息
   */
  async getVideoInfo(inputPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err)
        } else {
          resolve(metadata)
        }
      })
    })
  }

  /**
   * 获取视频时长（秒）
   */
  async getVideoDuration(inputPath: string): Promise<number> {
    const metadata = await this.getVideoInfo(inputPath)
    return metadata.format.duration || 0
  }

  /**
   * 获取音频文件时长（秒）
   */
  async getAudioDuration(inputPath: string): Promise<number> {
    const metadata = await this.getVideoInfo(inputPath)
    return metadata.format.duration || 0
  }

  /**
   * 获取视频文件的音频时长（秒）
   * 如果视频没有音频轨道，返回 0
   */
  async getVideoAudioDuration(inputPath: string): Promise<number> {
    try {
      const metadata = await this.getVideoInfo(inputPath)
      
      // 检查是否有音频流
      const audioStreams = metadata.streams?.filter((stream: any) => stream.codec_type === 'audio')
      
      if (!audioStreams || audioStreams.length === 0) {
        console.log(`视频 ${inputPath} 没有音频轨道`)
        return 0
      }

      // 获取第一个音频流的时长
      const audioDuration = audioStreams[0].duration || metadata.format.duration || 0
      console.log(`视频 ${inputPath} 音频时长: ${audioDuration}秒`)
      return audioDuration
      
    } catch (error) {
      console.error(`获取视频音频时长失败: ${inputPath}`, error)
      return 0
    }
  }

  /**
   * 按指定时长裁切视频，返回所有片段路径
   */
  async cutVideoByDuration(inputPath: string, segmentDuration: number, outputDir: string): Promise<string[]> {
    try {
      const totalDuration = await this.getVideoDuration(inputPath)
      const numSegments = Math.floor(totalDuration / segmentDuration)
      
      if (numSegments === 0) {
        console.log(`视频时长 ${totalDuration}s 小于目标时长 ${segmentDuration}s，跳过处理`)
        return []
      }

      const segments: string[] = []

      // 生成每个片段
      for (let i = 0; i < numSegments; i++) {
        const startTime = i * segmentDuration
        const outputPath = path.join(outputDir, `segment_${i}.mp4`)
        
        await this.cutVideoSegment(inputPath, startTime, segmentDuration, outputPath)
        segments.push(outputPath)
      }

      console.log(`视频裁切完成，生成 ${segments.length} 个片段`)
      return segments

    } catch (error) {
      console.error('视频裁切失败:', error)
      throw error
    }
  }

  /**
   * 裁切单个视频片段
   */
  private async cutVideoSegment(inputPath: string, startTime: number, duration: number, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(duration)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-movflags +faststart'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`片段生成完成: ${outputPath}`)
          resolve()
        })
        .on('error', (err) => {
          console.error(`片段生成失败: ${outputPath}`, err)
          reject(err)
        })
        .run()
    })
  }

  /**
   * 为视频添加音频轨道
   */
  async addAudioToVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          '-c:v copy', // 保持视频编码不变
          '-c:a aac',  // 音频编码为AAC
          '-map 0:v:0', // 使用第一个输入的视频流
          '-map 1:a:0', // 使用第二个输入的音频流
          '-shortest',  // 以最短的流为准
          '-movflags +faststart'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`音频添加完成: ${outputPath}`)
          resolve()
        })
        .on('error', (err) => {
          console.error(`音频添加失败: ${outputPath}`, err)
          reject(err)
        })
        .run()
    })
  }

  /**
   * 为视频添加字幕
   */
  async addSubtitleToVideo(videoPath: string, subtitlePath: string, outputPath: string, styleId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const subtitleExt = path.extname(subtitlePath).toLowerCase()
      
      let subtitleFilter: string
      
      if (subtitleExt === '.srt' || subtitleExt === '.vtt') {
        // SRT/VTT 字幕，硬编码到视频中
        let forceStyle = 'FontName=Arial,FontSize=20,PrimaryColour=&H00ffffff,OutlineColour=&H00000000,Outline=2'
        
        // 如果提供了样式ID，使用自定义样式
        if (styleId) {
          try {
            const { generateSubtitleForceStyle } = require('../../../shared/subtitleStyles')
            forceStyle = generateSubtitleForceStyle(styleId)
            console.log(`应用字幕样式 ${styleId}: ${forceStyle}`)
          } catch (error) {
            console.warn(`加载字幕样式失败，使用默认样式:`, error)
          }
        }
        
        subtitleFilter = `subtitles='${subtitlePath.replace(/'/g, "\\'")}':force_style='${forceStyle}'`
      } else if (subtitleExt === '.ass' || subtitleExt === '.ssa') {
        // ASS/SSA 字幕
        subtitleFilter = `ass='${subtitlePath.replace(/'/g, "\\'")}'`
      } else {
        reject(new Error(`不支持的字幕格式: ${subtitleExt}`))
        return
      }

      ffmpeg(videoPath)
        .videoFilters(subtitleFilter)
        .videoCodec('libx264')
        .audioCodec('copy') // 保持音频不变
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-movflags +faststart'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`字幕添加完成: ${outputPath}`)
          resolve()
        })
        .on('error', (err) => {
          console.error(`字幕添加失败: ${outputPath}`, err)
          // 如果字幕添加失败，尝试复制原视频
          fs.copy(videoPath, outputPath).then(() => {
            console.log('字幕添加失败，使用原视频')
            resolve()
          }).catch(reject)
        })
        .run()
    })
  }

  /**
   * 标准化视频格式，确保拼接兼容性 - TikTok竖屏格式
   */
  async normalizeVideo(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size('720x1280')   // TikTok竖屏格式 9:16
        .fps(30)            // 标准化为30fps
        .audioFrequency(44100) // 标准化音频采样率
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-pix_fmt yuv420p',
          '-aspect 9:16',     // 确保宽高比
          '-movflags +faststart',
          '-avoid_negative_ts make_zero'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`视频标准化完成(720x1280): ${outputPath}`)
          resolve()
        })
        .on('error', (err) => {
          console.error(`视频标准化失败: ${outputPath}`, err)
          reject(err)
        })
        .run()
    })
  }

  /**
   * 拼接多个视频 - 先标准化再拼接
   */
  async concatenateVideos(videoPaths: string[], outputPath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (videoPaths.length === 0) {
        reject(new Error('没有视频文件需要拼接'))
        return
      }

      if (videoPaths.length === 1) {
        // 只有一个视频，直接复制
        fs.copy(videoPaths[0], outputPath).then(resolve).catch(reject)
        return
      }

      try {
        console.log(`开始标准化 ${videoPaths.length} 个视频...`)
        
        const tempDir = path.dirname(outputPath)
        const normalizedPaths: string[] = []
        
        // 先标准化所有视频
        for (let i = 0; i < videoPaths.length; i++) {
          const normalizedPath = path.join(tempDir, `normalized_${i}_${Date.now()}.mp4`)
          await this.normalizeVideo(videoPaths[i], normalizedPath)
          normalizedPaths.push(normalizedPath)
        }

        console.log('视频标准化完成，开始拼接...')

        // 使用 concat demuxer 方法拼接标准化后的视频
        const listFile = path.join(tempDir, `concat_list_${Date.now()}.txt`)
        const fileList = normalizedPaths.map(videoPath => `file '${videoPath}'`).join('\n')
        await fs.writeFile(listFile, fileList)

        const command = ffmpeg()
          .input(listFile)
          .inputOptions(['-f concat', '-safe 0'])
          .outputOptions(['-c copy']) // 因为已经标准化，直接复制流
          .output(outputPath)
          .on('end', async () => {
            // 清理临时文件
            try {
              await fs.remove(listFile)
              for (const normalizedPath of normalizedPaths) {
                await fs.remove(normalizedPath)
              }
            } catch (e) {
              console.warn('清理临时文件失败:', e)
            }
            console.log(`视频拼接完成: ${outputPath}`)
            resolve()
          })
          .on('error', async (err) => {
            // 清理临时文件
            try {
              await fs.remove(listFile)
              for (const normalizedPath of normalizedPaths) {
                await fs.remove(normalizedPath)
              }
            } catch (e) {
              console.warn('清理临时文件失败:', e)
            }
            console.error(`视频拼接失败: ${outputPath}`, err)
            reject(err)
          })
          .run()

      } catch (error) {
        console.error('拼接视频时发生错误:', error)
        reject(error)
      }
    })
  }

  /**
   * 检查视频是否包含音频流
   */
  private async checkVideosForAudio(videoPaths: string[]): Promise<boolean[]> {
    const promises = videoPaths.map(async (videoPath) => {
      try {
        const metadata = await this.getVideoInfo(videoPath)
        const audioStreams = metadata.streams?.filter((stream: any) => stream.codec_type === 'audio')
        return audioStreams && audioStreams.length > 0
      } catch (error) {
        console.error(`检查视频音频流失败: ${videoPath}`, error)
        return false
      }
    })
    return Promise.all(promises)
  }

  /**
   * 调整视频分辨率和码率（可选功能）
   */
  async resizeVideo(inputPath: string, outputPath: string, width: number, height: number): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .size(`${width}x${height}`)
        .aspect('16:9')
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-movflags +faststart'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`视频调整完成: ${outputPath}`)
          resolve()
        })
        .on('error', (err) => {
          console.error(`视频调整失败: ${outputPath}`, err)
          reject(err)
        })
        .run()
    })
  }

  /**
   * 从视频中提取音频
   */
  async extractAudio(videoPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .output(outputPath)
        .on('end', () => {
          console.log(`音频提取完成: ${outputPath}`)
          resolve()
        })
        .on('error', (err) => {
          console.error(`音频提取失败: ${outputPath}`, err)
          reject(err)
        })
        .run()
    })
  }

  /**
   * 合并音频与视频
   */
  async mergeAudioWithVideo(videoPath: string, audioPath: string, outputPath: string, videoDuration?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          '-c:v copy',
          '-c:a aac',
          '-map 0:v:0',
          '-map 1:a:0',
          '-shortest'
        ])

      if (videoDuration) {
        command.duration(videoDuration)
      }

      command
        .output(outputPath)
        .on('end', () => {
          console.log(`音频视频合并完成: ${outputPath}`)
          resolve()
        })
        .on('error', (err) => {
          console.error(`音频视频合并失败: ${outputPath}`, err)
          reject(err)
        })
        .run()
    })
  }

  /**
   * 音频标准化处理
   */
  async normalizeAudio(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .audioFrequency(44100)
        .audioChannels(2)
        .audioFilters(['loudnorm'])
        .output(outputPath)
        .on('end', () => {
          console.log(`音频标准化完成: ${outputPath}`)
          resolve()
        })
        .on('error', (err) => {
          console.error(`音频标准化失败: ${outputPath}`, err)
          reject(err)
        })
        .run()
    })
  }

  /**
   * 按时长裁切视频
   */
  async cutVideo(inputPath: string, outputPath: string, duration: number): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .duration(duration)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-movflags +faststart'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`视频裁切完成: ${outputPath}`)
          resolve()
        })
        .on('error', (err) => {
          console.error(`视频裁切失败: ${outputPath}`, err)
          reject(err)
        })
        .run()
    })
  }

  /**
   * 为视频添加字幕（别名方法）
   */
  async addSubtitles(videoPath: string, subtitlePath: string, outputPath: string, subtitleStyle?: any): Promise<void> {
    const styleId = subtitleStyle?.styleId || subtitleStyle?.name || 'default'
    return this.addSubtitleToVideo(videoPath, subtitlePath, outputPath, styleId)
  }

  /**
   * 视频优化处理
   */
  async optimizeVideo(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset medium',
          '-crf 23',
          '-movflags +faststart',
          '-pix_fmt yuv420p'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`视频优化完成: ${outputPath}`)
          resolve()
        })
        .on('error', (err) => {
          console.error(`视频优化失败: ${outputPath}`, err)
          reject(err)
        })
        .run()
    })
  }
}