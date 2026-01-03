import React, { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'
import '@/styles/Terminal.css'

interface ExecutionTerminalProps {
  logs: string
  isExecuting?: boolean
}

export const ExecutionTerminal: React.FC<ExecutionTerminalProps> = ({ logs, isExecuting = false }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstance = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!terminalRef.current) return

    const term = new Terminal({
      theme: {
        background: '#0f172a',
        foreground: '#f1f5f9',
        cursor: '#7c3aed',
        selection: 'rgba(124, 58, 237, 0.3)',
      },
      fontSize: 14,
      fontFamily: '"Courier New", Courier, monospace',
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      cursorBlink: true,
      cursorStyle: 'block',
      rows: 20,
      cols: 80,
      scrollback: 1000,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    
    term.open(terminalRef.current)
    
    // Fit after DOM is ready
    setTimeout(() => {
      try {
        fitAddon.fit()
        // Don't write "Terminal initialized." here - will be handled by logs useEffect
      } catch (err) {
        console.error('Error fitting terminal:', err)
      }
    }, 50)

    terminalInstance.current = term
    fitAddonRef.current = fitAddon

    const handleResize = () => {
      try {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit()
        }
      } catch (err) {
        console.error('Error fitting terminal:', err)
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      term.dispose()
    }
  }, [])

  useEffect(() => {
    if (!terminalInstance.current) return
    
    // Clear terminal
    terminalInstance.current.clear()
    
    if (logs) {
      // Split by lines and write each, filtering out empty lines
      const lines = logs.split('\n').filter(line => line.trim() !== '')
      lines.forEach(line => {
        if (terminalInstance.current) {
          terminalInstance.current.writeln(line)
        }
      })
    } else {
      // Only show "Terminal initialized." when there are no logs
      terminalInstance.current.writeln('Terminal initialized.')
    }
  }, [logs])

  return <div ref={terminalRef} className="execution-terminal" />
}

export default ExecutionTerminal
