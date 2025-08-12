const bcrypt = require('bcryptjs');

class User {
  constructor(db) {
    this.db = db;
  }

  create(username, password, role = 'user') {
    return new Promise((resolve, reject) => {
      bcrypt.hash(password, 10).then(hash => {
        this.db.run(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
          [username, hash, role],
          function (err) {
            if (err) return reject(err);
            resolve({ id: this.lastID, username, role });
          }
        );
      }).catch(reject);
    });
  }

  findByUsername(username) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }
}

module.exports = User;
