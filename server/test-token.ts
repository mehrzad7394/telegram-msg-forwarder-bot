import { Telegraf } from 'telegraf';
import { config } from 'dotenv';

// Load environment variables
config();

async function testToken() {
  const token = process.env.BOT_TOKEN;

  if (!token) {
    console.error('❌ No TELEGRAM_BOT_TOKEN found in environment');
    return;
  }

  console.log(`🔑 Token found (length: ${token.length})`);
  console.log(
    `🔑 First/last 10 chars: ${token.substring(0, 10)}...${token.substring(token.length - 10)}`,
  );

  try {
    // Test 1: Create bot instance
    console.log('🧪 Creating Telegraf instance...');
    const bot = new Telegraf(token);

    // Test 2: Get bot info
    console.log('🧪 Testing API connection...');
    const me = await bot.telegram.getMe();
    console.log('✅ Bot info:', me);

    // Test 3: Try to launch and immediately stop
    console.log('🧪 Testing bot launch...');
    await bot.launch({
      dropPendingUpdates: true,
    });
    console.log('✅ Bot launched successfully');

    // Wait 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Stop bot
    await bot.stop();
    console.log('✅ Bot stopped successfully');

    console.log('\n🎉 Token is VALID!');
  } catch (error: any) {
    console.error('❌ Token test failed:', error.message);
    console.error('Error details:', error.response || 'No response details');
  }
}

testToken();
