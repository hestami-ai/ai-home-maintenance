/**
 * JSON Logger for stdout
 * 
 * ADR-003: Audit log retention - all logs retained
 * TECH-LOGS-JSON-STD: Structured JSON logs to stdout
 */

import os from 'os';

/**
 * Logger class for structured JSON output
 */
class JSONLogger {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'abuse-notification';
    this.level = options.level || 'info';
    this.prefix = options.prefix || '';
    this.timestamps = options.timestamps !== false;
  }
  
  /**
   * Log helper - always formats as JSON
   */
  log(level, data) {
    const timestamp = this.timestamps ? new Date().toISOString() : undefined;
    const logEntry = {
      timestamp,
      severity: level,
      service: this.serviceName,
      message: data.message || '',
      ...(data.metadata || {})
    };
    
    const output = JSON.stringify(logEntry);
    
    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
      case 'info':
      case 'debug':
        console.log(output);
        break;
      default:
        console.log(output);
    }
  }
  
  /**
   * Error level logging
   */
  error(data, metadata = {}) {
    const { message, ...otherData } = data;
    this.log('error', { message, ...otherData, ...metadata });
  }
  
  /**
   * Warning level logging
   */
  warn(data, metadata = {}) {
    const { message, ...otherData } = data;
    this.log('warn', { message, ...otherData, ...metadata });
  }
  
  /**
   * Info level logging
   */
  info(data, metadata = {}) {
    const { message, ...otherData } = data;
    this.log('info', { message, ...otherData, ...metadata });
  }
  
  /**
   * Debug level logging
   */
  debug(data, metadata = {}) {
    const { message, ...otherData } = data;
    this.log('debug', { message, ...otherData, ...metadata });
  }
  
  /**
   * Structured error logging
   */
  logError(error) {
    this.error({
      error: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      host: os.hostname()
    });
  }
}

// Singleton instance
const logger = new JSONLogger();

export default logger;
