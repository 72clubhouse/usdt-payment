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
const MIN_THB = 100;
const WAITING_TIMEOUT_MS = 5 * 60 * 1000; // 5 เธเธฒเธ—เธต

// เน€เธเนเธ state เธเธฃเนเธญเธก timestamp เน€เธเธทเนเธญเธ—เธณ timeout
const waitingForAmount = {};

// เธฅเธ state เธ—เธตเนเธซเธกเธ”เธญเธฒเธขเธธเธ—เธธเธ 1 เธเธฒเธ—เธต
setInterval(() => {
  const now = Date.now();
  for (const userId in waitingForAmount) {
    if (now - waitingForAmount[userId].timestamp > WAITING_TIMEOUT_MS) {
      delete waitingForAmount[userId];
    }
  }
}, 60 * 1000);

async function getRate() {
  try {
    const res = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=USDTTHB');
    const mktRate = parseFloat(res.data.price);
    const ourRate = mktRate * (1 - SPREAD);
    return { mktRate, ourRate };
  } catch {
    return { mktRate: 33, ourRate: 33 * (1 - SPREAD) };
  }
}

app.post('/webhook', line.middleware(config), async (req, res) => {
  res.json({ status: 'ok' });
  const events = req.body.events;
  for (const event of events) {
    try {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const rawText = event.message.text.trim();
        const text = rawText.toLowerCase();

        // เธ–เนเธฒเธฅเธนเธเธเนเธฒเธเธณเธฅเธฑเธเธฃเธญเธเธฃเธญเธเธเธณเธเธงเธเน€เธเธดเธ
        if (waitingForAmount[userId]) {
          // เธ•เธฃเธงเธเธชเธญเธ timeout เธเนเธญเธ
          const elapsed = Date.now() - waitingForAmount[userId].timestamp;
          if (elapsed > WAITING_TIMEOUT_MS) {
            delete waitingForAmount[userId];
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: 'เธซเธกเธ”เน€เธงเธฅเธฒเธเธฃเธญเธเธเธณเธเธงเธเน€เธเธดเธเนเธฅเนเธง เธเธฃเธธเธ“เธฒเน€เธฃเธดเนเธกเนเธซเธกเนเธญเธตเธเธเธฃเธฑเนเธ'
            });
            continue;
          }

          // เนเธเธฅเธเธ•เธฑเธงเน€เธฅเธ เธฃเธญเธเธฃเธฑเธเธ—เธฑเนเธ comma เนเธฅเธฐ dot
          const amount = parseFloat(rawText.replace(/,/g, ''));

          if (!isNaN(amount) && amount >= MIN_THB) {
            delete waitingForAmount[userId];
            await sendQRCode(event.replyToken, amount);
          } else {
            // เนเธเนเธ error เนเธ•เนเธขเธฑเธเธเธ state เนเธงเนเนเธซเนเธเธฃเธญเธเนเธซเธกเนเนเธ”เน
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: `เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเธณเธเธงเธเน€เธเธดเธเน€เธเนเธเธ•เธฑเธงเน€เธฅเธ (เธเธฑเนเธเธ•เนเธณ ${MIN_THB.toLocaleString()} THB)\nเน€เธเนเธ 750 เธซเธฃเธทเธญ 1,500`
            });
          }
          continue;
        }

        // เธเธณเธชเธฑเนเธเธเธเธ•เธด
        if (text.includes('usdt_pay')) {
          await sendPaymentButton(event.replyToken);
        }

      } else if (event.type === 'postback') {
        const data = new URLSearchParams(event.postback.data);
        const action = data.get('action');
        const userId = event.source.userId;

        if (action === 'select_amount') {
          const thb = parseInt(data.get('thb'));
          if (!isNaN(thb) && thb >= MIN_THB) {
            await sendQRCode(event.replyToken, thb);
          }
        } else if (action === 'custom_amount') {
          // เธเธฑเธเธ—เธถเธ state เธเธฃเนเธญเธก timestamp
          waitingForAmount[userId] = { timestamp: Date.now() };
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `เธเธฃเธญเธเธเธณเธเธงเธเน€เธเธดเธเธ—เธตเนเธ•เนเธญเธเธเธฒเธฃ (THB)\nเน€เธเนเธ 750\n\n(เธเธฑเนเธเธ•เนเธณ ${MIN_THB.toLocaleString()} THB ยท เธซเธกเธ”เน€เธงเธฅเธฒเนเธ 5 เธเธฒเธ—เธต)`
          });
        }
      }
    } catch (err) {
      console.error('Event error:', err.message);
    }
  }
});

