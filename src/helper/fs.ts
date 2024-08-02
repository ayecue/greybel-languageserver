import { crlf, LF } from 'crlf-normalize';
import fs from 'fs';
import path from 'path';
// @ts-ignore: No type definitions
import { TextDecoderLite as TextDecoder } from 'text-encoder-lite';

export async function tryToGet(targetUri: string): Promise<Uint8Array | null> {
  try {
    return fs.readFileSync(targetUri);
  } catch (err) {
    console.error(err);
  }

  return null;
}

export function tryToGetPath(targetUri: string, altTargetUri: string): string {
  if (fs.existsSync(targetUri)) {
    return targetUri;
  } else if (fs.existsSync(altTargetUri)) {
    return altTargetUri;
  }
  return targetUri;
}

export function tryToDecode(targetUri: string): string {
  const out = tryToGet(targetUri);

  if (out) {
    const content = new TextDecoder().decode(out);
    return crlf(content, LF);
  }

  return '';
}
