import { memo } from 'react'
import { Card, Upload, Button, Alert, message } from 'antd'
import { InboxOutlined, SoundOutlined, VideoCameraOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'

const { Dragger } = Upload

interface FileUploadSectionProps {
  selectedFiles: File[]
  audioFile: File | null
  trailerFile: File | null
  isProcessing: boolean
  onFileSelect: (files: File[]) => void
  onAudioFileSelect: (file: File) => void
  onTrailerFileSelect: (file: File) => void
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  selectedFiles,
  audioFile,
  trailerFile,
  isProcessing,
  onFileSelect,
  onAudioFileSelect,
  onTrailerFileSelect
}) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleFileSelect = (info: any) => {
    const videoFiles: File[] = []
    info.fileList.forEach((file: UploadFile) => {
      if (file.originFileObj && file.originFileObj.type.startsWith('video/')) {
        videoFiles.push(file.originFileObj)
      }
    })

    if (videoFiles.length === 0) {
      message.warning('请选择视频文件')
      return
    }

    onFileSelect(videoFiles)
    message.success(`已选择 ${videoFiles.length} 个视频文件`)
  }

  return (
    <>
      {/* 视频文件选择 */}
      <Card title="📹 视频文件选择" style={{ marginBottom: 16 }}>
        <Dragger
          multiple
          accept="video/*"
          onChange={handleFileSelect}
          beforeUpload={() => false}
          style={{ padding: '40px' }}
          disabled={isProcessing}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽视频文件到这里</p>
          <p className="ant-upload-hint">支持多个视频文件同时上传，支持常见视频格式</p>
        </Dragger>

        {selectedFiles.length > 0 && (
          <Alert
            message={`已选择 ${selectedFiles.length} 个视频文件`}
            type="success"
            showIcon
            style={{ marginTop: 16 }}
            description={
              <div style={{ maxHeight: 100, overflowY: 'auto' }}>
                {selectedFiles.slice(0, 5).map((file, index) => (
                  <div key={index} style={{ fontSize: 12 }}>
                    • {file.name} ({formatFileSize(file.size)})
                  </div>
                ))}
                {selectedFiles.length > 5 && (
                  <div style={{ fontSize: 12, color: '#666' }}>
                    ... 还有 {selectedFiles.length - 5} 个文件
                  </div>
                )}
              </div>
            }
          />
        )}
      </Card>

      {/* 音频和引流视频 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card title="🎵 背景音频" size="small" style={{ flex: 1 }}>
          <Upload
            accept="audio/*"
            beforeUpload={(file) => {
              onAudioFileSelect(file)
              message.success('音频文件已选择')
              return false
            }}
            showUploadList={false}
            disabled={isProcessing}
          >
            <Button 
              icon={<SoundOutlined />} 
              block
              type={audioFile ? "default" : "dashed"}
              disabled={isProcessing}
            >
              {audioFile ? `✅ ${audioFile.name.substring(0, 15)}...` : '选择音频文件'}
            </Button>
          </Upload>
          {audioFile && (
            <div style={{ color: '#52c41a', fontSize: 11, marginTop: 4 }}>
              ✨ 将使用音频时长智能裁切视频
            </div>
          )}
        </Card>
        
        <Card title="🎬 引流视频" size="small" style={{ flex: 1 }}>
          <Upload
            accept="video/*"
            beforeUpload={(file) => {
              onTrailerFileSelect(file)
              message.success('引流视频已选择')
              return false
            }}
            showUploadList={false}
            disabled={isProcessing}
          >
            <Button 
              icon={<VideoCameraOutlined />} 
              block
              type={trailerFile ? "default" : "dashed"}
              disabled={isProcessing}
            >
              {trailerFile ? `✅ ${trailerFile.name.substring(0, 15)}...` : '选择引流视频'}
            </Button>
          </Upload>
        </Card>
      </div>
    </>
  )
}

export default memo(FileUploadSection)