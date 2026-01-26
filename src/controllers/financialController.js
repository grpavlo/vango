async function getBalance(req, res) {
  res.json({ balance: req.user.balance });
}

async function requestWithdrawal(req, res) {
  const { amount } = req.body;
  if (amount > req.user.balance) {
    res.status(400).send('Insufficient balance');
    return;
  }
  req.user.balance -= amount;
  await req.user.save();
  res.json({ message: 'Withdrawal requested', balance: req.user.balance });
}

module.exports = { getBalance, requestWithdrawal };
