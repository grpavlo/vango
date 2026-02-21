const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const SMSFLY_API_KEY = process.env.SMSFLY_API_KEY || process.env.TURBOSMS_TOKEN || '';
const SMSFLY_SENDER = process.env.SMSFLY_SENDER || process.env.TURBOSMS_SENDER || 'InfoCenter';
const SMSFLY_API_URL = process.env.SMSFLY_API_URL || 'https://sms-fly.ua/api/v2/api.php';
let SERVICE_FEE_PERCENT = parseFloat(process.env.SERVICE_FEE_PERCENT || '2');

function setServiceFee(percent) {
  SERVICE_FEE_PERCENT = percent;
  module.exports.SERVICE_FEE_PERCENT = SERVICE_FEE_PERCENT;
}

module.exports = { JWT_SECRET, SMSFLY_API_KEY, SMSFLY_SENDER, SMSFLY_API_URL, SERVICE_FEE_PERCENT, setServiceFee };
