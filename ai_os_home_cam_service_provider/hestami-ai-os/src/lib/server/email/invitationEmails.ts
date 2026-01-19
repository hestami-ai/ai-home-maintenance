/**
 * Phase 38: Invitation Email Templates and Sending
 *
 * Email templates for organization invitations.
 * Currently provides template generation - actual sending requires
 * integration with an email service (SendGrid, AWS SES, etc.)
 */

import { createModuleLogger } from '../logger.js';

const log = createModuleLogger('InvitationEmails');

// =============================================================================
// Email Template Types
// =============================================================================

export interface InvitationEmailData {
	recipientEmail: string;
	recipientName?: string;
	organizationName: string;
	organizationType: string;
	inviterName: string;
	role: string;
	activationCode: string;
	expiresAt: Date;
	joinUrl: string;
}

export interface EmailTemplate {
	subject: string;
	textBody: string;
	htmlBody: string;
}

// =============================================================================
// Email Templates
// =============================================================================

export function generateInvitationEmail(data: InvitationEmailData): EmailTemplate {
	const expiresFormatted = data.expiresAt.toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});

	const subject = `You've been invited to join ${data.organizationName} on Hestami AI`;

	const textBody = `
Hello${data.recipientName ? ` ${data.recipientName}` : ''},

${data.inviterName} has invited you to join ${data.organizationName} as a ${data.role}.

To accept this invitation:
1. Go to ${data.joinUrl}
2. Sign in or create an account with this email address
3. Enter your activation code: ${data.activationCode}

Your activation code expires on ${expiresFormatted}.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
The Hestami AI Team
`.trim();

	const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to ${data.organizationName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px;">Hello${data.recipientName ? ` <strong>${data.recipientName}</strong>` : ''},</p>
    
    <p style="font-size: 16px;">
      <strong>${data.inviterName}</strong> has invited you to join 
      <strong>${data.organizationName}</strong> as a <strong>${data.role}</strong>.
    </p>
    
    <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Your Activation Code</p>
      <p style="margin: 0; font-size: 32px; font-family: monospace; font-weight: bold; letter-spacing: 4px; color: #1f2937;">
        ${data.activationCode}
      </p>
    </div>
    
    <div style="text-align: center; margin: 24px 0;">
      <a href="${data.joinUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Accept Invitation
      </a>
    </div>
    
    <p style="font-size: 14px; color: #6b7280;">
      <strong>How to join:</strong>
    </p>
    <ol style="font-size: 14px; color: #6b7280; padding-left: 20px;">
      <li>Click the button above or go to <a href="${data.joinUrl}" style="color: #667eea;">${data.joinUrl}</a></li>
      <li>Sign in or create an account with this email address</li>
      <li>Enter your activation code when prompted</li>
    </ol>
    
    <p style="font-size: 13px; color: #9ca3af; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      This invitation expires on <strong>${expiresFormatted}</strong>.<br>
      If you didn't expect this invitation, you can safely ignore this email.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Hestami AI. All rights reserved.</p>
  </div>
</body>
</html>
`.trim();

	return { subject, textBody, htmlBody };
}

export function generateJoinRequestNotificationEmail(data: {
	adminEmail: string;
	adminName?: string;
	organizationName: string;
	requesterEmail: string;
	requesterName?: string;
	requestedRole: string;
	reviewUrl: string;
}): EmailTemplate {
	const subject = `New join request for ${data.organizationName}`;

	const textBody = `
Hello${data.adminName ? ` ${data.adminName}` : ''},

${data.requesterName || data.requesterEmail} has requested to join ${data.organizationName} as a ${data.requestedRole}.

To review this request, visit: ${data.reviewUrl}

Best regards,
The Hestami AI Team
`.trim();

	const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Join Request</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f59e0b; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">New Join Request</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px;">Hello${data.adminName ? ` <strong>${data.adminName}</strong>` : ''},</p>
    
    <p style="font-size: 16px;">
      <strong>${data.requesterName || data.requesterEmail}</strong> has requested to join 
      <strong>${data.organizationName}</strong> as a <strong>${data.requestedRole}</strong>.
    </p>
    
    <div style="text-align: center; margin: 24px 0;">
      <a href="${data.reviewUrl}" style="display: inline-block; background: #f59e0b; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Review Request
      </a>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Hestami AI. All rights reserved.</p>
  </div>
</body>
</html>
`.trim();

	return { subject, textBody, htmlBody };
}

// =============================================================================
// Email Sending (Placeholder - integrate with actual email service)
// =============================================================================

export function sendInvitationEmail(data: InvitationEmailData): boolean {
	const template = generateInvitationEmail(data);

	log.info('Invitation email generated', {
		to: data.recipientEmail,
		organization: data.organizationName,
		subject: template.subject
	});

	// TODO: Integrate with email service (SendGrid, AWS SES, Resend, etc.)
	// Example with SendGrid:
	// await sgMail.send({
	//   to: data.recipientEmail,
	//   from: 'noreply@hestami.ai',
	//   subject: template.subject,
	//   text: template.textBody,
	//   html: template.htmlBody
	// });

	// For now, log the email content in development
	if (process.env.NODE_ENV === 'development') {
		log.debug('Email content (dev mode)', {
			to: data.recipientEmail,
			subject: template.subject,
			activationCode: data.activationCode
		});
	}

	return true;
}

export function sendJoinRequestNotification(data: {
	adminEmail: string;
	adminName?: string;
	organizationName: string;
	requesterEmail: string;
	requesterName?: string;
	requestedRole: string;
	reviewUrl: string;
}): boolean {
	generateJoinRequestNotificationEmail(data);

	log.info('Join request notification email generated', {
		to: data.adminEmail,
		organization: data.organizationName,
		requester: data.requesterEmail
	});

	// TODO: Integrate with email service

	return true;
}
