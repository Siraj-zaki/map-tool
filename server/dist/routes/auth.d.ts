import { Request, Response } from 'express';
declare const router: import("express-serve-static-core").Router;
declare module 'express-session' {
    interface SessionData {
        userId: number;
        username: string;
        role: string;
    }
}
export declare function requireAuth(req: Request, res: Response, next: Function): Response<any, Record<string, any>> | undefined;
export declare function requireAdmin(req: Request, res: Response, next: Function): Response<any, Record<string, any>> | undefined;
export default router;
//# sourceMappingURL=auth.d.ts.map