import { useState, useEffect, useCallback, useMemo } from 'react'
import { Layout, Typography, Card, Row, Col, Button, List, Space, message } from 'antd'
import { PlayCircleOutlined, DownloadOutlined, LoadingOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { io, Socket } from 'socket.io-client'
import { apiService } from './services/api'
import type { ProcessStatus, ProcessResult } from '../../shared/types'
import type { SubtitleSettings } from './types/subtitle'
import CompactSubtitleSelector from './components/CompactSubtitleSelector'
import FileUploadSection from './components/FileUploadSection'
import TaskManager from './components/TaskManager'

const { Header, Content } = Layout
const { Title, Text } = Typography

function App() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [trailerFile, setTrailerFile] = useState<File | null>(null)
  const [selectedSubtitleStyle, setSelectedSubtitleStyle] = useState('tiktok-classic')
  const [customSubtitleSettings, setCustomSubtitleSettings] = useState<SubtitleSettings | null>(null)
  const [processId, setProcessId] = useState<string>('')
  const [processStatus, setProcessStatus] = useState<ProcessStatus>({
    id: '',
    status: 'pending',
    progress: 0,
    totalFiles: 0,
    processedFiles: 0
  })
  const [processResults, setProcessResults] = useState<ProcessResult[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isProcessing, setIsProcessing] = useState(false) // 当前选中任务是否在处理中
  const [isSubmitting, setIsSubmitting] = useState(false) // 是否正在提交新任务
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')

  // 清理Socket连接，防止内存泄漏
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect()
        socket.removeAllListeners()
      }
    }
  }, [socket])


  const handleSubtitleChange = useCallback((styleId: string, settings: SubtitleSettings) => {
    setSelectedSubtitleStyle(styleId)
    setCustomSubtitleSettings(settings)
  }, [])

  const handleStartProcess = async () => {
    if (selectedFiles.length === 0) {
      message.error('请先选择视频文件')
      return
    }

    try {
      const formData = new FormData()
      
      selectedFiles.forEach((file) => {
        formData.append('videos', file)
      })

      if (audioFile) {
        formData.append('audioFile', audioFile)
      }

      if (trailerFile) {
        formData.append('trailerVideo', trailerFile)
      }

      const config = {
        audioDuration: 30,
        subtitlePath: '',
        subtitleStyle: selectedSubtitleStyle,
        customSubtitleSettings: customSubtitleSettings
      }
      formData.append('config', JSON.stringify(config))

      setIsSubmitting(true)
      const response = await apiService.startProcess(formData)
      setProcessId(response.processId)
      setSelectedTaskId(response.processId)
      
      // 连接到新任务的WebSocket
      connectToTask(response.processId)

      message.success('任务已提交，开始处理视频...')
      setIsSubmitting(false)
      
    } catch (error) {
      console.error('启动处理失败:', error)
      message.error('启动处理失败')
      setIsSubmitting(false)
    }
  }

  // 连接到指定任务的WebSocket
  const connectToTask = useCallback((taskId: string) => {
    // 清理之前的连接
    if (socket) {
      socket.disconnect()
      socket.removeAllListeners()
    }

    const newSocket = io()
    setSocket(newSocket)
    
    newSocket.emit('join-process', taskId)
    
    newSocket.on('progress-update', (status: ProcessStatus) => {
      if (status.id === taskId) {
        setProcessStatus(status)
        // 更新当前选中任务的处理状态
        setIsProcessing(status.status === 'processing')
      }
    })

    newSocket.on('file-processed', (result: ProcessResult) => {
      if (result.processId === taskId) {
        setProcessResults(prev => [...prev, result])
      }
    })

    newSocket.on('process-complete', (finalStatus: ProcessStatus) => {
      if (finalStatus.id === taskId) {
        setProcessStatus(finalStatus)
        setIsProcessing(false)
        message.success('任务处理完成！')
      }
    })
  }, [socket])

  // 处理任务选择
  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId)
    setProcessId(taskId)
    
    // 清空之前的处理结果
    setProcessResults([])
    
    // 连接到选中的任务
    connectToTask(taskId)
    
    // 获取任务状态
    apiService.getProcessStatus(taskId)
      .then((response) => {
        // API返回的是完整的状态对象
        const status = (response as any).data || (response as unknown as ProcessStatus)
        setProcessStatus(status)
        setIsProcessing(status.status === 'processing')
      })
      .catch((error) => {
        console.error('获取任务状态失败:', error)
        message.error('获取任务状态失败')
      })
  }, [connectToTask])

  const handleDownload = useCallback(async () => {
    if (!processId) return
    
    try {
      const blob = await apiService.downloadResults(processId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `processed_videos_${processId}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success('下载开始！')
    } catch (error) {
      message.error('下载失败')
    }
  }, [processId])

  const handleOpenFolder = useCallback(async () => {
    if (!processId) return
    
    try {
      await apiService.openOutputFolder(processId)
      message.success('已打开输出文件夹')
    } catch (error) {
      message.error('打开文件夹失败')
    }
  }, [processId])

  const canStartProcess = useMemo(() => selectedFiles.length > 0 && !isSubmitting, [selectedFiles.length, isSubmitting])
  const isCompleted = useMemo(() => processStatus.status === 'completed', [processStatus.status])

  return (
    <Layout>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <Title level={3} style={{ color: 'white', margin: '16px 0' }}>
          🎬 游戏视频混剪工具
        </Title>
      </Header>
      
      <Content style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
        <Row gutter={[24, 24]}>
          {/* 左侧：文件选择和配置 */}
          <Col xs={24} lg={12}>
            <FileUploadSection
              selectedFiles={selectedFiles}
              audioFile={audioFile}
              trailerFile={trailerFile}
              isProcessing={isProcessing}
              onFileSelect={setSelectedFiles}
              onAudioFileSelect={setAudioFile}
              onTrailerFileSelect={setTrailerFile}
            />

            {/* 字幕配置 */}
            <CompactSubtitleSelector
              value={selectedSubtitleStyle}
              onChange={handleSubtitleChange}
            />

            {/* 处理控制 */}
            <Card title="⚡ 处理控制" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  size="large"
                  icon={isSubmitting ? <LoadingOutlined /> : <PlayCircleOutlined />}
                  onClick={handleStartProcess}
                  disabled={!canStartProcess}
                  block
                  loading={isSubmitting}
                >
                  {isSubmitting ? '提交中...' : '开始处理'}
                </Button>

              </Space>
            </Card>


            {/* 处理结果和下载 */}
            {selectedTaskId && (processResults.length > 0 || isCompleted) && (
              <Card title="📥 处理结果" style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {processResults.length > 0 && (
                    <List
                      size="small"
                      dataSource={processResults}
                      renderItem={(result) => (
                        <List.Item>
                          <Text
                            style={{
                              color: result.status === 'success' ? '#52c41a' : '#ff4d4f'
                            }}
                          >
                            {result.status === 'success' ? '✅' : '❌'} {result.originalFile}
                          </Text>
                        </List.Item>
                      )}
                      style={{ maxHeight: 200, overflowY: 'auto' }}
                    />
                  )}

                  {isCompleted && (
                    <Space>
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleDownload}
                      >
                        下载结果
                      </Button>
                      <Button
                        icon={<FolderOpenOutlined />}
                        onClick={handleOpenFolder}
                      >
                        打开文件夹
                      </Button>
                    </Space>
                  )}
                </Space>
              </Card>
            )}
          </Col>

          {/* 右侧：任务列表 */}
          <Col xs={24} lg={12}>
            <Card title="📋 任务列表" style={{ height: 'calc(100vh - 200px)' }}>
              <TaskManager 
                onSelectTask={handleSelectTask}
                currentTaskId={selectedTaskId}
              />
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  )
}

export default App