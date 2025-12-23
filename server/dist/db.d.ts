import mysql from 'mysql2/promise';
declare const pool: mysql.Pool;
export declare function query<T = any>(sql: string, params?: any[]): Promise<T>;
export declare function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
export declare function run(sql: string, params?: any[]): Promise<mysql.ResultSetHeader>;
export declare function initializeDatabase(): Promise<void>;
export declare function closeDatabase(): Promise<void>;
export { pool };
declare const _default: {
    query: typeof query;
    queryOne: typeof queryOne;
    run: typeof run;
    pool: mysql.Pool;
};
export default _default;
//# sourceMappingURL=db.d.ts.map