import { GameOfLife3D, DEFAULT_RULES_3D } from './GameOfLife3D.ts';
import type { Rules3D } from './GameOfLife3D.ts';

// ── Inbound message types ─────────────────────────────────────────────────────
interface InitMsg     { type: 'init';     cols: number; rows: number; layers: number; rules: Rules3D }
interface StepMsg     { type: 'step' }
interface RandomMsg   { type: 'randomize'; density: number }
interface ClearMsg    { type: 'clear' }
interface SetRulesMsg { type: 'setRules'; rules: Rules3D }
type InMsg = InitMsg | StepMsg | RandomMsg | ClearMsg | SetRulesMsg;

// ── Worker state ──────────────────────────────────────────────────────────────
let game: GameOfLife3D = new GameOfLife3D(1, 1, 1, DEFAULT_RULES_3D);

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener('message', (e: MessageEvent<InMsg>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init': {
      game = new GameOfLife3D(msg.cols, msg.rows, msg.layers, msg.rules);
      reply('ready');
      break;
    }
    case 'step': {
      game.step(false);
      reply('sync');
      break;
    }
    case 'randomize': {
      game.randomize(msg.density);
      reply('sync');
      break;
    }
    case 'clear': {
      game.clear();
      reply('sync');
      break;
    }
    case 'setRules': {
      game.setRules(msg.rules);
      break;
    }
  }
});

// ── Helper: copy buffer and post it back (zero-copy via transfer) ─────────────
function reply(type: 'ready' | 'sync'): void {
  const buffer = game.getBuffer().slice();
  // Cast to the minimal interface shared by DedicatedWorkerGlobalScope.postMessage
  const ws = self as unknown as { postMessage(msg: object, transfer: Transferable[]): void };
  ws.postMessage({ type, generation: game.generation, buffer }, [buffer.buffer]);
}
