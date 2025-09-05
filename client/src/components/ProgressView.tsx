import React, { useState, useEffect } from 'react'
import { Card, Progress, Typography, List, Space, Alert, Spin } from 'antd'
import { CheckCircleOutlined, LoadingOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { io, Socket } from 'socket.io-client'
import type { ProcessStatus, ProcessResult } from '../../shared/types'

const { Title, Text } = Typography

interface ProgressViewProps {
  processId: string
  onProcessComplete: (status: ProcessStatus) => void
}

const ProgressView: React.FC<ProgressViewProps> = ({ processId, onProcessComplete }) => {
  const [status, setStatus] = useState<ProcessStatus>({
    id: processId,
    status: 'pending',
    progress: 0,
    totalFiles: 0,
    processedFiles: 0
  })
  const [results, setResults] = useState<ProcessResult[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    // 连接Socket.io
    const newSocket = io()
    setSocket(newSocket)

    // 加入处理任务房间
    newSocket.emit('join-process', processId)

    // 监听进度更新
    newSocket.on('progress-update', (data: ProcessStatus) => {
      setStatus(data)
    })

    // 监听单个文件处理完成
    newSocket.on('file-processed', (data: ProcessResult) => {
      setResults(prev => [...prev, data])
    })

    // 监听处理完成
    newSocket.on('process-complete', (data: ProcessStatus) => {
      setStatus(data)
      onProcessComplete(data)
    })

    // 监听错误
    newSocket.on('process-error', (data: ProcessStatus) => {
      setStatus(data)
      onProcessComplete(data)
    })

    return () => {
      newSocket.disconnect()
    }
  }, [processId, onProcessComplete])

  const getStatusIcon = (itemStatus: string) => {
    switch (itemStatus) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#f5222d' }} />
      default:
        return <LoadingOutlined style={{ color: '#1890ff' }} />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '等待开始'
      case 'processing':
        return '正在处理'
      case 'completed':
        return '处理完成'
      case 'error':
        return '处理失败'
      default:
        return '未知状态'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'error':
        return 'exception'
      case 'processing':
        return 'active'
      default:
        return 'normal'
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Title level={3}>
          <LoadingOutlined /> 处理进度
        </Title>
        
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>任务状态：</Text>
            <Text style={{ marginLeft: '8px' }}>{getStatusText(status.status)}</Text>
          </div>

          {status.currentFile && (
            <div>
              <Text strong>当前处理：</Text>
              <Text style={{ marginLeft: '8px' }} code>{status.currentFile}</Text>
            </div>
          )}

          <Progress
            percent={Math.round(status.progress)}
            status={getStatusColor(status.status) as any}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />

          <div>
            <Text strong>进度：</Text>
            <Text style={{ marginLeft: '8px' }}>
              {status.processedFiles} / {status.totalFiles} 文件已完成
            </Text>
          </div>

          {status.status === 'error' && status.error && (
            <Alert
              message="处理出错"
              description={status.error}
              type="error"
              showIcon
            />
          )}
        </Space>
      </Card>

      {results.length > 0 && (
        <Card>
          <Title level={4}>处理结果</Title>
          <List
            dataSource={results}
            renderItem={(result) => (
              <List.Item>
                <List.Item.Meta
                  avatar={getStatusIcon(result.status)}
                  title={result.originalFile}
                  description={
                    result.status === 'success' 
                      ? `输出: ${result.outputFile}`
                      : `错误: ${result.error}`
                  }
                />
              </List.Item>
            )}
            style={{ maxHeight: '400px', overflowY: 'auto' }}
          />
        </Card>
      )}

      {status.status === 'processing' && (
        <div style={{ textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary">正在处理视频文件，请耐心等待...</Text>
          </div>
        </div>
      )}
    </Space>
  )
}

export default ProgressView