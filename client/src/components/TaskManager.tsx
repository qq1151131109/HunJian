import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Tag, Space, message, Popconfirm, Tooltip } from 'antd'
import { 
  ReloadOutlined, 
  StopOutlined, 
  DownloadOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import { io, Socket } from 'socket.io-client'
import { apiService } from '../services/api'
import type { ProcessStatus } from '../../../shared/types'

interface Task extends ProcessStatus {
  createdAt: string
  updatedAt: string
}

interface TaskManagerProps {
  onSelectTask: (taskId: string) => void
  currentTaskId?: string
}

const TaskManager: React.FC<TaskManagerProps> = ({ onSelectTask, currentTaskId }) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)

  // 加载任务列表
  const loadTasks = async () => {
    setLoading(true)
    try {
      const taskList = await apiService.getTaskList()
      setTasks((taskList as any).data || (taskList as unknown as Task[]))
    } catch (error) {
      console.error('加载任务列表失败:', error)
      message.error('加载任务列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 停止任务
  const stopTask = async (taskId: string) => {
    try {
      await apiService.stopTask(taskId)
      message.success('任务已停止')
      loadTasks()
    } catch (error) {
      console.error('停止任务失败:', error)
      message.error('停止任务失败')
    }
  }

  // 下载结果
  const downloadResults = async (taskId: string) => {
    try {
      const blob = await apiService.downloadResults(taskId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `processed_videos_${taskId}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success('下载开始')
    } catch (error) {
      console.error('下载失败:', error)
      message.error('下载失败')
    }
  }

  // 删除任务
  const deleteTask = async (taskId: string) => {
    try {
      await apiService.deleteTask(taskId)
      message.success('任务及相关文件已删除')
      loadTasks()
      // 如果删除的是当前选中的任务，清空选中状态
      if (currentTaskId === taskId) {
        onSelectTask('')
      }
    } catch (error) {
      console.error('删除任务失败:', error)
      message.error('删除任务失败')
    }
  }

  // 格式化时间
  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleString('zh-CN')
  }

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusMap = {
      'pending': { color: 'default', text: '等待中' },
      'processing': { color: 'processing', text: '处理中' },
      'completed': { color: 'success', text: '已完成' },
      'error': { color: 'error', text: '失败' }
    }
    
    const config = statusMap[status as keyof typeof statusMap] || { color: 'default', text: status }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  // 表格列定义
  const columns = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      render: (id: string) => (
        <Tooltip title={id}>
          <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
            {id.substring(0, 8)}...
          </span>
        </Tooltip>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: getStatusTag
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 100,
      render: (progress: number) => `${Math.round(progress)}%`
    },
    {
      title: '文件数',
      key: 'files',
      width: 100,
      render: (record: Task) => `${record.processedFiles || 0}/${record.totalFiles || 0}`
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: formatTime
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (record: Task) => (
        <Space size="small">
          
          {record.status === 'processing' && (
            <Popconfirm
              title="确定要停止这个任务吗？"
              onConfirm={() => stopTask(record.id)}
            >
              <Button size="small" danger icon={<StopOutlined />}>
                停止
              </Button>
            </Popconfirm>
          )}
          
          {record.status === 'completed' && (
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => downloadResults(record.id)}
            >
              下载
            </Button>
          )}
          
          <Popconfirm
            title="确定要删除这个任务及相关文件吗？此操作不可撤销。"
            onConfirm={() => deleteTask(record.id)}
            okText="确定删除"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  // 设置Socket.io连接进行实时更新
  useEffect(() => {
    const newSocket = io()
    setSocket(newSocket)
    
    // 监听任务状态更新（全局消息）
    newSocket.on('task-status-update', (status: ProcessStatus) => {
      console.log('收到任务状态更新:', status)
      setTasks(prev => {
        const existingTask = prev.find(task => task.id === status.id)
        if (existingTask) {
          // 更新现有任务
          return prev.map(task => 
            task.id === status.id 
              ? { ...task, ...status }
              : task
          )
        } else {
          // 添加新任务
          const newTask: Task = {
            ...status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          return [newTask, ...prev]
        }
      })
    })

    return () => {
      newSocket.disconnect()
      newSocket.removeAllListeners()
    }
  }, [])

  useEffect(() => {
    loadTasks()
    // 定期刷新任务列表（较低频率，主要依赖实时更新）
    const interval = setInterval(loadTasks, 15000) // 从5秒改为15秒
    return () => clearInterval(interval)
  }, [])

  return (
    <Card
      title="📋 任务管理"
      extra={
        <Button
          icon={<ReloadOutlined />}
          onClick={loadTasks}
          loading={loading}
          size="small"
        >
          刷新
        </Button>
      }
      size="small"
    >
      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 个任务`
        }}
        rowClassName={(record) => 
          currentTaskId === record.id ? 'ant-table-row-selected' : ''
        }
      />
    </Card>
  )
}

export default TaskManager