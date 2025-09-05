export interface VideoFile {
    id: string;
    originalPath: string;
    relativePath: string;
    name: string;
    size: number;
    type: string;
}
export interface ProcessConfig {
    audioDuration: number;
    audioFile?: File;
    subtitlePath: string;
    trailerVideo?: File;
}
export interface ProcessStatus {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    currentFile?: string;
    progress: number;
    totalFiles: number;
    processedFiles: number;
    error?: string;
}
export interface ProcessResult {
    id: string;
    originalFile: string;
    outputFile: string;
    status: 'success' | 'error';
    error?: string;
}
export interface DownloadInfo {
    id: string;
    filename: string;
    size: number;
    url: string;
}
//# sourceMappingURL=types.d.ts.map