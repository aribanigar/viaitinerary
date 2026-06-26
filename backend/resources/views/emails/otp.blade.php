<!DOCTYPE html>
<html>

<head>
    <title>OTP Verification</title>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>

<body style="margin: 0; padding: 0; background-color: #f6f4f1; color: #1f2933;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="background-color: #f6f4f1; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                    style="max-width: 560px; background-color: #ffffff; border-radius: 14px; box-shadow: 0 12px 30px rgba(17, 24, 39, 0.12);">
                    <tr>
                        <td
                            style="padding: 28px 32px 8px; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
                            <p
                                style="margin: 0; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #7b8794;">
                                Email Verification</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 32px 16px; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
                            <h1 style="margin: 0; font-size: 24px; line-height: 1.3; color: #102a43;">Your one-time code
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 32px 20px; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
                            <p style="margin: 0; font-size: 14px; color: #52606d;">Use this code to finish verifying
                                your email address.</p>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 8px 32px 24px;">
                            <div
                                style="display: inline-block; padding: 14px 26px; border-radius: 12px; background: #111827; color: #ffffff; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 24px; letter-spacing: 6px; font-weight: 700;">
                                {{ $otp }}</div>
                            <p
                                style="margin: 12px 0 0; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #7b8794;">
                                Expires in 10 minutes.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 32px 20px; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
                            <div style="border-top: 1px solid #e4e7eb; height: 1px; line-height: 1px;"></div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 32px 28px; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
                            <p style="margin: 0; font-size: 13px; color: #52606d;">If you did not request this, you can
                                safely ignore this email.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

</html>
