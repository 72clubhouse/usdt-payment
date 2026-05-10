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
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8688064558:AAH4VCduJ3Aiv9rNtUT6hWBPIeMokFI_6Nw';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1003705394096';
const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY || 'bdd072e5-e851-4e9a-9711-b368d837d370';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '5HVEE97H4UZA5T842YUVUZSGU6QX2PJV2T';

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

// เน€เธเนเธ tx hash เธ—เธตเนเนเธเนเธเน€เธ•เธทเธญเธเนเธเนเธฅเนเธง เนเธกเนเนเธซเนเนเธเนเธเธเนเธณ
const notifiedTx = new Set();

async function getRate() {
  try {
    const res = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=USDTTHB');
    return parseFloat(res.data.price);
  } catch (e) {
    return 33;
  }
}

async function sendTelegram(message) {
  try {
    await axios.post('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage', {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
    });
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}

// เน€เธเนเธ TRC-20 (TRON)
async function checkTRC20() {
  try {
    const wallet = NETWORKS.trc20.wallet;
    const res = await axios.get('https://api.trongrid.io/v1/accounts/' + wallet + '/transactions/trc20', {
      headers: { 'TRON-PRO-API-KEY': TRONGRID_API_KEY },
      params: { limit: 10, contract_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' }
    });
    const txs = res.data.data || [];
    for (const tx of txs) {
      if (tx.to === wallet && !notifiedTx.has(tx.transaction_id)) {
        notifiedTx.add(tx.transaction_id);
        const amount = (parseInt(tx.value) / 1e6).toFixed(2);
        const mktRate = await getRate();
        const thb = (parseFloat(amount) * mktRate).toFixed(2);
        const msg = '๐’ฐ <b>เน€เธเธดเธเน€เธเนเธฒ TRC-20!</b>\n\n' +
          '๐’ต เธเธณเธเธงเธ: <b>' + amount + ' USDT</b>\n' +
          '๐น๐ญ เธเธฃเธฐเธกเธฒเธ“: <b>' + parseFloat(thb).toLocaleString() + ' THB</b>\n' +
          '๐”— Network: TRC-20 (TRON)\n' +
          '๐“ TX: ' + tx.transaction_id.substring(0, 20) + '...';
        await sendTelegram(msg);
      }
    }
  } catch (e) {
    console.error('TRC20 check error:', e.message);
  }
}

// เน€เธเนเธ BEP-20 (BSC)
async function checkBEP20() {
  try {
    const wallet = NETWORKS.bep20.wallet;
    const res = await axios.get('https://api.bscscan.com/api', {
      params: {
        module: 'account',
        action: 'tokentx',
        address: wallet,
        contractaddress: '0x55d398326f99059fF775485246999027B3197955',
        page: 1,
        offset: 10,
        sort: 'desc',
        apikey: ETHERSCAN_API_KEY,
      }
    });
    const txs = res.data.result || [];
    for (const tx of txs) {
      if (tx.to.toLowerCase() === wallet.toLowerCase() && !notifiedTx.has(tx.hash)) {
        notifiedTx.add(tx.hash);
        const amount = (parseInt(tx.value) / 1e18).toFixed(2);
        const mktRate = await getRate();
        const thb = (parseFloat(amount) * mktRate).toFixed(2);
        const msg = '๐’ฐ <b>เน€เธเธดเธเน€เธเนเธฒ BEP-20!</b>\n\n' +
          '๐’ต เธเธณเธเธงเธ: <b>' + amount + ' USDT</b>\n' +
          '๐น๐ญ เธเธฃเธฐเธกเธฒเธ“: <b>' + parseFloat(thb).toLocaleString() + ' THB</b>\n' +
          '๐”— Network: BEP-20 (BSC)\n' +
          '๐“ TX: ' + tx.hash.substring(0, 20) + '...';
        await sendTelegram(msg);
      }
    }
  } catch (e) {
    console.error('BEP20 check error:', e.message);
  }
}

// เน€เธเนเธ Polygon
async function checkPolygon() {
  try {
    const wallet = NETWORKS.polygon.wallet;
    const res = await axios.get('https://api.polygonscan.com/api', {
      params: {
        module: 'account',
        action: 'tokentx',
        address: wallet,
        contractaddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        page: 1,
        offset: 10,
        sort: 'desc',
        apikey: ETHERSCAN_API_KEY,
      }
    });
    const txs = res.data.result || [];
    for (const tx of txs) {
      if (tx.to.toLowerCase() === wallet.toLowerCase() && !notifiedTx.has(tx.hash)) {
        notifiedTx.add(tx.hash);
        const amount = (parseInt(tx.value) / 1e6).toFixed(2);
        const mktRate = await getRate();
        const thb = (parseFloat(amount) * mktRate).toFixed(2);
        const msg = '๐’ฐ <b>เน€เธเธดเธเน€เธเนเธฒ Polygon!</b>\n\n' +
          '๐’ต เธเธณเธเธงเธ: <b>' + amount + ' USDT</b>\n' +
          '๐น๐ญ เธเธฃเธฐเธกเธฒเธ“: <b>' + parseFloat(thb).toLocaleString() + ' THB</b>\n' +
          '๐”— Network: Polygon\n' +
          '๐“ TX: ' + tx.hash.substring(0, 20) + '...';
        await sendTelegram(msg);
      }
    }
  } catch (e) {
    console.error('Polygon check error:', e.message);
  }
}

// เน€เธเนเธเธ—เธธเธ 60 เธงเธดเธเธฒเธ—เธต
setInterval(function() {
  checkTRC20();
  checkBEP20();
  checkPolygon();
}, 60 * 1000);

// เน€เธเนเธเธเธฃเธฑเนเธเนเธฃเธเธ•เธญเธ start
setTimeout(function() {
  checkTRC20();
  checkBEP20();
  checkPolygon();
}, 5000);

async function getNetworkRates() {
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
  return { mktRate, rates };
}

app.get('/liff', function(req, res) {
  res.sendFile(path.join(__dirname, 'liff.html'));
});

app.get('/rate', async function(req, res) {
  const data = await getNetworkRates();
  res.json(data);
});

async function sendPaymentButton(replyToken) {
  const mktRate = await getRate();
  const presets = [100, 200, 500, 1000, 2000, 5000];
  const bestRate = mktRate * 0.97;

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
          { type: 'text', text: 'Rate: 1 USDT = ' + mktRate.toFixed(2) + ' THB (spread 3%)', color: '#ddffdd', size: 'xs' },
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

// ===== TELEGRAM CLUB BOT =====
const ADMIN_USERNAME = '@clubhouse72';
const CLUB_LINK = 'https://clubgg.app.link/cWqrnZv1W2b';
const CLUB_ID = '264388';
const TG_API = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN;
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwHVv0q9LzVL2tmS6Ye56UnC_2XiGsRAxlzAJEhncTiuj3jDtT8jNQRDDfLUxl-zC_v/exec';
let tgOffset = 0;
const registerState = {};

async function sendTG(chatId, text, keyboard) {
  const payload = { chat_id: chatId, text: text, parse_mode: 'HTML' };
  if (keyboard) payload.reply_markup = { inline_keyboard: keyboard };
  try {
    await axios.post(TG_API + '/sendMessage', payload);
  } catch(e) {
    console.error('TG send error:', e.message);
  }
}

async function handleTGUpdate(update) {
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text || '';
    if (text === '/start') {
      const welcome =
        '๐ <b>เธขเธดเธเธ”เธตเธ•เนเธญเธเธฃเธฑเธเธชเธนเน 72Clubhouse!</b>\n' +
        'Welcome to 72Clubhouse! ๐น๐ญ\n\n' +
        '๐ฐ เน€เธฃเธฒเธเธทเธญ Poker Club เธเธฑเนเธเธเธณเธ—เธตเนเธฃเธงเธกเธเธฑเธเนเธเนเธกเธทเธญเธญเธฒเธเธตเธ\n' +
        'We are a premier Poker Club for professional players.\n\n' +
        '๐‘ เน€เธฅเธทเธญเธเธชเธดเนเธเธ—เธตเนเธ•เนเธญเธเธเธฒเธฃ / Select an option:';
      await sendTG(chatId, welcome, [
        [{ text: '๐ฎ เธชเธกเธฑเธเธฃเธชเธกเธฒเธเธดเธ / Register', callback_data: 'register' }],
        [{ text: '๐“– เธงเธดเธเธตเน€เธเนเธฒ Club / How to Join', callback_data: 'howto' }],
        [{ text: '๐’ฌ เธ•เธดเธ”เธ•เนเธญเนเธญเธ”เธกเธดเธ / Contact Admin', callback_data: 'contact' }],
      ]);
    } else {
      await sendTG(chatId, 'เธเธดเธกเธเน /start เน€เธเธทเนเธญเน€เธฃเธดเนเธกเธ•เนเธ\nType /start to begin ๐', null);
    }
  }

  if (update.callback_query) {
    const chatId = update.callback_query.message.chat.id;
    const data = update.callback_query.data;
    await axios.post(TG_API + '/answerCallbackQuery', { callback_query_id: update.callback_query.id }).catch(function(){});

    if (data === 'register') {
      const userId = update.callback_query.from.id;
      registerState[userId] = { step: 'name' };
      await sendTG(chatId, '๐“ <b>เธชเธกเธฑเธเธฃเธชเธกเธฒเธเธดเธ 72Clubhouse</b>\n\nเธเธฃเธญเธ <b>เธเธทเนเธญ-เธเธฒเธกเธชเธเธธเธฅ</b> เธเธญเธเธเธธเธ“:', null);

    } else if (data === 'join' || data === 'howto') {
      const msg =
        '๐“ฑ <b>เธงเธดเธเธตเน€เธเนเธฒ Club / How to Join</b>\n\n' +
        '1๏ธโฃ เธ”เธฒเธงเธเนเนเธซเธฅเธ” Club GG / Download Club GG\n\n' +
        '๐ iOS: https://apps.apple.com/us/app/clubgg-poker/id1529839330\n' +
        '๐ค– Android: https://play.google.com/store/apps/details?id=com.nsus.clubgg\n' +
        '๐’ป PC/Mac: https://www.clubgg.com\n\n' +
        '2๏ธโฃ เธชเธกเธฑเธเธฃเธชเธกเธฒเธเธดเธเนเธเนเธญเธ / Register in app\n\n' +
        '3๏ธโฃ เธเนเธเธซเธฒ Club ID: <b>' + CLUB_ID + '</b>\n' +
        '    Search Club ID: <b>' + CLUB_ID + '</b>\n\n' +
        '4๏ธโฃ เธเธ” Join โ’ เธฃเธญเนเธญเธ”เธกเธดเธ Approve\n' +
        '    Click Join โ’ Wait for Admin Approval\n\n' +
        'โ… เธเธเธเธฑเธเนเธ Club เธเธฃเธฑเธ ๐\n' +
        'See you in the Club! ๐';
      await sendTG(chatId, msg, [
        [{ text: '๐’ฌ เธ•เธดเธ”เธ•เนเธญเนเธญเธ”เธกเธดเธ / Contact Admin', callback_data: 'contact' }],
        [{ text: '๐” เธเธฅเธฑเธ / Back', callback_data: 'back' }],
      ]);

    } else if (data === 'contact') {
      const msg =
        '๐’ฌ <b>เธ•เธดเธ”เธ•เนเธญเนเธญเธ”เธกเธดเธ / Contact Admin</b>\n\n' +
        '๐‘ค Admin: ' + ADMIN_USERNAME + '\n\n' +
        'โฐ เธเธฃเนเธญเธกเนเธซเนเธเธฃเธดเธเธฒเธฃเธ—เธธเธเธงเธฑเธ / Available every day\n\n' +
        '๐“ฉ เธเธ”เธเธธเนเธกเธ”เนเธฒเธเธฅเนเธฒเธเน€เธเธทเนเธญเธ•เธดเธ”เธ•เนเธญเนเธญเธ”เธกเธดเธ\n' +
        'Click below to contact admin directly!';
      await sendTG(chatId, msg, [
        [{ text: '๐‘ค เนเธเธ—เธเธฑเธเนเธญเธ”เธกเธดเธ / Chat with Admin', url: 'https://t.me/clubhouse72' }],
        [{ text: '๐” เธเธฅเธฑเธ / Back', callback_data: 'back' }],
      ]);

    } else if (data === 'back') {
      const welcome =
        '๐ <b>72Clubhouse</b>\n\n' +
        '๐‘ เน€เธฅเธทเธญเธเธชเธดเนเธเธ—เธตเนเธ•เนเธญเธเธเธฒเธฃ / Select an option:';
      await sendTG(chatId, welcome, [
        [{ text: '๐ฎ เธชเธกเธฑเธเธฃเน€เธเนเธฒ Club / Join Club', callback_data: 'join' }],
        [{ text: '๐“– เธงเธดเธเธตเน€เธเนเธฒ Club / How to Join', callback_data: 'howto' }],
        [{ text: '๐’ฌ เธ•เธดเธ”เธ•เนเธญเนเธญเธ”เธกเธดเธ / Contact Admin', callback_data: 'contact' }],
      ]);
    }
  }
}

async function pollTG() {
  try {
    const res = await axios.get(TG_API + '/getUpdates', {
      params: { offset: tgOffset, timeout: 30 },
      timeout: 35000,
    });
    const updates = res.data.result || [];
    for (const u of updates) {
      tgOffset = u.update_id + 1;
      await handleTGUpdate(u);
    }
  } catch(e) {
    console.error('TG poll error:', e.message);
  }
  setTimeout(pollTG, 1000);
}

setTimeout(pollTG, 3000);
// ===== END TELEGRAM CLUB BOT =====

// ===== REGISTER BOT =====
const REGISTER_BOT_TOKEN = process.env.REGISTER_BOT_TOKEN || '8704643171:AAG2nd5umGh6bl0S7cT6ekBz3q-FplJXCmg';
const REGISTER_API = 'https://api.telegram.org/bot' + REGISTER_BOT_TOKEN;
let regOffset = 0;
const regState = {};

async function sendReg(chatId, text, keyboard) {
  const payload = { chat_id: chatId, text: text, parse_mode: 'HTML' };
  if (keyboard) payload.reply_markup = { inline_keyboard: keyboard };
  try { await axios.post(REGISTER_API + '/sendMessage', payload); } catch(e) {}
}

async function saveToSheet(data) {
  try {
    await axios.post(SHEET_URL, data, { headers: { 'Content-Type': 'application/json' } });
  } catch(e) { console.error('Sheet error:', e.message); }
}

async function handleRegUpdate(update) {
  if (update.message) {
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const text = update.message.text || '';

    if (regState[userId]) {
      const state = regState[userId];
      if (state.step === 'name') {
        state.name = text; state.step = 'phone';
        await sendReg(chatId, '๐“ เธเธฃเธญเธ <b>เน€เธเธญเธฃเนเนเธ—เธฃเธจเธฑเธเธ—เน</b> เธเธญเธเธเธธเธ“:', null);
      } else if (state.step === 'phone') {
        state.phone = text; state.step = 'bank';
        await sendReg(chatId, '๐ฆ เธเธฃเธญเธ <b>เธเธเธฒเธเธฒเธฃ/เน€เธฅเธเธเธฑเธเธเธต</b> เธเธญเธเธเธธเธ“:\nเน€เธเนเธ เธเธชเธดเธเธฃ 123-4-56789-0', null);
      } else if (state.step === 'bank') {
        state.bank = text; state.step = 'clubgg';
        await sendReg(chatId, '๐ฎ เธเธฃเธญเธ <b>ID Club GG</b> เธเธญเธเธเธธเธ“:', null);
      } else if (state.step === 'clubgg') {
        state.clubgg_id = text; state.step = 'wallet';
        await sendReg(chatId, '๐’ฐ เธเธฃเธญเธ <b>Wallet Address</b> เธเธฃเธดเธเนเธ•เธเธญเธเธเธธเธ“:', null);
      } else if (state.step === 'wallet') {
        state.wallet = text;
        await saveToSheet({
          name: state.name, phone: state.phone, bank: state.bank,
          clubgg_id: state.clubgg_id, wallet: state.wallet,
          telegram_id: '@' + (update.message.from.username || userId),
        });
        const adminMsg =
          '๐• <b>เธชเธกเธฒเธเธดเธเนเธซเธกเน!</b>\n\n' +
          '๐‘ค เธเธทเนเธญ: ' + state.name + '\n' +
          '๐“ เน€เธเธญเธฃเน: ' + state.phone + '\n' +
          '๐ฆ เธเธฑเธเธเธต: ' + state.bank + '\n' +
          '๐ฎ Club GG ID: ' + state.clubgg_id + '\n' +
          '๐’ฐ Wallet: ' + state.wallet + '\n' +
          '๐“ฑ Telegram: @' + (update.message.from.username || userId);
        await sendTelegram(adminMsg);
        delete regState[userId];
        await sendReg(chatId,
          'โ… <b>เธชเธกเธฑเธเธฃเธชเธกเธฒเธเธดเธเธชเธณเน€เธฃเนเธเนเธฅเนเธงเธเธฃเธฑเธ!</b>\n\nเนเธญเธ”เธกเธดเธเธเธฐเธ•เธดเธ”เธ•เนเธญเธเธฅเธฑเธเน€เธฃเนเธงเน เธเธตเนเธเธฃเธฑเธ ๐\n\n๐‘ค @clubhouse72',
          [[{ text: '๐” เธเธฅเธฑเธเธซเธเนเธฒเธซเธฅเธฑเธ', callback_data: 'reg_back' }]]
        );
      }
      return;
    }

    if (text === '/start') {
      await sendReg(chatId,
        '๐ <b>เธขเธดเธเธ”เธตเธ•เนเธญเธเธฃเธฑเธเธชเธนเน 72Clubhouse!</b>\nWelcome! ๐น๐ญ\n\n๐“ เธเธ”เธเธธเนเธกเธ”เนเธฒเธเธฅเนเธฒเธเน€เธเธทเนเธญเธชเธกเธฑเธเธฃเธชเธกเธฒเธเธดเธเนเธ”เนเน€เธฅเธขเธเธฃเธฑเธ:',
        [[{ text: '๐“ เธชเธกเธฑเธเธฃเธชเธกเธฒเธเธดเธ / Register', callback_data: 'reg_start' }]]
      );
    }
  }

  if (update.callback_query) {
    const chatId = update.callback_query.message.chat.id;
    const userId = update.callback_query.from.id;
    const data = update.callback_query.data;
    await axios.post(REGISTER_API + '/answerCallbackQuery', { callback_query_id: update.callback_query.id }).catch(function(){});

    if (data === 'reg_start') {
      regState[userId] = { step: 'name' };
      await sendReg(chatId, '๐“ <b>เธชเธกเธฑเธเธฃเธชเธกเธฒเธเธดเธ 72Clubhouse</b>\n\nเธเธฃเธญเธ <b>เธเธทเนเธญ-เธเธฒเธกเธชเธเธธเธฅ</b> เธเธญเธเธเธธเธ“:', null);
    } else if (data === 'reg_back') {
      await sendReg(chatId,
        '๐ <b>72Clubhouse</b>\n\n๐“ เธเธ”เธเธธเนเธกเธ”เนเธฒเธเธฅเนเธฒเธเน€เธเธทเนเธญเธชเธกเธฑเธเธฃเธชเธกเธฒเธเธดเธ:',
        [[{ text: '๐“ เธชเธกเธฑเธเธฃเธชเธกเธฒเธเธดเธ / Register', callback_data: 'reg_start' }]]
      );
    }
  }
}

async function pollReg() {
  try {
    const res = await axios.get(REGISTER_API + '/getUpdates', {
      params: { offset: regOffset, timeout: 30 }, timeout: 35000,
    });
    const updates = res.data.result || [];
    for (const u of updates) { regOffset = u.update_id + 1; await handleRegUpdate(u); }
  } catch(e) { console.error('Reg poll error:', e.message); }
  setTimeout(pollReg, 1000);
}

setTimeout(pollReg, 4000);
// ===== END REGISTER BOT =====