async function sendPaymentButton(replyToken) {
  const { ourRate } = await getRate();
  const presets = [100, 200, 500, 1000, 2000, 5000];

  const message = {
    type: 'flex',
    altText: 'เน€เธฅเธทเธญเธเธเธณเธเธงเธเน€เธเธดเธ',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#06C755',
        contents: [
          { type: 'text', text: 'เธเธณเธฃเธฐเน€เธเธดเธ USDT', color: '#ffffff', size: 'xl', weight: 'bold' },
          { type: 'text', text: `1 USDT = ${ourRate.toFixed(2)} THB (เธฃเธงเธก spread 3%)`, color: '#ddffdd', size: 'xs' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: 'เน€เธฅเธทเธญเธเธเธณเธเธงเธเน€เธเธดเธ (เธเธฒเธ—)', weight: 'bold', size: 'sm', color: '#555555' },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: presets.map(thb => ({
              type: 'button',
              action: {
                type: 'postback',
                label: `${thb.toLocaleString()} เธฟ  โ  ${(thb / ourRate).toFixed(4)} USDT`,
                data: `action=select_amount&thb=${thb}`
              },
              style: 'secondary',
              height: 'sm'
            }))
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: 'เธฃเธฐเธเธธเธเธณเธเธงเธเน€เธเธดเธเน€เธญเธ',
              data: 'action=custom_amount'
            },
            style: 'primary',
            color: '#111111',
            height: 'sm'
          }
        ]
      }
    }
  };
  await client.replyMessage(replyToken, message);
}

async function sendQRCode(replyToken, thb) {
  const { ourRate } = await getRate();
  const usdt = (thb / ourRate).toFixed(4);

  const message = {
    type: 'flex',
    altText: `เธเธณเธฃเธฐ ${usdt} USDT`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#111111',
        contents: [
          { type: 'text', text: 'เธชเนเธเธเน€เธเธทเนเธญเธเธณเธฃเธฐเน€เธเธดเธ', color: '#ffffff', size: 'lg', weight: 'bold' },
          { type: 'text', text: 'USDT Payment', color: '#888888', size: 'xs' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: `${usdt} USDT`, size: 'xxl', weight: 'bold', color: '#06C755', align: 'center' },
          { type: 'text', text: `โ ${thb.toLocaleString()} THB`, size: 'sm', color: '#888888', align: 'center' },
          { type: 'separator' },
          { type: 'text', text: 'Network: TRC-20 (TRON)', size: 'sm', weight: 'bold' },
          { type: 'text', text: WALLET_TRC20, size: 'xxs', color: '#555555', wrap: true },
          { type: 'separator' },
          { type: 'text', text: 'โ ๏ธ TRC-20 เน€เธ—เนเธฒเธเธฑเนเธ โ€” เธเธดเธ” network = เน€เธชเธตเธขเน€เธเธดเธ', size: 'xs', color: '#ff5555', wrap: true },
          { type: 'text', text: 'เธฃเธฐเธเธเธเธฐเนเธเนเธเน€เธกเธทเนเธญเนเธ”เนเธฃเธฑเธเน€เธเธดเธเนเธฅเนเธง', size: 'xs', color: '#888888', wrap: true }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'button',
          action: { type: 'clipboard', label: 'เธเธฑเธ”เธฅเธญเธ Address', clipboardText: WALLET_TRC20 },
          style: 'primary',
          color: '#06C755'
        }]
      }
    }
  };
  await client.replyMessage(replyToken, message);
}

app.get('/', (req, res) => res.json({ status: 'USDT Payment Server running' }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
