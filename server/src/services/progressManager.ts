import { Server } from 'socket.io'
import fs from 'fs-extra'
import path from 'path'
import type { ProcessStatus } from '../../../shared/types'

export class ProgressManager {
  private status: ProcessStatus
  private io: Server
  private processId: string

  constructor(processId: string, io: Server, totalFiles: number) {
    this.processId = processId
    this.io = io
    this.status = {
      id: processId,
      status: 'pending',
      progress: 0,
      totalFiles,
      processedFiles: 0
    }
  }

  updateProgress(progress: number, step?: string, currentFile?: string) {
    this.status.progress = Math.min(100, Math.max(0, progress))
    if (step) this.status.currentStep = step
    if (currentFile) this.status.currentFile = currentFile
    this.emitStatusUpdate()
  }

  setCurrentFile(fileName: string, fileIndex: number) {
    this.status.currentFile = fileName
    const baseProgress = (fileIndex / this.status.totalFiles) * 100
    this.status.progress = baseProgress
    this.emitStatusUpdate()
  }

  incrementProcessedFiles() {
    this.status.processedFiles++
    this.emitStatusUpdate()
  }

  setStatus(status: 'pending' | 'processing' | 'completed' | 'error', error?: string) {
    this.status.status = status
    if (error) this.status.error = error
    this.emitStatusUpdate()
  }

  setCompleted() {
    this.status.status = 'completed'
    this.status.progress = 100
    this.status.currentStep = '处理完成'
    this.emitProcessComplete()
  }

  setError(error: string) {
    this.status.status = 'error'
    this.status.error = error
    this.emitProcessComplete()
  }

  getStatus(): ProcessStatus {
    return { ...this.status }
  }

  private emitStatusUpdate() {
    this.io.to(`process-${this.processId}`).emit('progress-update', this.status)
  }

  private emitProcessComplete() {
    this.io.to(`process-${this.processId}`).emit('process-complete', this.status)
  }

  async saveStatus() {
    try {
      const statusFile = path.join(process.cwd(), 'output', this.processId, 'status.json')
      await fs.ensureDir(path.dirname(statusFile))
      await fs.writeJson(statusFile, this.status, { spaces: 2 })
    } catch (error) {
      console.error('保存状态失败:', error)
    }
  }
}