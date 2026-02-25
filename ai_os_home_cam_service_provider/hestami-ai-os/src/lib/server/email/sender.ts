/**
 * Email Sender Service
 *
 * Provides email sending capabilities using Zoho Mail SMTP.
 * Supports transactional emails like invitations, notifications, etc.
 *
 * Environment Variables Required:
 * - SMTP_HOST: SMTP server host (default: smtp.zoho.com)
 * - SMTP_PORT: SMTP server port (default: 465 for SSL)
 * - SMTP_USER: Zoho email address (e.g., noreply@yourdomain.com)
 * - SMTP_PASS: Zoho app password (generate at accounts.zoho.com -> Security -> App Passwords)
 * - SMTP_FROM_NAME: Display name for sender (default: Hestami AI)
 * - SMTP_FROM_EMAIL: From email address (uses SMTP_USER if not set)
 */

import nodemailer from 'nodemailer';
import type { Transporter, SentMessageInfo } from 'nodemailer';
import { createModuleLogger } from '../logger.js';

const log = createModuleLogger('EmailSender');

// =============================================================================
// Configuration
// =============================================================================

interface SmtpConfig {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	pass: string;
	fromName: string;
	fromEmail: string;
}

function getSmtpConfig(): SmtpConfig {
	const host = process.env.SMTP_HOST || 'smtp.zoho.com';
	const port = parseInt(process.env.SMTP_PORT || '465', 10);
	const secure = port === 465; // SSL on 465, TLS on 587
	const user = process.env.SMTP_USER || '';
	const pass = process.env.SMTP_PASS || '';
	const fromName = process.env.SMTP_FROM_NAME || 'Hestami AI';
	const fromEmail = process.env.SMTP_FROM_EMAIL || user;

	return { host, port, secure, user, pass, fromName, fromEmail };
}

function isEmailConfigured(): boolean {
	const config = getSmtpConfig();
	return !!(config.user && config.pass);
}

// =============================================================================
// Transporter
// =============================================================================

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
	if (!isEmailConfigured()) {
		log.warn('Email not configured - SMTP_USER and SMTP_PASS environment variables required');
		return null;
	}

	if (!transporter) {
		const config = getSmtpConfig();

		transporter = nodemailer.createTransport({
			host: config.host,
			port: config.port,
			secure: config.secure,
			auth: {
				user: config.user,
				pass: config.pass
			},
			// Connection pool for better performance
			pool: true,
			maxConnections: 5,
			maxMessages: 100,
			// Timeouts
			connectionTimeout: 10000,
			greetingTimeout: 10000,
			socketTimeout: 30000
		});

		log.info('Email transporter initialized', {
			host: config.host,
			port: config.port,
			secure: config.secure,
			user: config.user.substring(0, 3) + '***'
		});
	}

	return transporter;
}

// =============================================================================
// Email Types
// =============================================================================

export interface EmailMessage {
	to: string | string[];
	subject: string;
	text: string;
	html?: string;
	replyTo?: string;
	cc?: string | string[];
	bcc?: string | string[];
	attachments?: Array<{
		filename: string;
		content: Buffer | string;
		contentType?: string;
	}>;
}

export interface EmailResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

// =============================================================================
// Email Sending
// =============================================================================

/**
 * Send an email using the configured SMTP service
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
	const transport = getTransporter();

	if (!transport) {
		// In development or when not configured, log the email instead
		log.info('Email would be sent (not configured)', {
			to: message.to,
			subject: message.subject
		});

		if (process.env.NODE_ENV === 'development') {
			log.debug('Email content (dev mode)', {
				to: message.to,
				subject: message.subject,
				textPreview: message.text.substring(0, 200)
			});
		}

		return {
			success: true,
			messageId: `dev-${Date.now()}`
		};
	}

	const config = getSmtpConfig();

	try {
		const info: SentMessageInfo = await transport.sendMail({
			from: `"${config.fromName}" <${config.fromEmail}>`,
			to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
			cc: message.cc ? (Array.isArray(message.cc) ? message.cc.join(', ') : message.cc) : undefined,
			bcc: message.bcc ? (Array.isArray(message.bcc) ? message.bcc.join(', ') : message.bcc) : undefined,
			replyTo: message.replyTo,
			subject: message.subject,
			text: message.text,
			html: message.html,
			attachments: message.attachments
		});

		log.info('Email sent successfully', {
			messageId: info.messageId,
			to: message.to,
			subject: message.subject
		});

		return {
			success: true,
			messageId: info.messageId
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		log.error('Failed to send email', {
			error: errorMessage,
			to: message.to,
			subject: message.subject
		});

		return {
			success: false,
			error: errorMessage
		};
	}
}

/**
 * Verify SMTP connection is working
 */
