const instances = parseInt(process.env.PM2_INSTANCES, 10) || 1;

module.exports = {
	apps: [
		{
			name: 'hestami-ai-os',
			script: './build/index.js',
			instances: instances,
			// Use fork mode for single instance to avoid duplicate logs
			exec_mode: instances === 1 ? 'fork' : 'cluster',
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
			// Logging - disable PM2 log files to prevent duplicate output
			// The app writes directly to stdout/stderr which Docker captures
			log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
			error_file: '/dev/null',
			out_file: '/dev/null',
			combine_logs: true,
			// Auto-restart on memory threshold
			max_memory_restart: '500M'
		}
	]
};
