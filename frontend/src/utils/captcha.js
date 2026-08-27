// Security-code generation for the login CAPTCHA.
//
// NOTE: this is a client-side challenge only. It stops casual form-replay and
// accidental repeat submissions, but it is not bot protection - anything
// running in the browser can read the expected code. Real protection needs the
// code issued and verified server-side (see the login flow notes).

// Ambiguous glyphs are excluded so the code is never a guess between
// O/0, I/1/l, S/5 or Z/2 when it is drawn distorted.
const CAPTCHA_ALPHABET = "ABCDEFGHJKMNPQRTUVWXY34679";


export const CAPTCHA_LENGTH = 5;


export function generateCaptchaCode(length = CAPTCHA_LENGTH) {

    const values = new Uint32Array(length);

    crypto.getRandomValues(values);

    let code = "";

    for (let index = 0; index < length; index += 1) {
        code += CAPTCHA_ALPHABET[values[index] % CAPTCHA_ALPHABET.length];
    }

    return code;

}


// Users should not be punished for case or stray spaces.
export function normalizeCaptcha(value) {

    return String(value || "")
        .replace(/\s+/g, "")
        .toUpperCase();

}
