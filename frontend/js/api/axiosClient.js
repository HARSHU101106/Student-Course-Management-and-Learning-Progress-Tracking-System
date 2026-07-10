const api = {
  get: async (url) => fetch(url).then((res) => res.json()),
  post: async (url, data) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((res) => res.json()),
};

export default api;
