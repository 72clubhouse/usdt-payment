const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const path = require('path');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

const LIFF_ID = process.env.LIFF_ID || '2010018986-l6xlmcbu';

const NETWORKS = {
  trc20: {
    name: 'TRC-20',
    chain: 'TRON',
    wallet: process.env.WALLET_TRC20 || 'TYDBW2VbvntabbzkG8byXbgv9zmi4exT9j',
    spread: 0.03,
    warning: 'TRC-20 only - wrong network = lost funds',
  },
  bep20: {
    name: 'BEP-20',
    chain: 'BNB Smart Chain',
    wallet: process.env.WALLET_BEP20 || '0x5C1480eea66F113879cFE57E6fdce81077a28260',
    spread: 0.03,
    warning: 'BEP-20 only - wrong network = lost funds',
  },
  polygon: {
    name: 'Polygon',
    chain: 'Polygon Network',
    wallet: process.env.WALLET_POLYGON || '0x5C1480eea66F113879cFE57E6fdce81077a28260',
    spread: 0.03,
    warning: 'Polygon only - wrong network = lost funds',
  },
};

async function getRate() {
  try {
    const res = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=USDTTHB');
    const mktRate = parseFloat(res.data.price);
    return mktRate;
  } catch (e) {
    return 33;
  }
}

app.get('/liff', function(req, res) {
  res.sendFile(path.join(__dirname, 'liff.html'));
});

app.get('/rate', async function(req, res) {
  const mktRate = await getRate();
  const rates = {};
  for (const key in NETWORKS) {
    const net = NETWORKS[key];
    rates[key] = {
      name: net.name,
      chain: net.chain,
      wallet: net.wallet,
      spread: net.spread,
      ourRate: mktRate * (1 - net.spread),
      warning: net.warning,
    };
  }
  res.json({ mktRate, rates });
});

async function sendPaymentButton(replyToken) {
  const mktRate = await getRate();
  const presets = [100, 200, 500, 1000, 2000, 5000];

  const bestRate = mktRate * (1 - 0.03);

  const buttons = presets.map(function(thb) {
    return {
      type: 'button',
      action: {
        type: 'postback',
        label: thb.toLocaleString() + ' THB = ' + (thb / bestRate).toFixed(2) + ' USDT',
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
          { type: 'text', text: 'TRC-20, BEP-20, Polygon: 3% spread', color: '#ddffdd', size: 'xs' },
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
              type: 'uri',
              label: 'Enter custom amount',
              uri: 'https://usdt-payment-q54z.onrender.com/liff',
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

async function sendNetworkSelect(replyToken, thb) {
  const mktRate = await getRate();

  const networkButtons = Object.keys(NETWORKS).map(function(key) {
    const net = NETWORKS[key];
    const ourRate = mktRate * (1 - net.spread);
    const usdt = (thb / ourRate).toFixed(4);
    return {
      type: 'button',
      action: {
        type: 'postback',
        label: net.name + ' - ' + usdt + ' USDT (' + (net.spread * 100) + '%)',
        data: 'action=select_network&thb=' + thb + '&network=' + key,
      },
      style: 'secondary',
      height: 'sm',
    };
  });

  const message = {
    type: 'flex',
    altText: 'Select network',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#111111',
        contents: [
          { type: 'text', text: 'Select Network', color: '#ffffff', size: 'lg', weight: 'bold' },
          { type: 'text', text: 'Amount: ' + thb.toLocaleString() + ' THB', color: '#888888', size: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: 'Choose your preferred network', size: 'sm', color: '#555555' },
          { type: 'box', layout: 'vertical', spacing: 'xs', contents: networkButtons },
        ],
      },
    },
  };

  await client.replyMessage(replyToken, message);
}

async function sendQRCode(replyToken, thb, networkKey) {
  const mktRate = await getRate();
  const net = NETWORKS[networkKey];
  const ourRate = mktRate * (1 - net.spread);
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
          { type: 'text', text: net.name + ' - ' + net.chain, color: '#888888', size: 'xs' },
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
          { type: 'text', text: 'Network: ' + net.name + ' (' + net.chain + ')', size: 'sm', weight: 'bold' },
          { type: 'text', text: net.wallet, size: 'xxs', color: '#555555', wrap: true },
          { type: 'separator' },
          { type: 'text', text: net.warning, size: 'xs', color: '#ff5555', wrap: true },
          { type: 'text', text: 'You will be notified when payment is received', size: 'xs', color: '#888888', wrap: true },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'clipboard', label: 'Copy Address', clipboardText: net.wallet },
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
        const text = event.message.text.toLowerCase();
        if (text.includes('usdt_pay')) {
          await sendPaymentButton(event.replyToken);
        }
      } else if (event.type === 'postback') {
        const data = new URLSearchParams(event.postback.data);
        const action = data.get('action');

        if (action === 'select_amount') {
          const thb = parseInt(data.get('thb'));
          await sendNetworkSelect(event.replyToken, thb);
        } else if (action === 'select_network') {
          const thb = parseInt(data.get('thb'));
          const network = data.get('network');
          await sendQRCode(event.replyToken, thb, network);
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
