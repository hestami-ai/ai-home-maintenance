/**
 * Email Service for Abuse Notification
 * 
 * Responsibilities:
 * - Read SMTP configuration
 * - Format abuse notification email
 * - Queue email send operations with timing constraints
 */

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// ADR-004: Email latency - must send within 2 minutes
const EMAIL_MAX_LATENCY_MS = 2 * 60 * 1000;

/**
 * Reads and validates SMTP configuration
 */
function readSMTPConfig(configPath = './config/smtp.json') {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);
    
    // Validate required fields
    if (!config.host || !config.port || !config.auth) {
      throw new Error('Invalid SMTP configuration: missing required fields');
    }
    
    return config;
  } catch (error) {
    logger.error(`Failed to read SMTP config: ${error.message}`);
    throw error;
  }
}

/**
 * Formats abuse notification email
 */
function formatAbuseNotificationEmail({ adminEmail, incident, flags }) {
  const { id, severity, createdAt } = incident;
  
  const subject = `Abuse Flag Notification: Incident #${id}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Abuse Flag Notification</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: #e74c3c; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .flag { border-left: 4px solid #e74c3c; padding-left: 10px; margin: 10px 0; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Abuse Flag Notification</h1>
        </div>
        <div class="content">
          <p><strong>Incident ID:</strong> ${id}</p>
          <p><strong>Severity:</strong> ${severity.toUpperCase()}</p>
          <p><strong>Reported At:</strong> ${formattedDateTime(createdAt)}</p>
          <p><strong>Total Flags:</strong> ${flags.length}</p>
          <p>The following abuse flags have been detected:</p>
          
          ${flags.map(flag => `
            <div class="flag">
              <strong>Flag Details:</strong><br>
              URL: ${flag.url}<br>
              Source IP: ${flag.sourceIp}<br>
              User Agent: ${flag.userAgent.substring(0, 50)}${flag.userAgent.length > 50 ? '...' : ''}<br>
              Timestamp: ${formattedDateTime(flag.timestamp)}
            </div>
          `).join('')}
          
          <p style="margin-top: 20px;">
            Please investigate these flags and take appropriate action.
          </p>
        </div>
        <div class="footer">
          <p>Abuse Notification Service</p>
          <p>This is an automated notification.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
Abuse Flag Notification - Incident #${id}
===========================================

Severity: ${severity.toUpperCase()}
Reported At: ${formattedDateTime(createdAt)}
Total Flags: ${flags.length}

Incident Details:
-----------------
${flags.map(flag => `
URL: ${flag.url}
Source IP: ${flag.sourceIp}
User Agent: ${flag.userAgent.substring(0, 50)}${flag.userAgent.length > 50 ? '...' : ''}
Timestamp: ${formattedDateTime(flag.timestamp)}
`.trim()).join('\n\n')}

Please investigate these flags and take appropriate action.
  `.trim();
  
  return {
    recipient: adminEmail,
    sender: config.from,
    subject,
    html,
    text
  };
}

/**
 * Formats datetime for display
 */
function formattedDateTime(dateString) {
  const date = new Date(dateString);
  return date.toISOString();
}

/**
 * Creates email transporter
 */
function createTransporter(config) {
  return nodemailer.createTransporter({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass
    }
  });
}

/**
 * Queues an email send operation with timing constraint
 * ADR-004: Must send within 2 minutes of abuse flag
 */
async function queueEmailSend({
  incidentId,
  adminEmail,
  flags,
  severity,
  createdAt
}) {
  const startTime = Date.now();
  const config = readSMTPConfig();
  const transporter = createTransporter(config);
  
  const email = formatAbuseNotificationEmail({
    adminEmail,
    incident: { id: incidentId, severity, flags, createdAt }
  });
  
  logger.info({
    event: 'email_queued',
    incidentId,
    adminEmail: email.recipient.substring(0, 10) + '***',
    subject: email.subject.substring(0, 50),
    queueAt: new Date().toISOString(),
    maxLatencyMs: EMAIL_MAX_LATENCY_MS
  });
  
  let sent = false;
  let errorMessage = null;
  
  try {
    const info = await transporter.sendMail({
      from: email.sender,
      to: email.recipient,
      subject: email.subject,
      html: email.html,
      text: email.text
    });
    
    sent = true;
    const elapsedMs = Date.now() - startTime;
    
    logger.info({
      event: 'email_sent',
      messageId: info.messageId,
      incidentId,
      adminEmail: email.recipient,
      subject: email.subject,
      sentAt: new Date().toISOString(),
      latencyMs: elapsedMs,
      withinConstraint: elapsedMs <= EMAIL_MAX_LATENCY_MS
    });
    
    // Verify timing constraint was met
    if (elapsedMs > EMAIL_MAX_LATENCY_MS) {
      logger.warn({
        event: 'email_latency_warning',
        incidentId,
        elapsedMs,
        thresholdMs: EMAIL_MAX_LATENCY_MS
      });
    }
    
    return {
      success: true,
      messageId: info.messageId,
      sentAt: new Date().toISOString(),
      latencyMs: elapsedMs,
      withinConstraint: elapsedMs <= EMAIL_MAX_LATENCY_MS
    };
  } catch (error) {
    sent = false;
    errorMessage = error.message;
    logger.error({
      event: 'email_send_failed',
      incidentId,
      error: error.message,
      adminEmail: email.recipient
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Abuse flag incident object
 */
class Incident {
  constructor(id, severity, createdAt, flags) {
    this.id = id;
    this.severity = severity;
    this.createdAt = createdAt;
    this.flags = flags;
  }
}

export {
  readSMTPConfig,
  formatAbuseNotificationEmail,
  createTransporter,
  queueEmailSend,
  Incident,
  EMAIL_MAX_LATENCY_MS
};
