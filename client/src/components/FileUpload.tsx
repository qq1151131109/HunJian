import React, { useState } from 'react'
import { Upload, Button, Card, List, Typography, Space, message } from 'antd'
import { InboxOutlined, FolderOpenOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'

const { Dragger } = Upload
const { Title, Text } = Typography

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected }) => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [fileList, setFileList] = useState<UploadFile[]>([])

  const handleFileSelect = (info: any) => {
    const { fileList: newFileList } = info
    setFileList(newFileList)

    // 提取所有视频文件
    const videoFiles: File[] = []
    newFileList.forEach((file: UploadFile) => {
      if (file.originFileObj && file.originFileObj.type.startsWith('video/')) {
        videoFiles.push(file.originFileObj)
      }
    })

    setUploadedFiles(videoFiles)
  }

  const handleFolderUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const videoFiles = files.filter(file => file.type.startsWith('video/'))
    
    if (videoFiles.length === 0) {
      message.warning('未发现视频文件')
      return
    }

    setUploadedFiles(videoFiles)
    message.success(`已选择 ${videoFiles.length} 个视频文件`)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getRelativePath = (file: File) => {
    // @ts-ignore - webkitRelativePath is available in browsers
    return file.webkitRelativePath || file.name
  }

  const handleNext = () => {
    if (uploadedFiles.length === 0) {
      message.warning('请先选择视频文件')
      return
    }
    onFilesSelected(uploadedFiles)
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Title level={3}>选择视频文件</Title>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Dragger
            multiple
            accept="video/*"
            fileList={fileList}
            onChange={handleFileSelect}
            beforeUpload={() => false} // 阻止自动上传
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽视频文件到此区域</p>
            <p className="ant-upload-hint">支持单个或批量上传，只处理视频文件</p>
          </Dragger>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">或者</Text>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Button
              icon={<FolderOpenOutlined />}
              size="large"
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.webkitdirectory = true
                input.multiple = true
                input.accept = 'video/*'
                input.onchange = handleFolderUpload
                input.click()
              }}
            >
              选择文件夹（保持目录结构）
            </Button>
          </div>
        </Space>
      </Card>

      {uploadedFiles.length > 0 && (
        <Card>
          <Title level={4}>已选择的视频文件 ({uploadedFiles.length})</Title>
          <List
            dataSource={uploadedFiles}
            renderItem={(file, index) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<PlayCircleOutlined style={{ fontSize: '24px', color: '#1890ff' }} />}
                  title={getRelativePath(file)}
                  description={`大小: ${formatFileSize(file.size)} | 类型: ${file.type}`}
                />
              </List.Item>
            )}
            style={{ maxHeight: '400px', overflowY: 'auto' }}
          />
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Button type="primary" size="large" onClick={handleNext}>
              下一步：配置参数
            </Button>
          </div>
        </Card>
      )}
    </Space>
  )
}

export default FileUpload