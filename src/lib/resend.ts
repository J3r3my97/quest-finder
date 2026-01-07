import { Resend } from 'resend';

let resendInstance: Resend | null = null;

export function getResend(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set');
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

// Lazy proxy for backwards compatibility
export const resend = new Proxy({} as Resend, {
  get(_, prop) {
    return Reflect.get(getResend(), prop);
  },
});
