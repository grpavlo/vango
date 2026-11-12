export function isDeletedAccount(account) {
  return Boolean(account?.deletedAt || account?.name === 'Акаунт видалено' || account?.name === 'Видалений акаунт');
}
