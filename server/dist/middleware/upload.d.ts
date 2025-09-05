import multer from 'multer';
declare const upload: multer.Multer;
export declare const uploadFiles: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export default upload;
declare global {
    namespace Express {
        interface Request {
            processId?: string;
        }
    }
}
//# sourceMappingURL=upload.d.ts.map