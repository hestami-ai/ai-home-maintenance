/**
 * Failure Events Stream Listener
 * 
 * This module maintains a connection to the platform-fault-tolerance fault stream
 * and validates incoming event payloads before processing them.
 * 
 * @module stream-listener
 */

const EventEmitter = require('events');

class FailureEventsStreamListener extends EventEmitter {
  /**
   * Constructor for FailureEventsStreamListener
   * @param {Object} options - Configuration options
   * @param {string} options.streamUrl - URL of the fault event stream
   * @param {number} options.retryDelayMs - Delay between retry attempts in milliseconds
   * @param {number} options.maxRetries - Maximum number of retry attempts
   */
  constructor(options = {}) {
    super();
    this.streamUrl = options.streamUrl;
    this.retryDelayMs = options.retryDelayMs || 1000;
    this.maxRetries = options.maxRetries || 3;
    this.reconnectTimer = null;
    this.currentRetryCount = 0;
    this.stream = null;
    this.isActive = false;
  }

  /**
   * Initialize and connect to the fault event stream
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      // In production, this would connect to a WebSocket or streaming endpoint
      // For this implementation, we simulate a stream connection
      this.stream = new Promise((resolve, reject) => {
        // Simulate connection
        this.isActive = true;
        resolve(this);
        
        // Emit connection established event
        this.emit('connected');
        
        // Emit initial event
        this.emit('event', this.createMockFaultEvent());
      });

      this.reconnectTimer = setInterval(() => {
        this.reconnect();
      }, 5000); // Check for reconnection every 5 seconds
      
      return this.streamUrl;
    } catch (error) {
      this.emit('error', {
        message: 'Failed to connect to fault stream',
        error: error.message,
        streamUrl: this.streamUrl
      });
      throw error;
    }
  }

  /**
   * Reconnect to the fault stream
   * @returns {Promise<void>}
   */
  async reconnect() {
    if (!this.isActive) {
      return;
    }

    this.emit('disconnect', 'Attempting to reconnect...');

    try {
      this.stream = this.connect();
      await this.stream;
      this.currentRetryCount = 0;
      this.isActive = true;
      this.emit('connected');
    } catch (error) {
      this.emit('error', {
        message: 'Reconnection failed',
        retryCount: this.currentRetryCount,
        error: error.message
      });
      
      this.currentRetryCount++;
      
      if (this.currentRetryCount < this.maxRetries) {
        // Schedule next reconnection attempt
        setTimeout(async () => {
          await this.reconnect();
        }, this.retryDelayMs * this.currentRetryCount);
      }
    }
  }

  /**
   * Create and consume events from the fault stream
   * @returns {Promise<void>}
   */
  async consume() {
    const buffer = [];
    const bufferLimit = 100;
    let bufferIndex = 0;

    // Simulate event stream consumption
    while (this.isActive) {
      try {
        // Simulate waiting for events
        await this.processNextEvent();
        bufferIndex++;
        if (bufferIndex >= bufferLimit) {
          bufferIndex = 0;
        }
      } catch (error) {
        this.emit('error', {
          message: 'Event processing error',
          error: error.message
        });
      }
    }
  }

  /**
   * Process the next event from the stream
   * @returns {Promise<void>}
   */
  async processNextEvent() {
    // In production, this would read from WebSocket or Kafka
    // For simulation, we create mock events
    const faultEvent = this.createMockFaultEvent();
    
    try {
      await this.handleEvent(faultEvent);
    } catch (error) {
      this.emit('error', {
        message: 'Unhandled event error',
        event: faultEvent,
        error: error.message
      });
    }
  }

