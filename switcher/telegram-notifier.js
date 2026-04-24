export class TelegramNotifier {
  #token
  #chatId
  #enabled
  #appName

  constructor({ token, chatId, appName = 'incaslop-switcher' }) {
    this.#token = token ? String(token).trim() : ''
    this.#chatId = chatId ? String(chatId).trim() : ''
    this.#enabled = Boolean(this.#token)
    this.#appName = appName
  }

  get enabled() {
    return this.#enabled
  }

  get chatId() {
    return this.#chatId
  }

  async init() {
    if (!this.#enabled) return { enabled: false, reason: 'missing-token' }
    if (!this.#chatId) {
      this.#chatId = await this.#discoverChatId()
    }
    if (!this.#chatId) {
      return { enabled: false, reason: 'missing-chat-id' }
    }
    return { enabled: true, chatId: this.#chatId }
  }

  async send(text) {
    if (!this.#enabled || !this.#chatId) return false
    const body = {
      chat_id: this.#chatId,
      text: `[${this.#appName}] ${text}`,
      disable_web_page_preview: true,
    }
    try {
      const res = await fetch(this.#url('sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async #discoverChatId() {
    try {
      const res = await fetch(this.#url('getUpdates'))
      if (!res.ok) return ''
      const data = await res.json()
      const updates = Array.isArray(data?.result) ? data.result : []
      for (let i = updates.length - 1; i >= 0; i -= 1) {
        const update = updates[i]
        const chatId =
          update?.message?.chat?.id ??
          update?.edited_message?.chat?.id ??
          update?.channel_post?.chat?.id
        if (chatId !== undefined && chatId !== null) {
          return String(chatId)
        }
      }
      return ''
    } catch {
      return ''
    }
  }

  #url(method) {
    return `https://api.telegram.org/bot${this.#token}/${method}`
  }
}
