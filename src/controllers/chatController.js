export const handleChat = async (req, res) => {
  // Endpoint disabled: external HTTP client removed
  res.status(501).json({ error: 'Chat via OpenRouter disabled on server' })
}
