import { useCallback, useEffect, useRef, useState } from 'react'

const COMMANDS = [
  { phrase: 'show mobility', action: 'mobility' },
  { phrase: 'open mobility', action: 'mobility' },
  { phrase: 'camera mobility', action: 'mobility' },
  { phrase: 'show biometrics', action: 'biometrics' },
  { phrase: 'open biometrics', action: 'biometrics' },
  { phrase: 'open stress scanner', action: 'biometrics' },
  { phrase: 'run stress scan', action: 'biometrics' },
  { phrase: 'check radiation', action: 'radiation' },
  { phrase: 'run daily briefing', action: 'briefing' },
  { phrase: 'open daily briefing', action: 'briefing' },
  { phrase: 'daily briefing', action: 'briefing' },
  { phrase: 'apply countermeasure', action: 'countermeasure' },
  { phrase: 'open countermeasure', action: 'countermeasure' },
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
  const restartTimerRef = useRef(null)
  const shouldListenRef = useRef(false)
  const isListeningRef = useRef(false)
  const startPendingRef = useRef(false)
  const lastCommandRef = useRef({ action: '', at: 0 })
  const [isSupported, setIsSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { onCommandRef.current = onCommand }, [onCommand])

  const beginRecognition = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition || !shouldListenRef.current || isListeningRef.current || startPendingRef.current) return

    startPendingRef.current = true
    try {
      recognition.start()
    } catch (caught) {
      startPendingRef.current = false
      if (caught?.name !== 'InvalidStateError') {
        shouldListenRef.current = false
        setError(caught?.message || 'Voice input could not be started.')
      }
    }
  }, [])

  const stopListening = useCallback(() => {
    const shouldStopRecognition = isListeningRef.current || startPendingRef.current
    shouldListenRef.current = false
    startPendingRef.current = false
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
    if (recognitionRef.current && shouldStopRecognition) recognitionRef.current.stop()
    isListeningRef.current = false
    setIsListening(false)
  }, [])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Voice commands are unavailable in this browser.')
      return
    }
    shouldListenRef.current = true
    setError('')
    setTranscript('')
    beginRecognition()
  }, [beginRecognition])

  useEffect(() => {
    const recognition = getRecognition()
    setIsSupported(Boolean(recognition))
    if (!recognition) return undefined
    recognitionRef.current = recognition
    recognition.onstart = () => {
      startPendingRef.current = false
      isListeningRef.current = true
      setError('')
      setIsListening(true)
    }
    recognition.onend = () => {
      startPendingRef.current = false
      isListeningRef.current = false
      setIsListening(false)
      if (!shouldListenRef.current) return
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null
        beginRecognition()
      }, 150)
    }
    recognition.onerror = (event) => {
      startPendingRef.current = false
      setIsListening(false)
      isListeningRef.current = false
      if (event.error === 'aborted' || event.error === 'no-speech') return
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldListenRef.current = false
        setError('Microphone access denied. Allow microphone access in your browser settings and try again.')
        return
      }
      if (event.error === 'audio-capture') {
        shouldListenRef.current = false
        setError('No microphone is available. Connect a microphone and try again.')
        return
      }
      setError(`Voice input error: ${event.error}`)
    }
    recognition.onresult = (event) => {
      const results = Array.from(event.results).slice(event.resultIndex)
      const text = results.map((result) => result[0].transcript).join(' ').trim().toLowerCase()
      if (text) setTranscript(text)

      const finalText = results.filter((result) => result.isFinal).map((result) => result[0].transcript).join(' ').trim().toLowerCase()
      if (!finalText) return

      const command = COMMANDS.find(({ phrase }) => finalText.includes(phrase))
      if (command) {
        const now = Date.now()
        const isDuplicate = command.action === lastCommandRef.current.action && now - lastCommandRef.current.at < 1500
        if (isDuplicate) return
        lastCommandRef.current = { action: command.action, at: now }
        if (command.action === 'stop') stopListening()
        else onCommandRef.current?.(command.action, finalText)
      }
    }
    return () => {
      shouldListenRef.current = false
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current)
      recognition.onstart = null
      recognition.onend = null
      recognition.onerror = null
      recognition.onresult = null
      if (isListeningRef.current || startPendingRef.current) recognition.stop()
      recognitionRef.current = null
    }
  }, [beginRecognition, stopListening])

  return { isSupported, isListening, transcript, error, startListening, stopListening, commands: COMMANDS }
}

export { COMMANDS }
