const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

const WALLET_TRC20 = process.env.WALLET_TRC20 || 'YOUR_TRC20_WALLET';
const SPREAD = 0.03;

const waitingForAmount = {};

async function getRate() {
  try {
    const res = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=USDTTHB');
    const mktRate = parseFloat(res.data.price);
    const ourRate = mktRate * (1 - SPREAD);
    return { mktRate, ourRate };
  } catch (e) {
    return { mktRate: 33, ourRate: 33 * (1 - SPREAD) };
  }
}

async function sendPaymentButton(replyToken) {
  const { ourRate } = await getRate();
  const presets = [100, 200, 500, 1000, 2000, 5000];

  const buttons = presets.map(function(thb) {
    return {
      type: 'button',
      action: {
        type: 'postback',
        label: thb.toLocaleString() + ' THB = ' + (thb / ourRate).toFixed(2) + ' USDT',
        data: 'action=select_amount&thb=' + thb,
      },
      style: 'secondary',
      height: 'sm',
    };
  });

  const message = {
    type: 'flex',
    altText: 'Select payment amount',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#06C755',
        contents: [
          { type: 'text', text: 'USDT Payment', color: '#ffffff', size: 'xl', weight: 'bold' },
          { type: 'text', text: 'Rate: 1 USDT = ' + ourRate.toFixed(2) + ' THB', color: '#ddffdd', size: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: 'Select Amount (THB)', weight: 'bold', size: 'sm', color: '#555555' },
          { type: 'box', layout: 'vertical', spacing: 'xs', contents: buttons },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: 'Enter custom amount',
              data: 'action=custom_amount',
            },
            style: 'primary',
            color: '#111111',
            height: 'sm',
          },
        ],
      },
    },
  };

  await client.replyMessage(replyToken, message);
}

async function sendQRCode(replyToken, thb) {
  const { ourRate } = await getRate();
  const usdt = (thb / ourRate).toFixed(4);

  const message = {
    type: 'flex',
    altText: 'Pay ' + usdt + ' USDT',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#111111',
        contents: [
          { type: 'text', text: 'Scan to Pay', color: '#ffffff', size: 'lg', weight: 'bold' },
          { type: 'text', text: 'USDT Payment', color: '#888888', size: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: usdt + ' USDT', size: 'xxl', weight: 'bold', color: '#06C755', align: 'center' },
          { type: 'text', text: '= ' + thb.toLocaleString() + ' THB', size: 'sm', color: '#888888', align: 'center' },
          { type: 'separator' },
          { type: 'text', text: 'Network: TRC-20 (TRON)', size: 'sm', weight: 'bold' },
          { type: 'text', text: WALLET_TRC20, size: 'xxs', color: '#555555', wrap: true },
          { type: 'separator' },
          { type: 'text', text: 'TRC-20 only - wrong network = lost funds', size: 'xs', color: '#ff5555', wrap: true },
          { type: 'text', text: 'You will be notified when payment is received', size: 'xs', color: '#888888', wrap: true },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'clipboard', label: 'Copy Address', clipboardText: WALLET_TRC20 },
            style: 'primary',
            color: '#06C755',
          },
        ],
      },
    },
  };

  await client.replyMessage(replyToken, message);
}

app.post('/webhook', line.middleware(config), async function(req, res) {
  res.json({ status: 'ok' });
  const events = req.body.events;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    try {
      if (event.type === 'message' && event.message.text) {
        const userId = event.source.userId;
        const rawText = event.message.text.trim();
        const text = rawText.toLowerCase();

        if (waitingForAmount[userId]) {
          const amount = parseFloat(rawText.replace(/,/g, ''));
          if (!isNaN(amount) && amount >= 100) {
            delete waitingForAmount[userId];
            await sendQRCode(event.replyToken, amount);
          } else {
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: 'Please enter a valid number (min 100 THB) e.g. 750',
            });
          }
        } else if (text.includes('usdt_pay')) {
          await sendPaymentButton(event.replyToken);
        }

      } else if (event.type === 'postback') {
        const userId = event.source.userId;
        const data = new URLSearchParams(event.postback.data);
        const action = data.get('action');

        if (action === 'select_amount') {
          const thb = parseInt(data.get('thb'));
          await sendQRCode(event.replyToken, thb);
        } else if (action === 'custom_amount') {
          waitingForAmount[userId] = true;
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'Enter the amount you want to pay (THB) e.g. 750\n\n(Min 100 THB)',
          });
        }
      }
    } catch (err) {
      console.error('Event error:', err.message);
    }
  }
});

app.get('/', function(req, res) {
  res.json({ status: 'USDT Payment Server running' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
