const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// Wallet addresses
const WALLETS = {
  'TRC-20': process.env.WALLET_TRC20 || 'YOUR_TRC20_WALLET',
  'ERC-20': process.env.WALLET_ERC20 || 'YOUR_ERC20_WALLET',
  'BEP-20': process.env.WALLET_BEP20 || 'YOUR_BEP20_WALLET',
};

const SPREAD = 0.03; // 3% spread

// Get USDT rate from Binance (realtime)
async function getRate() {
  try {
    const res = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=USDTTHB');
    const mktRate = parseFloat(res.data.price);
    const ourRate = mktRate * (1 - SPREAD);
    return { mktRate, ourRate };
  } catch {
    // Fallback rate if API fails
    return { mktRate: 33, ourRate: 33 * (1 - SPREAD) };
  }
}

// Webhook endpoint
app.post('/webhook', line.middleware(config), async (req, res) => {
  res.json({ status: 'ok' });
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.text) {
      const text = event.message.text.toLowerCase();
      if (text.includes('ชำระ') || text.includes('จ่าย') || text.includes('pay')) {
        await sendPaymentButton(event.replyToken);
      }
    } else if (event.type === 'postback') {
      const data = new URLSearchParams(event.postback.data);
      const action = data.get('action');
      if (action === 'select_amount') {
        const thb = parseInt(data.get('thb'));
        await sendQRCode(event.replyToken, thb, event.source.userId);
      }
    }
  }
});

// Send payment amount selection
async function sendPaymentButton(replyToken) {
  const { ourRate } = await getRate();
  const presets = [100, 200, 500, 1000, 2000, 5000];

  const message = {
    type: 'flex',
    altText: 'เลือกจำนวนเงินที่ต้องการชำระ',
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#06C755',
        contents: [{
          type: 'text', text: 'ชำระเงิน USDT',
          color: '#ffffff', size: 'xl', weight: 'bold'
        }, {
          type: 'text',
          text: `1 USDT = ${ourRate.toFixed(2)} THB (รวม spread 3%)`,
          color: '#ddffdd', size: 'xs'
        }]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'text', text: 'เลือกจำนวนเงิน (บาท)', weight: 'bold', size: 'sm' },
          {
            type: 'box', layout: 'vertical', spacing: 'xs',
            contents: presets.map(thb => ({
              type: 'button',
              action: {
                type: 'postback',
                label: `${thb.toLocaleString()} ฿  ≈ ${(thb / ourRate).toFixed(4)} USDT`,
                data: `action=select_amount&thb=${thb}`
              },
              style: 'secondary', height: 'sm'
            }))
          }
        ]
      }
    }
  };
  await client.replyMessage(replyToken, message);
}

// Send QR Code page
async function sendQRCode(replyToken, thb, userId) {
  const { ourRate } = await getRate();
  const usdt = (thb / ourRate).toFixed(4);
  const addr = WALLETS['TRC-20'];

  const message = {
    type: 'flex',
    altText: `ชำระ ${usdt} USDT`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'text', text: 'สแกน QR ชำระเงิน', weight: 'bold', size: 'lg' },
          { type: 'text', text: `${usdt} USDT`, size: 'xxl', weight: 'bold', color: '#06C755' },
          { type: 'text', text: `≈ ${thb.toLocaleString()} THB`, size: 'sm', color: '#888888' },
          { type: 'separator' },
          { type: 'text', text: 'Network: TRC-20 (TRON)', size: 'sm', weight: 'bold' },
          { type: 'text', text: addr, size: 'xxs', color: '#555555', wrap: true },
          { type: 'separator' },
          { type: 'text', text: '⚠ โอนเฉพาะ TRC-20 เท่านั้น', size: 'xs', color: '#ff5555', wrap: true },
          { type: 'text', text: 'ระบบจะแจ้งเตือนอัตโนมัติเมื่อได้รับเงิน', size: 'xs', color: '#888888' }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{
          type: 'button',
          action: { type: 'clipboard', label: 'คัดลอก Address', clipboardText: addr },
          style: 'primary', color: '#06C755'
        }]
      }
    }
  };
  await client.replyMessage(replyToken, message);
}

// Health check
app.get('/', (req, res) => res.json({ status: 'USDT Payment Server running' }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
