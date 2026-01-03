(function(){
  const Y = window.Y
  if (!Y) return console.error('Yjs not loaded')

  let ws
  let ydoc
  let ytext
  const sessionInput = document.getElementById('sessionId')
  const langInput = document.getElementById('language')
  const connectBtn = document.getElementById('connect')
  const execBtn = document.getElementById('exec')

  function connect() {
    const sessionId = sessionInput.value.trim()
    if (!sessionId) return alert('Preencha sessionId')

    const tokenVal = document.getElementById('token').value.trim()
    const tokenQuery = tokenVal ? `&token=${encodeURIComponent(tokenVal)}` : ''
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:1234/yjs?sessionId=${encodeURIComponent(sessionId)}${tokenQuery}`
    ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'

    ydoc = new Y.Doc()
    ytext = ydoc.getText('monaco')

    // integrate Monaco model
    const waitEditor = setInterval(() => {
      if (window._monacoEditor && window._monacoEditor.getModel) {
        clearInterval(waitEditor)
        const editor = window._monacoEditor
        const model = editor.getModel()
        // apply initial content from ytext
        model.setValue(ytext.toString())

        // local -> Y.Text
        model.onDidChangeContent(() => {
          // naive synchronization: set whole text
          const v = model.getValue()
          ydoc.transact(() => {
            ytext.delete(0, ytext.length)
            ytext.insert(0, v)
          })
        })

        // Y.Text -> local
        ytext.observe(() => {
          const v = ytext.toString()
          if (model.getValue() !== v) model.setValue(v)
        })

      }
    }, 100)

    ws.onopen = () => {
      console.log('WS open', url)
      // subscribe to local updates and send binary updates
      ydoc.on('update', (update) => {
        try {
          ws.send(update)
        } catch (e) {
          console.error('failed to send update', e)
        }
      })
    }

    ws.onmessage = (evt) => {
      const data = evt.data
      if (!data) return
      const buf = new Uint8Array(data)
      try {
        // Apply update to local doc
        Y.applyUpdate(ydoc, buf)
      } catch (e) {
        console.error('failed to apply update', e)
      }
    }

    ws.onclose = () => console.log('WS closed')
    ws.onerror = (e) => console.error('WS error', e)
  }

  connectBtn.addEventListener('click', () => {
    connect()
  })

  execBtn.addEventListener('click', async () => {
    const sessionId = sessionInput.value.trim()
    const language = langInput.value.trim() || 'python'
    const executionId = `exec-${Date.now()}`
    if (!sessionId) return alert('sessionId empty')

    // ask API to materialize and execute
    try {
      const res = await fetch('/api/execute-from-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, executionId, language })
      })
      const json = await res.json()
      alert(JSON.stringify(json))
    } catch (e) {
      console.error('execute failed', e)
      alert('Execution request failed')
    }
  })
})()
