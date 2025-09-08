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
        // 对所有片段都添加0.2秒的偏移，避免黑帧问题
        const baseStartTime = i * segmentDuration
        const offset = 0.2 // 统一的小偏移，避免黑帧
        const startTime = baseStartTime + offset
        const actualDuration = segmentDuration - offset
        
        // 确保不会超出视频总时长
        if (startTime + actualDuration > totalDuration) {
          console.log(`跳过片段 ${i}：起始时间 ${startTime}s + 时长 ${actualDuration}s 超出总时长 ${totalDuration}s`)
          continue
        }
        
        const outputPath = path.join(outputDir, `segment_${i}.mp4`)
        
        await this.cutVideoSegment(inputPath, startTime, actualDuration, outputPath)
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
    console.log(`切割视频片段: 起始时间=${startTime}s, 时长=${duration}s`)
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .inputOptions([
          '-accurate_seek',  // 精确定位
          '-avoid_negative_ts', 'make_zero'  // 避免负时间戳
        ])
        .seekInput(startTime)
        .duration(duration)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-movflags +faststart',
          // 确保从关键帧开始编码，减少黑帧
          '-sc_threshold 0',
          // 强制关键帧间隔
          '-g 30',
          // 像素格式兼容性
          '-pix_fmt yuv420p'
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
   * 根据前端自定义设置生成ASS force_style参数
   */
  private generateCustomSubtitleStyle(settings: any): string {
    try {
      console.log('处理自定义字幕设置:', JSON.stringify(settings, null, 2))
      
      // 参数验证
      if (!settings || typeof settings !== 'object') {
        throw new Error('Invalid settings object')
      }
      
      // 颜色转换：从 #RRGGBB 转换为 &H00BBGGRR
      const hexToAss = (hex: string) => {
        if (!hex || !hex.startsWith('#')) return '&H00ffffff'
        const r = hex.substring(1, 3)
        const g = hex.substring(3, 5) 
        const b = hex.substring(5, 7)
        return `&H00${b}${g}${r}`
      }

      // 位置到ASS对齐值的正确映射
      // ASS Alignment: 1=左下 2=中下 3=右下 4=左中 5=中中 6=右中 7=左上 8=中上 9=右上
      const positionToAlignment = (position: string) => {
        console.log('映射位置:', position)
        switch (position) {
          case 'top': return 8         // 顶部居中
          case 'top-center': return 8  // 顶部居中
          case 'center-up': return 8   // 中上部，使用顶部居中
          case 'center': return 5      // 中部居中 
          case 'center-down': return 2 // 中下部，使用底部居中
          case 'bottom-center': return 2 // 底部居中
          case 'bottom': return 2      // 底部居中
          default: return 2            // 默认底部居中
        }
      }

      // 计算垂直边距 - ASS中MarginV的正确用法
      const getMarginV = (position: string, marginVertical: number | undefined) => {
        console.log('计算边距 - 位置:', position, '边距:', marginVertical)
        const margin = marginVertical || 20
        
        // ASS的MarginV表示距离视频边缘的像素距离
        switch (position) {
          case 'top':
          case 'top-center':
          case 'center-up':
            return margin  // 距离顶部
          case 'bottom':
          case 'bottom-center':
          case 'center-down':
            return margin  // 距离底部
          case 'center':
            return 0  // 正中不使用MarginV
          default:
            return margin
        }
      }

      // 生成ASS样式
      const fontSize = settings.fontSize || 20
      const color = settings.color || '#ffffff'
      const position = settings.position || 'bottom'
      const marginVertical = settings.marginVertical
      const marginHorizontal = settings.marginHorizontal || 0  // 默认不设置水平边距，让居中自然生效
      const outline = settings.outline !== false  // 默认启用描边
      const outlineWidth = settings.outlineWidth || 2
      
      console.log('字幕样式参数:', { fontSize, color, position, marginVertical, marginHorizontal, outline, outlineWidth })
      
      // 基础样式：字体和颜色
      let forceStyle = `FontName=Arial,FontSize=${fontSize},PrimaryColour=${hexToAss(color)},Bold=1`
      
      // 设置对齐方式 - 确保居中
      const alignment = positionToAlignment(position)
      forceStyle += `,Alignment=${alignment}`
      console.log('使用对齐值:', alignment)
      
      // 设置垂直边距
      const marginV = getMarginV(position, marginVertical)
      if (marginV > 0) {
        forceStyle += `,MarginV=${marginV}`
        console.log('应用垂直边距:', marginV)
      }
      
      // 只有在用户明确设置了水平边距时才应用（避免影响居中）
      if (marginHorizontal && marginHorizontal > 0) {
        forceStyle += `,MarginL=${marginHorizontal},MarginR=${marginHorizontal}`
        console.log('应用水平边距:', marginHorizontal)
      } else {
        console.log('保持水平居中，不设置边距')
      }
      
      // 描边设置
      if (outline) {
        forceStyle += `,Outline=${outlineWidth}`
        forceStyle += `,OutlineColour=&H00000000`
        console.log('应用描边:', outlineWidth)
      } else {
        forceStyle += `,Outline=0`
        console.log('禁用描边')
      }
      
      console.log('✅ 生成的ASS force_style:', forceStyle)
      return forceStyle
      
    } catch (error) {
      console.error('❌ generateCustomSubtitleStyle 执行失败:', error)
      throw error  // 重新抛出错误以便上层处理
    }
  }

  /**
   * 为视频添加字幕
   */
  async addSubtitleToVideo(videoPath: string, subtitlePath: string, outputPath: string, styleId?: string, customSettings?: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const subtitleExt = path.extname(subtitlePath).toLowerCase()
      
      let subtitleFilter: string
      
      if (subtitleExt === '.srt' || subtitleExt === '.vtt') {
        // SRT/VTT 字幕，统一使用前端面板显示的样式
        if (customSettings) {
          try {
            console.log('✅ 使用前端面板显示的字幕样式:', customSettings)
            const forceStyle = this.generateCustomSubtitleStyle(customSettings)
            subtitleFilter = `subtitles='${subtitlePath.replace(/'/g, "\\'")}':force_style='${forceStyle}'`
            console.log(`✅ 应用字幕滤镜: ${subtitleFilter}`)
          } catch (error) {
            console.error('❌ 处理字幕样式失败，使用基本样式:', error)
            // 回退到基本样式
            const fallbackStyle = 'FontName=Arial,FontSize=20,PrimaryColour=&H00ffffff,Alignment=2,MarginV=50,Outline=2,OutlineColour=&H00000000,Bold=1'
            subtitleFilter = `subtitles='${subtitlePath.replace(/'/g, "\\'")}':force_style='${fallbackStyle}'`
            console.log(`🔄 使用回退字幕样式: ${subtitleFilter}`)
          }
        } else {
          // 理论上不应该走到这里，因为前端总是会发送customSubtitleSettings
          console.warn('⚠️ 未收到前端字幕设置，使用默认样式')
          const defaultStyle = 'FontName=Arial,FontSize=20,PrimaryColour=&H00ffffff,Alignment=2,MarginV=50,Outline=2,OutlineColour=&H00000000,Bold=1'
          subtitleFilter = `subtitles='${subtitlePath.replace(/'/g, "\\'")}':force_style='${defaultStyle}'`
        }
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
        .fps(30)            // 标准化为30fps
        .audioFrequency(44100) // 标准化音频采样率
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-pix_fmt yuv420p',
          '-movflags +faststart',
          '-avoid_negative_ts make_zero',
          // 智能缩放到720x1280，保持宽高比，用黑边填充
          `-vf scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black`,
          // 确保关键帧设置
          '-g 30',
          '-keyint_min 30'
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
        // 确保目录存在
        await fs.ensureDir(tempDir)
        // 使用相对于列表文件的相对路径
        const fileList = normalizedPaths.map(videoPath => {
          const relativePath = path.relative(tempDir, videoPath)
          return `file '${relativePath}'`
        }).join('\n')
        await fs.writeFile(listFile, fileList)
        
        console.log(`创建拼接列表文件: ${listFile}`)
        console.log(`文件内容:\n${fileList}`)

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
            // 检查文件是否存在
            try {
              const listExists = await fs.pathExists(listFile)
              console.error(`拼接列表文件是否存在: ${listExists}`)
              if (listExists) {
                const content = await fs.readFile(listFile, 'utf8')
                console.error(`拼接列表文件内容:\n${content}`)
              }
              
              // 检查每个输入文件是否存在
              for (let i = 0; i < normalizedPaths.length; i++) {
                const exists = await fs.pathExists(normalizedPaths[i])
                console.error(`标准化文件 ${i} (${normalizedPaths[i]}) 是否存在: ${exists}`)
              }
            } catch (checkErr) {
              console.error('检查文件状态失败:', checkErr)
            }
            
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