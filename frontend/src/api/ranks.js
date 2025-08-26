export async function fetchUserRanks(token) {
  if (!token) return null;
  const res = await fetch('http://localhost:4000/api-v1/ratingGradations', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch ranks');
  }
  return res.json();
}
