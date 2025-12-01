/**
 * Email service for MSFHH Research App
 * Uses Resend for sending custom emails
 */

import { Resend } from 'resend';

// Lazy-initialize Resend client to avoid build-time errors
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'MSFHH Research <noreply@resend.dev>';
const APP_NAME = 'MSFHH Research App';

interface SendInviteEmailParams {
  to: string;
  inviteUrl: string;
  role: 'admin' | 'pi' | 'coordinator';
  inviterName?: string;
  studyName?: string;
}

interface SendMagicLinkEmailParams {
  to: string;
  magicLinkUrl: string;
  isNewUser?: boolean;
  role?: string;
}

/**
 * Get role display name
 */
function getRoleDisplayName(role: string): string {
  switch (role) {
    case 'pi':
      return 'Principal Investigator (PI)';
    case 'admin':
      return 'Administrator';
    case 'coordinator':
      return 'Study Coordinator';
    default:
      return role;
  }
}

/**
 * Send invitation email to new user
 */
export async function sendInviteEmail({
  to,
  inviteUrl,
  role,
  inviterName,
  studyName,
}: SendInviteEmailParams): Promise<{ success: boolean; error?: string }> {
  const client = getResendClient();
  if (!client) {
    console.warn('RESEND_API_KEY not configured, skipping email');
    return { success: true }; // Silently skip if not configured
  }

  const roleDisplay = getRoleDisplayName(role);
  const studyInfo = studyName ? ` to the study "${studyName}"` : '';
  const inviterInfo = inviterName ? `${inviterName} has` : 'You have been';

  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `You're invited to join ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a56db; margin: 0;">Welcome to ${APP_NAME}</h1>
            <p style="color: #666; font-size: 14px; margin-top: 5px;">Clinical Trial Protocol Management</p>
          </div>

          <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <p style="margin: 0 0 16px 0;">
              ${inviterInfo} invited you to join <strong>${APP_NAME}</strong>${studyInfo} as a <strong>${roleDisplay}</strong>.
            </p>

            <p style="margin: 0 0 16px 0;">
              ${APP_NAME} helps clinical research teams extract and manage protocol information from study documents using AI-powered tools.
            </p>

            ${role === 'pi' ? `
            <p style="margin: 0 0 16px 0;">
              <strong>As a Principal Investigator, you can:</strong>
            </p>
            <ul style="margin: 0 0 16px 0; padding-left: 20px;">
              <li>Create and manage clinical studies</li>
              <li>Upload protocol documents for AI extraction</li>
              <li>Invite and manage team members</li>
              <li>Track patient enrollment</li>
            </ul>
            ` : role === 'coordinator' ? `
            <p style="margin: 0 0 16px 0;">
              <strong>As a Study Coordinator, you can:</strong>
            </p>
            <ul style="margin: 0 0 16px 0; padding-left: 20px;">
              <li>View assigned study details</li>
              <li>Access protocol information</li>
              <li>Add and track patients</li>
              <li>View team members</li>
            </ul>
            ` : `
            <p style="margin: 0 0 16px 0;">
              <strong>As an Administrator, you can:</strong>
            </p>
            <ul style="margin: 0 0 16px 0; padding-left: 20px;">
              <li>Manage all users and studies</li>
              <li>Send invitations to new users</li>
              <li>Access the admin dashboard</li>
              <li>Full system access</li>
            </ul>
            `}
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${inviteUrl}" style="display: inline-block; background: #1a56db; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Accept Invitation
            </a>
          </div>

          <p style="color: #666; font-size: 13px; text-align: center;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            ${APP_NAME} - Mount Sinai Fuster Heart Hospital Research<br>
            This is an automated message, please do not reply.
          </p>
        </body>
        </html>
      `,
      text: `
Welcome to ${APP_NAME}!

${inviterInfo} invited you to join ${APP_NAME}${studyInfo} as a ${roleDisplay}.

${APP_NAME} helps clinical research teams extract and manage protocol information from study documents using AI-powered tools.

To accept your invitation and create your account, visit:
${inviteUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

---
${APP_NAME} - Mount Sinai Fuster Heart Hospital Research
      `.trim(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to send invite email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send magic link login email
 * Note: This is handled by Supabase by default, but can be customized here
 */
export async function sendMagicLinkEmail({
  to,
  magicLinkUrl,
  isNewUser = false,
  role,
}: SendMagicLinkEmailParams): Promise<{ success: boolean; error?: string }> {
  const client = getResendClient();
  if (!client) {
    console.warn('RESEND_API_KEY not configured, skipping email');
    return { success: true };
  }

  const roleDisplay = role ? getRoleDisplayName(role) : '';
  const welcomeText = isNewUser
    ? `Welcome to ${APP_NAME}! Click the button below to complete your registration and access the platform.`
    : `Click the button below to securely sign in to ${APP_NAME}. This link will expire in 1 hour.`;

  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject: isNewUser ? `Complete your ${APP_NAME} registration` : `Sign in to ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a56db; margin: 0;">${APP_NAME}</h1>
            <p style="color: #666; font-size: 14px; margin-top: 5px;">Clinical Trial Protocol Management</p>
          </div>

          <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 16px 0; color: #1a56db;">
              ${isNewUser ? 'Complete Your Registration' : 'Sign In Request'}
            </h2>

            <p style="margin: 0 0 16px 0;">
              ${welcomeText}
            </p>

            ${isNewUser && roleDisplay ? `
            <p style="margin: 0 0 16px 0;">
              You've been registered as a <strong>${roleDisplay}</strong>.
            </p>
            ` : ''}

            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>What is this link?</strong><br>
              This is a secure, one-time-use link that logs you into ${APP_NAME} without needing a password.
              It's called a "magic link" because it securely authenticates you just by clicking it.
            </p>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${magicLinkUrl}" style="display: inline-block; background: #1a56db; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
              ${isNewUser ? 'Complete Registration' : 'Sign In to App'}
            </a>
          </div>

          <p style="color: #666; font-size: 13px; text-align: center;">
            If you didn't request this email, you can safely ignore it. Someone may have entered your email by mistake.
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            ${APP_NAME} - Mount Sinai Fuster Heart Hospital Research<br>
            This is an automated message, please do not reply.
          </p>
        </body>
        </html>
      `,
      text: `
${isNewUser ? 'Complete Your Registration' : 'Sign In to'} ${APP_NAME}

${welcomeText}

${isNewUser && roleDisplay ? `You've been registered as a ${roleDisplay}.\n` : ''}

Click here to ${isNewUser ? 'complete registration' : 'sign in'}:
${magicLinkUrl}

What is this link?
This is a secure, one-time-use link that logs you into ${APP_NAME} without needing a password. It's called a "magic link" because it securely authenticates you just by clicking it.

If you didn't request this email, you can safely ignore it.

---
${APP_NAME} - Mount Sinai Fuster Heart Hospital Research
      `.trim(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to send magic link email:', error);
    return { success: false, error: error.message };
  }
}
