const { ensureTestAccountAccess } = require('./testAccount');

// Compatibility entry point used by server startup. No privileged demo access.
module.exports = {
  hasDefaultPrivilegedAccess: () => false,
  ensureDefaultUserAccess: ensureTestAccountAccess,
};
