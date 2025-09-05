import axios from 'axios'
import type { DownloadInfo } from '../../shared/types'

const API_BASE_URL = '/api'

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const apiService = {
  // 开始处理视频
  startProcess: async (formData: FormData): Promise<{ processId: string }> => {
    return axiosInstance.post('/process/start', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  // 获取处理状态
  getProcessStatus: async (processId: string) => {
    return axiosInstance.get(`/process/status/${processId}`)
  },

  // 获取下载信息
  getDownloadInfo: async (processId: string): Promise<DownloadInfo> => {
    return axiosInstance.get(`/download/info/${processId}`)
  },

  // 下载处理结果
  downloadResults: async (processId: string): Promise<Blob> => {
    const response = await fetch(`/api/download/${processId}`)
    if (!response.ok) {
      throw new Error('下载失败')
    }
    return response.blob()
  },

  // 打开输出文件夹
  openOutputFolder: async (processId: string) => {
    return axiosInstance.post(`/process/open-folder/${processId}`)
  },

  // 检查服务器状态
  checkServerStatus: async () => {
    return axiosInstance.get('/health')
  }
}

export default apiService