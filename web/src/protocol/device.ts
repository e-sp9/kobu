/**
 * Device-level commands that aren't tied to a particular sub-system
 * (keymap, macros, lighting). Right now there's just the bootloader
 * jump, but anything that simply rebooots / mode-switches the firmware
 * belongs here.
 */

import { TransportError } from '../transport/types';
import type { WebHidTransport } from '../transport/webhid';
import { buildBootloaderJump } from './commands';

/**
 * Ask the firmware to reboot into UF2 mass-storage bootloader mode.
 *
 * The firmware reboots immediately on receiving this packet so the HID
 * endpoint disappears before any reply can come back. Both the send
 * itself and the reply timeout are treated as success — anything else
 * is a genuine error worth surfacing.
 */
export async function enterBootloader(transport: WebHidTransport): Promise<void> {
  try {
    await transport.sendAndReceive(buildBootloaderJump());
  } catch (err) {
    if (
      err instanceof TransportError &&
      (err.kind === 'receive-timeout' || err.kind === 'send-failed' || err.kind === 'disconnected')
    ) {
      // Expected — firmware rebooted before it could ack the command.
      return;
    }
    throw err;
  }
}
