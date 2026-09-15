/**
 * PM2 ecosystem config for ORYNVE v2 on a VPS.
 * Usage:
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup   # follow the printed command
 *
 * The app is started in fork mode running the standalone Next.js server
 * produced by `npm run build` with DEPLOY_TARGET=standalone.
 */
module.exports = {
  apps: [
    {
      name: "orynve",
      script: ".next/standalone/server.js",

      // Fork mode is sufficient for a single-origin Node.js app.
      // Change to 'cluster' and set instances: 'max' for multi-core scaling,
      // but ensure your database supports the connection count.
      exec_mode: "fork",
      instances: 1,

      // Environment variables. Sensitive values should come from .env instead.
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
      },

      // Log files
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Restart on crash; do not restart if the app exits within 10 seconds
      // (prevents crash loops consuming resources).
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 2000,

      // Watch is disabled in production. Run `pm2 restart orynve` after deploys.
      watch: false,

      // Graceful shutdown: allow 10 seconds for in-flight requests to finish.
      kill_timeout: 10000,
      listen_timeout: 10000,
    },
  ],
};
