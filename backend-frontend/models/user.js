const bcrypt = require('bcryptjs');

class User {
  constructor(pool) {
    this.pool = pool;
  }

  async create(username, password, role = 'user') {
    const hash = await bcrypt.hash(password, 10);
    const result = await this.pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hash, role]
    );
    return result.rows[0];
  }

  async findByUsername(username) {
    const result = await this.pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  }
}

module.exports = User;

