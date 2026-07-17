/**
 * 数据库配置模板
 *
 * 使用说明：
 *   1. 按需填写下方连接信息（主机、端口、用户名、密码、库名）。
 *   2. 敏感信息建议放到环境变量里，不要直接提交到仓库；
 *      下方已用 process.env.* 兜底，本地可在 server 目录下建 .env 文件覆盖。
 *   3. 这里只导出配置，实际的连接/连接池由后续代码按此配置创建。
 *
 * TODO: 有关信息稍后补充。
 */

export const dbConfig = {
  // 数据库主机地址
  host: process.env.DB_HOST || 'localhost',

  // 数据库端口（MySQL 默认 3306 / PostgreSQL 默认 5432）
  port: Number(process.env.DB_PORT) || 3306,

  // 登录用户名
  user: process.env.DB_USER || 'my_server',

  // 登录密码
  password: process.env.DB_PASSWORD || '123456',

  // 使用的数据库名
  database: process.env.DB_NAME || 'my_server',

  // 连接字符集
  charset: 'utf8mb4',

  // 连接池配置（如使用连接池）
  connectionLimit: Number(process.env.DB_POOL_LIMIT) || 10,

  // 是否打印 SQL 日志（调试用）
  debug: false,
}

export default dbConfig
