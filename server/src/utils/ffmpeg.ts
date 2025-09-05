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
  async addSubtitleToVideo(videoPath: string, subtitlePath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const subtitleExt = path.extname(subtitlePath).toLowerCase()
      
      let subtitleFilter: string
      
      if (subtitleExt === '.srt' || subtitleExt === '.vtt') {
        // SRT/VTT 字幕，硬编码到视频中
        subtitleFilter = `subtitles='${subtitlePath.replace(/'/g, "\\'")}':force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00ffffff,OutlineColour=&H00000000,Outline=2'`
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
   * 拼接多个视频
   */
  async concatenateVideos(videoPaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (videoPaths.length === 0) {
        reject(new Error('没有视频文件需要拼接'))
        return
      }

      if (videoPaths.length === 1) {
        // 只有一个视频，直接复制
        fs.copy(videoPaths[0], outputPath).then(resolve).catch(reject)
        return
      }

      const command = ffmpeg()

      // 添加所有输入文件
      videoPaths.forEach(videoPath => {
        command.input(videoPath)
      })

      // 构建复杂过滤器字符串
      let filterComplex = ''
      for (let i = 0; i < videoPaths.length; i++) {
        filterComplex += `[${i}:v][${i}:a]`
      }
      filterComplex += `concat=n=${videoPaths.length}:v=1:a=1[outv][outa]`

      command
        .complexFilter(filterComplex)
        .outputOptions(['-map [outv]', '-map [outa]'])
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-movflags +faststart'
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`视频拼接完成: ${outputPath}`)
          resolve()
        })
        .on('error', (err) => {
          console.error(`视频拼接失败: ${outputPath}`, err)
          reject(err)
        })
        .run()
    })
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
}