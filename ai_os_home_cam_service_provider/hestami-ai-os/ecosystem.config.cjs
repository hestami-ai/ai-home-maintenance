module.exports = {
	apps: [
		{
			name: 'hestami-ai-os',
			script: './build/index.js',
			instances: 'max',
			exec_mode: 'cluster',
			// Preload OpenTelemetry before app starts
			node_args: '--require ./telemetry.cjs',
			// Environment variables - evaluated at PM2 runtime
			env: {
				NODE_ENV: 'production',
				PORT: 3000,
				// These are evaluated when PM2 loads this config at runtime
				...process.env
			},
			// Graceful shutdown
			kill_timeout: 5000,
			wait_ready: true,
			listen_timeout: 10000,
			// Logging
			log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
			error_file: '/dev/stderr',
			out_file: '/dev/stdout',
			merge_logs: true,
			// Auto-restart on memory threshold
			max_memory_restart: '500M'
		}
	]
};
