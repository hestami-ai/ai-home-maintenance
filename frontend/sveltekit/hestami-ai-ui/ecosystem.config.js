module.exports = {
  apps: [{
    name: 'hestami-frontend',
    script: './build/index.js',
    instances: 'max',  // Use all available CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      BODY_SIZE_LIMIT: 104857600  // 100MB in bytes
    },
    // Auto-restart if memory exceeds 3GB (leaving 1GB buffer from 4GB limit)
    max_memory_restart: '3G',
    
    // Logging configuration
    error_file: '/dev/null',  // Use Docker logging instead
    out_file: '/dev/null',    // Use Docker logging instead
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // Health monitoring
    min_uptime: '10s',
    max_restarts: 10,
    autorestart: true,
    
    // Cluster settings
    instance_var: 'INSTANCE_ID'
  }]
};
