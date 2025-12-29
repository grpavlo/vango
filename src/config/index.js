const JWT_SECRET = process.env.JWT_SECRET || 'secret';
let SERVICE_FEE_PERCENT = parseFloat(process.env.SERVICE_FEE_PERCENT || '2');

function setServiceFee(percent) {
  SERVICE_FEE_PERCENT = percent;
  module.exports.SERVICE_FEE_PERCENT = SERVICE_FEE_PERCENT;
}

module.exports = { JWT_SECRET, SERVICE_FEE_PERCENT, setServiceFee };
