import React, { useState } from 'react'
import { Layout, Typography, Steps, message } from 'antd'
import FileUpload from './components/FileUpload'
import ProcessConfig from './components/ProcessConfig'
import ProgressView from './components/ProgressView'
import DownloadView from './components/DownloadView'
import type { ProcessConfig as ProcessConfigType, ProcessStatus } from '../../shared/types'

const { Header, Content } = Layout
const { Title } = Typography

interface StepData {
  files?: File[]
  config?: ProcessConfigType
  processId?: string
  status?: ProcessStatus
}

function App() {
  const [currentStep, setCurrentStep] = useState(0)
  const [stepData, setStepData] = useState<StepData>({})

  const steps = [
    {
      title: '上传文件',
      description: '选择要处理的视频文件夹',
    },
    {
      title: '配置参数',
      description: '设置音频时长、字幕等参数',
    },
    {
      title: '处理进度',
      description: '等待视频处理完成',
    },
    {
      title: '下载结果',
      description: '下载处理完成的视频',
    },
  ]

  const handleFilesSelected = (files: File[]) => {
    setStepData(prev => ({ ...prev, files }))
    setCurrentStep(1)
  }

  const handleConfigComplete = (config: ProcessConfigType, processId: string) => {
    setStepData(prev => ({ ...prev, config, processId }))
    setCurrentStep(2)
  }

  const handleProcessComplete = (status: ProcessStatus) => {
    if (status.status === 'completed') {
      setStepData(prev => ({ ...prev, status }))
      setCurrentStep(3)
      message.success('视频处理完成！')
    } else if (status.status === 'error') {
      message.error(`处理失败：${status.error}`)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <FileUpload onFilesSelected={handleFilesSelected} />
      case 1:
        return (
          <ProcessConfig
            files={stepData.files || []}
            onConfigComplete={handleConfigComplete}
          />
        )
      case 2:
        return (
          <ProgressView
            processId={stepData.processId!}
            onProcessComplete={handleProcessComplete}
          />
        )
      case 3:
        return <DownloadView processId={stepData.processId!} />
      default:
        return null
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#1890ff', padding: '0 50px' }}>
        <Title level={2} style={{ color: 'white', margin: '16px 0' }}>
          游戏视频混剪处理程序
        </Title>
      </Header>
      <Content style={{ padding: '50px' }}>
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px' }}>
          <Steps current={currentStep} items={steps} style={{ marginBottom: '40px' }} />
          {renderStepContent()}
        </div>
      </Content>
    </Layout>
  )
}

export default App