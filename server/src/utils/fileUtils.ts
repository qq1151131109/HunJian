import fs from 'fs-extra'
import path from 'path'

export class FileUtils {
  
  /**
   * 递归获取目录下的所有视频文件
   */
  static async getVideoFiles(dirPath: string, extensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv']): Promise<string[]> {
    const videoFiles: string[] = []
    
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name)
        
        if (item.isDirectory()) {
          // 递归处理子目录
          const subFiles = await this.getVideoFiles(fullPath, extensions)
          videoFiles.push(...subFiles)
        } else if (item.isFile()) {
          // 检查文件扩展名
          const ext = path.extname(item.name).toLowerCase()
          if (extensions.includes(ext)) {
            videoFiles.push(fullPath)
          }
        }
      }
    } catch (error) {
      console.error(`读取目录失败: ${dirPath}`, error)
    }
    
    return videoFiles
  }

  /**
   * 获取相对路径
   */
  static getRelativePath(fullPath: string, basePath: string): string {
    return path.relative(basePath, fullPath)
  }

  /**
   * 确保目录存在
   */
  static async ensureDir(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath)
  }

  /**
   * 复制文件并保持目录结构
   */
  static async copyWithStructure(sourcePath: string, sourceBaseDir: string, targetBaseDir: string): Promise<string> {
    const relativePath = this.getRelativePath(sourcePath, sourceBaseDir)
    const targetPath = path.join(targetBaseDir, relativePath)
    
    await this.ensureDir(path.dirname(targetPath))
    await fs.copy(sourcePath, targetPath)
    
    return targetPath
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 获取文件信息
   */
  static async getFileInfo(filePath: string): Promise<{
    size: number
    created: Date
    modified: Date
    extension: string
    basename: string
    dirname: string
  }> {
    const stats = await fs.stat(filePath)
    const ext = path.extname(filePath)
    const basename = path.basename(filePath, ext)
    const dirname = path.dirname(filePath)
    
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      extension: ext,
      basename,
      dirname
    }
  }

  /**
   * 清理临时文件
   */
  static async cleanupTempFiles(tempDir: string, olderThan: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      if (!await fs.pathExists(tempDir)) {
        return
      }

      const items = await fs.readdir(tempDir, { withFileTypes: true })
      const now = Date.now()
      
      for (const item of items) {
        const itemPath = path.join(tempDir, item.name)
        const stats = await fs.stat(itemPath)
        
        if (now - stats.mtime.getTime() > olderThan) {
          if (item.isDirectory()) {
            await fs.remove(itemPath)
            console.log(`清理临时目录: ${itemPath}`)
          } else {
            await fs.unlink(itemPath)
            console.log(`清理临时文件: ${itemPath}`)
          }
        }
      }
    } catch (error) {
      console.error(`清理临时文件失败: ${tempDir}`, error)
    }
  }

  /**
   * 检查磁盘空间
   */
  static async checkDiskSpace(dirPath: string): Promise<{
    free: number
    total: number
    used: number
  }> {
    // 这个功能需要系统调用，简化实现
    // 在实际项目中可以使用 'check-disk-space' 包
    return {
      free: 0,
      total: 0,
      used: 0
    }
  }

  /**
   * 创建唯一的文件名
   */
  static createUniqueFilename(originalName: string, directory: string): string {
    const ext = path.extname(originalName)
    const basename = path.basename(originalName, ext)
    let counter = 1
    let newName = originalName

    while (fs.existsSync(path.join(directory, newName))) {
      newName = `${basename}_${counter}${ext}`
      counter++
    }

    return newName
  }

  /**
   * 验证文件类型
   */
  static isVideoFile(filename: string): boolean {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.m4v']
    const ext = path.extname(filename).toLowerCase()
    return videoExtensions.includes(ext)
  }

  static isAudioFile(filename: string): boolean {
    const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a']
    const ext = path.extname(filename).toLowerCase()
    return audioExtensions.includes(ext)
  }

  static isSubtitleFile(filename: string): boolean {
    const subtitleExtensions = ['.srt', '.ass', '.ssa', '.vtt', '.sub']
    const ext = path.extname(filename).toLowerCase()
    return subtitleExtensions.includes(ext)
  }

  /**
   * 生成安全的文件名（去除特殊字符）
   */
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^\w\s.-]/g, '') // 移除特殊字符
      .replace(/\s+/g, '_')      // 替换空格为下划线
      .replace(/_{2,}/g, '_')    // 合并多个下划线
      .trim()
  }

  /**
   * 递归删除空目录
   */
  static async removeEmptyDirs(dirPath: string): Promise<void> {
    try {
      if (!await fs.pathExists(dirPath)) {
        return
      }

      const items = await fs.readdir(dirPath)
      
      if (items.length === 0) {
        await fs.rmdir(dirPath)
        console.log(`删除空目录: ${dirPath}`)
        
        // 递归检查父目录
        const parentDir = path.dirname(dirPath)
        if (parentDir !== dirPath) {
          await this.removeEmptyDirs(parentDir)
        }
      }
    } catch (error) {
      // 忽略错误，可能是权限问题或目录不为空
    }
  }
}