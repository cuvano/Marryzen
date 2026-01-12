/**
 * reCAPTCHA v3 Utility
 * 
 * reCAPTCHA v3 runs in the background and returns a score (0.0 to 1.0)
 * Score >= 0.5 is typically considered human, < 0.5 is likely a bot
 */

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

/**
 * Load reCAPTCHA v3 script dynamically
 */
export const loadRecaptcha = () => {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha && window.grecaptcha.ready) {
      window.grecaptcha.ready(() => resolve());
      return;
    }

    if (!RECAPTCHA_SITE_KEY) {
      console.warn('reCAPTCHA site key not configured. CAPTCHA will be skipped.');
      resolve(); // Allow app to continue without CAPTCHA in dev
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      if (window.grecaptcha && window.grecaptcha.ready) {
        window.grecaptcha.ready(() => resolve());
      } else {
        resolve();
      }
    };
    
    script.onerror = () => {
      console.error('Failed to load reCAPTCHA script');
      reject(new Error('Failed to load reCAPTCHA'));
    };
    
    document.head.appendChild(script);
  });
};

/**
 * Execute reCAPTCHA v3 and get a token
 * @param {string} action - Action name (e.g., 'signup', 'login')
 * @returns {Promise<string>} - reCAPTCHA token
 */
export const executeRecaptcha = async (action = 'submit') => {
  if (!RECAPTCHA_SITE_KEY) {
    console.warn('reCAPTCHA not configured, returning empty token');
    return '';
  }

  try {
    await loadRecaptcha();
    
    if (!window.grecaptcha) {
      throw new Error('reCAPTCHA not loaded');
    }

    const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
    return token;
  } catch (error) {
    console.error('reCAPTCHA execution error:', error);
    // Return empty token in case of error - let server handle validation
    return '';
  }
};

/**
 * Verify reCAPTCHA token on the server side
 * This should be called from your backend/Edge Function
 * @param {string} token - reCAPTCHA token
 * @param {string} secretKey - reCAPTCHA secret key (server-side only)
 * @returns {Promise<{success: boolean, score: number}>}
 */
export const verifyRecaptchaToken = async (token, secretKey) => {
  if (!token) {
    return { success: false, score: 0 };
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data = await response.json();
    
    return {
      success: data.success,
      score: data.score || 0,
      action: data.action,
      challenge_ts: data.challenge_ts,
      hostname: data.hostname,
    };
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return { success: false, score: 0 };
  }
};