export async function verifyEmailConnection(): Promise<boolean> {
	const transport = getTransporter();

	if (!transport) {
		log.warn('Cannot verify email - not configured');
		return false;
	}

	try {
		await transport.verify();
		log.info('Email connection verified successfully');
		return true;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		log.error('Email connection verification failed', { error: errorMessage });
		return false;
	}
}

/**
 * Close the email transporter connection pool
 */
export function closeEmailConnection(): void {
	if (transporter) {
		transporter.close();
		transporter = null;
		log.info('Email transporter closed');
	}
}

// =============================================================================
// Staff Invitation Email
// =============================================================================

export interface StaffInvitationEmailData {
	recipientEmail: string;
	recipientName?: string;
	staffDisplayName: string;
	activationCode: string;
	expiresAt: Date;
	inviterName: string;
	roles: string[];
	pillars: string[];
}

/**
 * Send a staff invitation email
 */
export async function sendStaffInvitationEmail(data: StaffInvitationEmailData): Promise<EmailResult> {
	const expiresFormatted = data.expiresAt.toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});

	const baseUrl = process.env.PUBLIC_BASE_URL || 'https://app.hestami.ai';
	const activationUrl = `${baseUrl}/staff/activate`;

	const rolesText = data.roles.join(', ');
	const pillarsText = data.pillars.join(', ');

	const subject = `You've been invited to join Hestami AI as Staff`;

	const textBody = `
Hello${data.recipientName ? ` ${data.recipientName}` : ''},

${data.inviterName} has invited you to join the Hestami AI platform as a staff member.

Your Role(s): ${rolesText}
Your Pillar Access: ${pillarsText}

To activate your account:
1. Go to ${activationUrl}
2. Sign in with this email address (${data.recipientEmail})
3. Enter your activation code: ${data.activationCode}

Your activation code expires on ${expiresFormatted}.

If you didn't expect this invitation, please contact your administrator.

Best regards,
The Hestami AI Team
`.trim();

	const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Staff Invitation - Hestami AI</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Hestami AI</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Staff Portal Invitation</p>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px;">Hello${data.recipientName ? ` <strong>${data.recipientName}</strong>` : ''},</p>

    <p style="font-size: 16px;">
      <strong>${data.inviterName}</strong> has invited you to join the Hestami AI platform as a staff member.
    </p>

    <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Your Role(s):</strong> ${rolesText}</p>
      <p style="margin: 0; font-size: 14px;"><strong>Pillar Access:</strong> ${pillarsText}</p>
    </div>

    <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Your Activation Code</p>
      <p style="margin: 0; font-size: 32px; font-family: monospace; font-weight: bold; letter-spacing: 4px; color: #1f2937;">
        ${data.activationCode}
      </p>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${activationUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Activate Your Account
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280;">
      <strong>How to activate:</strong>
    </p>
    <ol style="font-size: 14px; color: #6b7280; padding-left: 20px;">
      <li>Click the button above or go to <a href="${activationUrl}" style="color: #667eea;">${activationUrl}</a></li>
      <li>Sign in with this email address (<strong>${data.recipientEmail}</strong>)</li>
      <li>Enter your activation code when prompted</li>
    </ol>

    <p style="font-size: 13px; color: #9ca3af; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      This invitation expires on <strong>${expiresFormatted}</strong>.<br>
      If you didn't expect this invitation, please contact your administrator.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Hestami AI. All rights reserved.</p>
  </div>
</body>
</html>
`.trim();

	return sendEmail({
		to: data.recipientEmail,
		subject,
		text: textBody,
		html: htmlBody
	});
}
