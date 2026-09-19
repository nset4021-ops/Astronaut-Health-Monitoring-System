import { useCallback, useEffect, useRef, useState } from 'react'

const COMMANDS = [
  { phrase: 'show mobility', action: 'mobility' },
  { phrase: 'check radiation', action: 'radiation' },
  { phrase: 'run daily briefing', action: 'briefing' },
  { phrase: 'apply countermeasure', action: 'countermeasure' },
  { phrase: 'stop listening', action: 'stop' },
]

function getRecognition() {
  if (typeof window === 'undefined') return null
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Recognition) return null
  const recognition = new Recognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'
  return recognition
}

export function useVoiceCommands({ onCommand } = {}) {
  const recognitionRef = useRef(null)
  const onCommandRef = useRef(onCommand)
  const [isSupported, setIsSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { onCommandRef.current = onCommand }, [onCommand])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current || getRecognition()
    if (!recognition) {
      setError('Voice commands are unavailable in this browser.')
      return
    }
    recognitionRef.current = recognition
    setError('')
    recognition.start()
  }, [])

  useEffect(() => {
    const recognition = getRecognition()
    setIsSupported(Boolean(recognition))
    if (!recognition) return undefined
    recognitionRef.current = recognition
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = (event) => {
      setIsListening(false)
      setError(event.error === 'not-allowed' ? 'Microphone access denied.' : `Voice input error: ${event.error}`)
    }
    recognition.onresult = (event) => {
      const text = Array.from(event.results).slice(event.resultIndex).map((result) => result[0].transcript).join(' ').trim().toLowerCase()
      setTranscript(text)
      const command = COMMANDS.find(({ phrase }) => text.includes(phrase))
      if (command) {
        if (command.action === 'stop') stopListening()
        else onCommandRef.current?.(command.action, text)
      }
    }
    return () => { recognition.stop(); recognitionRef.current = null }
  }, [stopListening])

  return { isSupported, isListening, transcript, error, startListening, stopListening, commands: COMMANDS }
}

export { COMMANDS }
