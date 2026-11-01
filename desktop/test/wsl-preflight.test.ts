import { describe, expect, it } from 'vitest';
import { assertDStoragePath, previewWslConfig, wslHostEnvironment } from '../src/main/runtime/wsl';

describe('strict WSL preparation', () => {
  it('previews only swap/crash changes and preserves unrelated settings', () => {
    const current = '# owner settings\r\n[wsl2]\r\nmemory=8GB\r\nnetworkingMode=mirrored\r\nswap=8GB\r\n[experimental]\r\nsparseVhd=true\r\n';
    const preview = previewWslConfig(current);
    expect(preview).toContain('memory=8GB\r\nnetworkingMode=mirrored\r\nswap=4GB');
    expect(preview).toContain('swapFile=D:\\\\Inquello\\\\wsl\\\\swap.vhdx');
    expect(preview).toContain('[experimental]\r\nsparseVhd=true');
    expect(preview).not.toMatch(/defaultVhdSize|guiApplications|processors/);
    expect(previewWslConfig(preview)).toBe(preview);
  });
  it('adds the section to an absent config and rejects ambiguous settings', () => {
    expect(previewWslConfig('')).toMatch(/^\[wsl2\]\nswap=4GB\n/);
    expect(() => previewWslConfig('[wsl2]\n[wsl2]\n')).toThrow('Duplicate');
    expect(() => previewWslConfig('[wsl2]\nswap=1GB\nSWAP=2GB\n')).toThrow('Duplicate');
  });
  it.each(['C:\\payload', 'D:relative', '\\\\host\\share', '\\\\?\\D:\\payload', 'D:\\safe\\..\\elsewhere', 'D:\\safe\\file:stream', 'D:\\safe.\\file', 'D:\\safe \\file'])('rejects unsafe storage %s', (target) => {
    expect(() => assertDStoragePath(target)).toThrow();
  });
  it('accepts explicit D paths and starts the future WSL host with an allowlist', () => {
    expect(() => assertDStoragePath('D:\\Inquello\\tmp')).not.toThrow();
    const env = wslHostEnvironment('C:\\Windows');
    expect(Object.keys(env).sort()).toEqual(['PATH', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'WINDIR'].sort());
    expect(env.TEMP).toBe('D:\\Inquello\\tmp');
    expect(env.WSLENV).toBeUndefined();
  });
});
