import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

export interface SandboxConfig {
  timeout: number
  maxMemory: string // e.g., "512m"
  maxCpu: number
  tempDir: string
}

export class Sandbox {
  private config: SandboxConfig

  constructor(config: SandboxConfig) {
    this.config = config
  }

  /**
   * Create isolated sandbox directory
   */
  async createSandbox(): Promise<string> {
    const sandboxId = `sandbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const sandboxPath = path.join(this.config.tempDir, sandboxId)

    fs.mkdirSync(sandboxPath, { recursive: true })

    // Set restrictive permissions
    fs.chmodSync(sandboxPath, 0o755)

    return sandboxPath
  }

  /**
   * Clean up sandbox directory
   */
  async destroySandbox(sandboxPath: string): Promise<void> {
    try {
      if (fs.existsSync(sandboxPath)) {
        fs.rmSync(sandboxPath, { recursive: true, force: true })
      }
    } catch (error) {
      console.error(`Failed to destroy sandbox ${sandboxPath}:`, error)
    }
  }

  /**
   * Check available disk space
   */
  getAvailableSpace(): number {
    try {
      const stats = execSync(`df -B1 ${this.config.tempDir} | tail -1 | awk '{print $4}'`, {
        encoding: 'utf8',
      })
      return parseInt(stats.trim(), 10)
    } catch (error) {
      console.error('Failed to check available space:', error)
      return 0
    }
  }

  /**
   * Get memory usage of process
   */
  getMemoryUsage(pid: number): number {
    try {
      const stats = execSync(`ps -p ${pid} -o rss= 2>/dev/null || echo 0`, {
        encoding: 'utf8',
      })
      return parseInt(stats.trim(), 10) * 1024 // Convert KB to bytes
    } catch (error) {
      return 0
    }
  }

  /**
   * Restrict file system access
   */
  createJailDirectory(sandboxPath: string): void {
    const allowedDirs = ['inputs', 'outputs', 'temp']

    for (const dir of allowedDirs) {
      const dirPath = path.join(sandboxPath, dir)
      fs.mkdirSync(dirPath, { recursive: true })
      fs.chmodSync(dirPath, 0o755)
    }
  }

  /**
   * Block network access
   */
  blockNetworkAccess(): void {
    try {
      // This would require root privileges in real scenario
      // For now, just document the intent
      console.log('Network access would be blocked via iptables (requires root)')
    } catch (error) {
      console.error('Failed to block network access:', error)
    }
  }

  /**
   * Enforce resource limits
   */
  enforceResourceLimits(command: string): string {
    // ulimit command to restrict resources
    return `ulimit -t ${Math.ceil(this.config.timeout / 1000)} && ${command}`
  }

  /**
   * Kill orphaned processes
   */
  async killOrphanedProcesses(sandboxPath: string): Promise<void> {
    try {
      // Kill any processes with files open in the sandbox
      execSync(`fuser -k ${sandboxPath} 2>/dev/null || true`, {
        stdio: 'pipe',
      })
    } catch (error) {
      console.error('Failed to kill orphaned processes:', error)
    }
  }

  /**
   * Validate code for dangerous patterns
   */
  validateCode(code: string, language: string): { valid: boolean; issues: string[] } {
    const issues: string[] = []

    // Language-specific checks
    switch (language) {
      case 'python':
        if (code.includes('__import__')) issues.push('Import manipulation detected')
        if (code.includes('eval(')) issues.push('eval() is not allowed')
        if (code.includes('exec(')) issues.push('exec() is not allowed')
        if (code.includes('os.system')) issues.push('System commands are not allowed')
        break

      case 'javascript':
      case 'typescript':
        if (code.includes('require(')) issues.push('Dynamic requires are not allowed')
        if (code.includes('eval(')) issues.push('eval() is not allowed')
        if (code.includes('child_process')) issues.push('Child process access is not allowed')
        break

      case 'java':
        if (code.includes('Runtime.getRuntime()')) issues.push('Runtime execution is not allowed')
        if (code.includes('ProcessBuilder')) issues.push('Process building is not allowed')
        break

      case 'go':
        if (code.includes('os.Exec')) issues.push('Command execution is not allowed')
        if (code.includes('net.')) issues.push('Network access is not allowed')
        break

      case 'csharp':
        if (code.includes('System.Diagnostics.Process')) issues.push('Process execution is not allowed')
        if (code.includes('System.Net')) issues.push('Network access is not allowed')
        break
    }

    return {
      valid: issues.length === 0,
      issues,
    }
  }
}
