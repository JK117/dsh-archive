/**
 * Hands one URL to the desktop's default browser. The argv is fixed per
 * platform and never goes through a shell, so the page can not turn the open
 * route into an arbitrary command runner. Windows needs an explicit empty
 * window title, otherwise `start` reads the URL as one.
 */
import { spawn } from 'node:child_process'

function openerCommand(url) {
  if (process.platform === 'darwin') return { command: '/usr/bin/open', args: [url] }
  if (process.platform === 'win32') {
    return { command: 'cmd.exe', args: ['/c', 'start', '', url] }
  }
  return { command: 'xdg-open', args: [url] }
}

/** Resolves once the opener has actually started, so a failure is reportable. */
export function launchExternal(url) {
  const { command, args } = openerCommand(url)
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(command, args, { detached: true, stdio: 'ignore' })
    } catch (error) {
      reject(error)
      return
    }
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}
