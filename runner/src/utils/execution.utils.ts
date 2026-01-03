import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export class ExecutionUtils {
  /**
   * Check if a command exists in the system
   */
  static commandExists(command: string): boolean {
    try {
      execSync(`command -v ${command}`, { stdio: 'pipe', shell: '/bin/bash' })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get installed versions of each language
   */
  static getInstalledLanguages(): Record<string, string | null> {
    const languages: Record<string, { command: string; flag: string }> = {
      python: { command: 'python3', flag: '--version' },
      node: { command: 'node', flag: '--version' },
      java: { command: 'java', flag: '-version' },
      go: { command: 'go', flag: 'version' },
      mono: { command: 'mono', flag: '--version' },
    }

    const result: Record<string, string | null> = {}

    for (const [lang, { command, flag }] of Object.entries(languages)) {
      if (this.commandExists(command)) {
        try {
          const version = execSync(`${command} ${flag} 2>&1`, { encoding: 'utf8' }).split('\n')[0]
          result[lang] = version
        } catch {
          result[lang] = 'installed but version unknown'
        }
      } else {
        result[lang] = null
      }
    }

    return result
  }

  /**
   * Create a unique execution ID
   */
  static generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substring(7)}`
  }

  /**
   * Clean up temporary files
   */
  static cleanupTempFiles(tempDir: string, maxAge: number = 3600000): void {
    // maxAge in milliseconds (default 1 hour)
    try {
      const now = Date.now()
      const files = fs.readdirSync(tempDir)

      for (const file of files) {
        const filePath = path.join(tempDir, file)
        const stats = fs.statSync(filePath)
        const age = now - stats.mtimeMs

        if (age > maxAge) {
          if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true })
          } else {
            fs.unlinkSync(filePath)
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error)
    }
  }

  /**
   * Monitor disk usage
   */
  static getDiskUsage(directory: string): {
    used: number
    available: number
    total: number
    usagePercent: number
  } {
    try {
      const output = execSync(`df -B1 ${directory} | tail -1`, {
        encoding: 'utf8',
      })
      const parts = output.trim().split(/\s+/)
      const total = parseInt(parts[1], 10)
      const used = parseInt(parts[2], 10)
      const available = parseInt(parts[3], 10)
      const usagePercent = ((used / total) * 100).toFixed(2)

      return { used, available, total, usagePercent: parseFloat(usagePercent as string) }
    } catch (error) {
      console.error('Error getting disk usage:', error)
      return { used: 0, available: 0, total: 0, usagePercent: 0 }
    }
  }

  /**
   * Truncate long output
   */
  static truncateOutput(output: string, maxLength: number = 100000): string {
    if (output.length > maxLength) {
      return output.substring(0, maxLength) + `\n... (truncated, ${output.length} total characters)`
    }
    return output
  }

  /**
   * Sanitize output (remove sensitive information)
   */
  static sanitizeOutput(output: string): string {
    // Remove common patterns of sensitive data
    let sanitized = output

    // Remove potential API keys
    sanitized = sanitized.replace(/['\"]?(?:api[_-]?key|secret|token|password)['\"]?\s*[:=]\s*['\"]?[a-zA-Z0-9_-]+['\"]?/gi, '[REDACTED]')

    // Remove paths with common secret directories
    sanitized = sanitized.replace(/\/(?:\.ssh|\.aws|\.azure|\.gcp|\.env)/g, '[REDACTED]')

    return sanitized
  }

  /**
   * Format execution result for logging
   */
  static formatExecutionResult(result: any): string {
    const lines = [
      `Exit Code: ${result.exitCode}`,
      `Execution Time: ${result.executionTime || 'N/A'}ms`,
    ]

    if (result.stdout) {
      lines.push(`STDOUT:\n${result.stdout}`)
    }
    if (result.stderr) {
      lines.push(`STDERR:\n${result.stderr}`)
    }

    return lines.join('\n')
  }

  /**
   * Get system information
   */
  static getSystemInfo(): Record<string, any> {
    const os = require('os')

    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      cpuCount: os.cpus().length,
    }
  }
}
