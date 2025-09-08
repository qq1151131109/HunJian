import React, { useState } from 'react'
import { Card, Form, InputNumber, Upload, Button, Typography, Space, message, Divider } from 'antd'
import { UploadOutlined, SoundOutlined, PlayCircleOutlined, SettingOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import { apiService } from '../services/api'
import type { ProcessConfig as ProcessConfigType } from '../../shared/types'

const { Title, Text } = Typography

interface ProcessConfigProps {
  files: File[]
  onConfigComplete: (config: ProcessConfigType, processId: string) => void
}

const ProcessConfig: React.FC<ProcessConfigProps> = ({ files, onConfigComplete }) => {
  const [form] = Form.useForm()
  const [audioFileList, setAudioFileList] = useState<UploadFile[]>([])
  const [trailerFileList, setTrailerFileList] = useState<UploadFile[]>([])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true)

      const config: ProcessConfigType = {
        audioDuration: values.audioDuration,
        audioFile: audioFileList[0]?.originFileObj,
        subtitlePath: './subtitles',  // 使用相对路径
        trailerVideo: trailerFileList[0]?.originFileObj
      }

      // 创建FormData
      const formData = new FormData()
      
      // 添加配置信息
      formData.append('config', JSON.stringify({
        audioDuration: config.audioDuration,
        subtitlePath: config.subtitlePath
      }))

      // 添加视频文件
      files.forEach((file, index) => {
        formData.append(`videos`, file)
        // @ts-ignore
        formData.append(`videoPath_${index}`, file.webkitRelativePath || file.name)
      })

      // 添加音频文件
      if (config.audioFile) {
        formData.append('audioFile', config.audioFile)
      }

      // 添加引流视频
      if (config.trailerVideo) {
        formData.append('trailerVideo', config.trailerVideo)
      }

      const response = await apiService.startProcess(formData)
      message.success('开始处理视频文件')
      onConfigComplete(config, response.processId)
    } catch (error) {
      message.error('启动处理失败')
      console.error('Process start error:', error)
    } finally {
      setLoading(false)
    }
  }

  const audioUploadProps = {
    accept: 'audio/*',
    beforeUpload: () => false,
    fileList: audioFileList,
    onChange: ({ fileList }: { fileList: UploadFile[] }) => {
      setAudioFileList(fileList.slice(-1)) // 只保留最后一个文件
    },
    maxCount: 1
  }

  const trailerUploadProps = {
    accept: 'video/*',
    beforeUpload: () => false,
    fileList: trailerFileList,
    onChange: ({ fileList }: { fileList: UploadFile[] }) => {
      setTrailerFileList(fileList.slice(-1)) // 只保留最后一个文件
    },
    maxCount: 1
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Title level={3}>
          <SettingOutlined /> 处理参数配置
        </Title>
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            audioDuration: 30
          }}
        >
          <Card size="small" style={{ marginBottom: '16px' }}>
            <Title level={5}>视频裁切设置</Title>
            <Form.Item
              name="audioDuration"
              label="目标时长（秒）"
              rules={[
                { required: true, message: '请输入目标时长' },
                { type: 'number', min: 1, max: 300, message: '时长必须在1-300秒之间' }
              ]}
              help="视频将按照此时长进行裁切，不足时长的部分将被丢弃"
            >
              <InputNumber
                style={{ width: '200px' }}
                placeholder="30"
                addonAfter="秒"
              />
            </Form.Item>
          </Card>

          <Card size="small" style={{ marginBottom: '16px' }}>
            <Title level={5}>
              <SoundOutlined /> 背景音频设置
            </Title>
            <Form.Item
              name="audioFile"
              label="背景音频文件"
              help="为每个视频片段添加的背景音频"
            >
              <Upload {...audioUploadProps}>
                <Button icon={<UploadOutlined />}>选择音频文件</Button>
              </Upload>
            </Form.Item>
          </Card>

          <Card size="small" style={{ marginBottom: '16px' }}>
            <Title level={5}>
              <PlayCircleOutlined /> 引流视频设置
            </Title>
            <Form.Item
              name="trailerVideo"
              label="引流视频文件"
              help="在每个处理后的视频片段末尾添加的引流视频"
            >
              <Upload {...trailerUploadProps}>
                <Button icon={<UploadOutlined />}>选择引流视频</Button>
              </Upload>
            </Form.Item>
          </Card>

          <Divider />

          <div style={{ marginBottom: '16px' }}>
            <Text strong>字幕文件路径：</Text>
            <br />
            <Text code>./subtitles (相对于项目根目录)</Text>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <Text strong>待处理文件数量：</Text>
            <Text style={{ marginLeft: '8px', color: '#1890ff' }}>{files.length} 个视频文件</Text>
          </div>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              style={{ width: '200px' }}
            >
              开始处理
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Space>
  )
}

export default ProcessConfig