import React, { useState, useEffect } from 'react'
import { Card, Button, Typography, Space, List, message, Progress } from 'antd'
import { DownloadOutlined, FolderOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { apiService } from '../services/api'
import type { DownloadInfo } from '../../shared/types'

const { Title, Text } = Typography

interface DownloadViewProps {
  processId: string
}

const DownloadView: React.FC<DownloadViewProps> = ({ processId }) => {
  const [downloadInfo, setDownloadInfo] = useState<DownloadInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)

  useEffect(() => {
    loadDownloadInfo()
  }, [processId])

  const loadDownloadInfo = async () => {
    try {
      const info = await apiService.getDownloadInfo(processId)
      setDownloadInfo(info)
    } catch (error) {
      message.error('获取下载信息失败')
      console.error('Load download info error:', error)
    }
  }

  const handleDownload = async () => {
    if (!downloadInfo) return

    try {
      setLoading(true)
      setDownloadProgress(0)

      // 创建下载链接
      const response = await fetch(`/api/download/${processId}`)
      
      if (!response.ok) {
        throw new Error('下载失败')
      }

      const contentLength = response.headers.get('content-length')
      const total = parseInt(contentLength || '0', 10)
      let loaded = 0

      const reader = response.body?.getReader()
      const chunks: Uint8Array[] = []

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) break
          
          chunks.push(value)
          loaded += value.length
          
          if (total > 0) {
            const progress = Math.round((loaded / total) * 100)
            setDownloadProgress(progress)
          }
        }
      }

      // 合并所有数据块
      const blob = new Blob(chunks)
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = downloadInfo.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      message.success('下载完成')
    } catch (error) {
      message.error('下载失败')
      console.error('Download error:', error)
    } finally {
      setLoading(false)
      setDownloadProgress(0)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleOpenOutputFolder = async () => {
    try {
      await apiService.openOutputFolder(processId)
      message.success('已打开输出文件夹')
    } catch (error) {
      message.error('打开文件夹失败')
      console.error('Open folder error:', error)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Title level={3}>
          <CheckCircleOutlined style={{ color: '#52c41a' }} /> 处理完成
        </Title>
        
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>恭喜！</Text>
            <Text style={{ marginLeft: '8px' }}>所有视频文件已处理完成</Text>
          </div>

          {downloadInfo && (
            <>
              <div>
                <Text strong>打包文件：</Text>
                <Text style={{ marginLeft: '8px' }} code>{downloadInfo.filename}</Text>
              </div>
              
              <div>
                <Text strong>文件大小：</Text>
                <Text style={{ marginLeft: '8px' }}>{formatFileSize(downloadInfo.size)}</Text>
              </div>
            </>
          )}

          {downloadProgress > 0 && (
            <Progress 
              percent={downloadProgress} 
              status="active"
              format={(percent) => `${percent}% 下载中...`}
            />
          )}

          <Space size="middle">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              size="large"
              loading={loading}
              onClick={handleDownload}
              disabled={!downloadInfo}
            >
              下载处理结果
            </Button>

            <Button
              icon={<FolderOutlined />}
              size="large"
              onClick={handleOpenOutputFolder}
            >
              打开输出文件夹
            </Button>
          </Space>
        </Space>
      </Card>

      <Card>
        <Title level={4}>处理说明</Title>
        <List>
          <List.Item>
            <Text>✅ 视频已按指定时长裁切</Text>
          </List.Item>
          <List.Item>
            <Text>✅ 已添加背景音频</Text>
          </List.Item>
          <List.Item>
            <Text>✅ 已添加字幕</Text>
          </List.Item>
          <List.Item>
            <Text>✅ 已添加引流视频</Text>
          </List.Item>
          <List.Item>
            <Text>✅ 保持原有文件夹结构</Text>
          </List.Item>
        </List>
      </Card>
    </Space>
  )
}

export default DownloadView