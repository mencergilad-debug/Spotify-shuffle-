if (!res.ok) {
  console.error('Spotify API Error', {
    path,
    status: res.status,
    data
  });

  throw new Error(
    `${path} - ${res.status} - ${JSON.stringify(data)}`
  );
}