import { Server } from 'socket.io';
import type { ProcessStatus } from '../types';
interface ProcessingOptions {
    videos: Express.Multer.File[];
    audioFile?: Express.Multer.File;
    trailerVideo?: Express.Multer.File;
    config: {
        audioDuration: number;
        subtitlePath: string;
    };
}
export declare class VideoProcessor {
    private processId;
    private io;
    private status;
    private ffmpeg;
    private isProcessing;
    private shouldStop;
    constructor(processId: string, io: Server);
    startProcessing(options: ProcessingOptions): Promise<void>;
    private processVideo;
    private getVideoRelativePath;
    private findSubtitleFiles;
    private saveStatus;
    private emitStatusUpdate;
    private emitFileProcessed;
    private emitProcessComplete;
    stopProcessing(): Promise<void>;
    getStatus(): ProcessStatus;
}
export {};
//# sourceMappingURL=videoProcessor.d.ts.map