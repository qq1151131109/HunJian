export interface SubtitleSettings {
  styleId: string
  fontSize: number
  position: 'top' | 'top-center' | 'center-up' | 'center' | 'center-down' | 'bottom-center' | 'bottom'
  marginVertical: number
  marginHorizontal: number
  color: string
  outline: boolean
  outlineWidth: number
}