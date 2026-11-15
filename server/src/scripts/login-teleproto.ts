import dotenv from 'dotenv';
import { TelegramClient } from 'teleproto';
import { StringSession } from 'teleproto/sessions';
import { createInterface } from 'node:readline/promises';
dotenv.config();
const rl = createInterface({ input: process.stdin, output: process.stdout });

async function main() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH!;
  const session = new StringSession(''); // Empty string indicates first login

  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: () =>
      rl.question('Phone number (with country code, e.g., +8613800138000): '),
    phoneCode: () => rl.question('Verification code: '),
    password: () => rl.question('Two-factor password (press Enter if none): '),
    onError: (err) => console.error('Login error:', err),
  });

  console.log('\nLogin successful! Session string (save it):\n');
  console.log(client.session.save());
  console.log('\n');

  await client.disconnect();
  rl.close();
}

main();
