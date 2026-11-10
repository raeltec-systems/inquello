/** Main-only synthetic smoke/test observer. Never registered as a renderer or model capability. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { WslTasks, validateTransferName } from './wsl-tasks';

const guests = new Map<string, WslTasks>();
export function taskFiles(hostFolder: string, principal: string) {
  const parent = path.dirname(hostFolder);
  const task = path.basename(hostFolder);
  let guest: WslTasks | undefined;
  if (process.platform === 'win32') {
    const key = `${parent}\0${principal}`;
    guest = guests.get(key);
    if (!guest) { guest = new WslTasks(parent, principal); guests.set(key, guest); }
  }
  return {
    root: guest ? guest.guestRoot(task) : hostFolder,
    async read(relative: string): Promise<string | null> {
      validateTransferName(relative);
      if (guest) {
        const entries = (await guest.broker(task, { action: 'snapshot' })).entries!;
        const file = entries.find(entry => entry.path === relative && entry.kind === 'file');
        return file ? Buffer.from(file.data!, 'base64').toString('utf8') : null;
      }
      try { return fs.readFileSync(path.join(hostFolder, ...relative.split('/')), 'utf8'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    },
    async write(relative: string, value: string): Promise<void> {
      validateTransferName(relative);
      if (guest) {
        const entries = (await guest.broker(task, { action: 'snapshot' })).entries!;
        await guest.broker(task, { action: 'replace', entries: [
          ...entries.filter(entry => entry.path !== relative),
          { path: relative, kind: 'file', data: Buffer.from(value).toString('base64'), sha256: createHash('sha256').update(value).digest('hex') },
        ] });
      } else fs.writeFileSync(path.join(hostFolder, ...relative.split('/')), value);
    },
  };
}