  /**
   * Handle a fault event
   * @param {Object} event - The fault event payload
   * @returns {Promise<Object>} Result of event handling
   */
  async handleEvent(event) {
    try {
      const result = this.validateEventAndProcess(event);
      
      if (result.success) {
        this.emit('valid_event', {
          event,
          timestamp: new Date().toISOString()
        });
      } else {
        this.emit('malformed_event', {
          event,
          reason: result.reason,
          timestamp: new Date().toISOString()
        });
      }
      
      return result;
    } catch (error) {
      this.emit('event_error', {
        event,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate event payload structure and process valid events
   * @param {Object} event - The fault event payload
   * @returns {Object} Validation result
   */
  validateEventAndProcess(event) {
    // Validate JSON structure
    if (!this.isValidEvent(event)) {
      return {
        success: false,
        reason: 'EVENT_STRUCTURE_INVALID',
        details: 'Event payload does not match expected fault event structure'
      };
    }

    // Check required fields
    const requiredFields = ['id', 'timestamp', 'fault_type', 'region', 'severity'];
    const missingFields = requiredFields.filter(field => !(field in event));
    
    if (missingFields.length > 0) {
      return {
        success: false,
        reason: 'MISSING_REQUIRED_FIELDS',
        details: `Missing required fields: ${missingFields.join(', ')}`
      };
    }

    // Validate field types
    if (!this.isValidFieldType(event.id, 'string')) {
      return {
        success: false,
        reason: 'INVALID_FIELD_TYPE',
        details: 'Field "id" must be a string'
      };
    }

    if (!this.isValidFieldType(event.timestamp, 'string')) {
      return {
        success: false,
        reason: 'INVALID_FIELD_TYPE',
        details: 'Field "timestamp" must be a string'
      };
    }

    if (!this.isValidFieldType(event.fault_type, 'string')) {
      return {
        success: false,
        reason: 'INVALID_FIELD_TYPE',
        details: 'Field "fault_type" must be a string'
      };
    }

    if (!this.isValidFieldType(event.region, 'string')) {
      return {
        success: false,
        reason: 'INVALID_FIELD_TYPE',
        details: 'Field "region" must be a string'
      };
    }

    if (!this.isValidFieldType(event.severity, 'string')) {
      return {
        success: false,
        reason: 'INVALID_FIELD_TYPE',
        details: 'Field "severity" must be a string'
      };
    }

    // Process valid event
    return this.processEvent(event);
  }

  /**
   * Process a validated event
   * @param {Object} event - The validated fault event
   * @returns {Object} Event processing result
   */
  processEvent(event) {
    return {
      success: true,
      eventId: event.id,
      region: event.region,
      faultType: event.fault_type,
      severity: event.severity,
      timestamp: event.timestamp,
      processedAt: new Date().toISOString()
    };
  }

  /**
   * Validate event structure
   * @param {any} event - Event to validate
   * @returns {boolean} True if event structure is valid
   */
  isValidEvent(event) {
    // Ensure event is an object
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      return false;
    }

    // Ensure object has required shape
    return event.hasOwnProperty('id') &&
           event.hasOwnProperty('timestamp') &&
           event.hasOwnProperty('fault_type') &&
           event.hasOwnProperty('region') &&
           event.hasOwnProperty('severity');
  }

  /**
   * Validate field type
   * @param {any} value - Value to validate
   * @param {string} expectedType - Expected type (string, number, boolean, object)
   * @returns {boolean} True if type is valid
   */
  isValidFieldType(value, expectedType) {
    if (expectedType === 'string') {
      return typeof value === 'string';
    }
    if (expectedType === 'number') {
      return typeof value === 'number' && !Number.isNaN(value);
    }
    if (expectedType === 'boolean') {
      return typeof value === 'boolean';
    }
    if (expectedType === 'object') {
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
    if (expectedType === 'array') {
      return Array.isArray(value);
    }
    return true;
  }

  /**
   * Create a mock fault event for testing
   * @returns {Object} Mock fault event
   */
  createMockFaultEvent() {
    return {
      id: `fault-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      fault_type: 'network_partition',
      region: 'us-east-1',
      severity: 'high',
      description: 'Simulated fault event'
    };
  }

  /**
   * Disconnect from the fault stream
   * @returns {void}
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isActive = false;
    this.emit('disconnected');
  }

  /**
   * Get the current state of the listener
   * @returns {Object} Current state
   */
  getState() {
    return {
      isActive: this.isActive,
      streamUrl: this.streamUrl,
      currentRetryCount: this.currentRetryCount,
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs
    };
  }
}

module.exports = FailureEventsStreamListener;
