
import { encrypt, generateActivationCode } from '../src/lib/server/security/encryption.ts';

try {
    const code = generateActivationCode();
    console.log('Code:', code);
    const encrypted = encrypt(code);
    console.log('Encrypted:', encrypted);
    console.log('Success');
} catch (e) {
    console.error(e);
}
